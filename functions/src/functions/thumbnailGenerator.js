/**
 * Thumbnail Generator — Blob trigger.
 *
 * When any new blob is uploaded to the `resources` container, this function
 * fires asynchronously. If the blob is an image, it generates a 300x300
 * thumbnail and writes it to the `thumbnails` container.
 *
 * This decouples thumbnail work from the upload request, so the user gets
 * a fast response and the thumbnail is produced on a separate (free-tier)
 * Function plan that can scale independently of the App Service.
 *
 * Deploys with `func azure functionapp publish <appName>` from the functions/
 * directory. Set `AzureWebJobsStorage` to the same storage account
 * connection string used by the main app.
 */
const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');

app.storageBlob('thumbnailGenerator', {
    path: 'resources/{name}',
    connection: 'AzureWebJobsStorage',
    handler: async (blob, context) => {
        const name = context.triggerMetadata.name;
        const contentType = context.triggerMetadata.properties?.contentType || '';
        context.log(`Thumbnail trigger fired for ${name} (${contentType}, ${blob.length} bytes)`);

        // Only process images. Skip PDFs, video, etc. (a separate function
        // could handle video keyframe extraction with ffmpeg).
        if (!contentType.startsWith('image/')) {
            context.log(`Skipping non-image blob: ${name}`);
            return;
        }

        try {
            const thumbnail = await sharp(blob)
                .resize(300, 300, { fit: 'cover', position: 'center' })
                .jpeg({ quality: 80 })
                .toBuffer();

            const blobSvc = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage);
            const container = blobSvc.getContainerClient('thumbnails');
            await container.createIfNotExists({ access: 'blob' });

            const thumbName = name.replace(/\.[^.]+$/, '') + '_thumb.jpg';
            const block = container.getBlockBlobClient(thumbName);
            await block.uploadData(thumbnail, {
                blobHTTPHeaders: { blobContentType: 'image/jpeg' }
            });

            context.log(`Thumbnail written: ${thumbName} (${thumbnail.length} bytes)`);
        } catch (err) {
            context.error(`Thumbnail generation failed for ${name}:`, err);
            throw err; // let the Functions runtime retry
        }
    }
});
