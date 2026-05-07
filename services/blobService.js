/**
 * Azure Blob Storage service.
 *
 * Stores the actual binary uploads (PDF lecture notes, diagrams, video
 * tutorials). Cosmos DB only ever stores the URL + metadata, which keeps
 * the metadata store lean and lets blob I/O scale independently — exactly
 * the hybrid architecture proposed in the CW1 design.
 *
 * Auth: connection string (lab path) OR Managed Identity (production).
 */
const {
    BlobServiceClient,
    StorageSharedKeyCredential,
    generateBlobSASQueryParameters,
    BlobSASPermissions
} = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'resources';

let blobServiceClient;
let containerClient;

function getBlobServiceClient() {
    if (blobServiceClient) return blobServiceClient;

    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;

    if (connStr) {
        blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    } else if (account) {
        // Managed Identity path.
        const url = `https://${account}.blob.core.windows.net`;
        blobServiceClient = new BlobServiceClient(url, new DefaultAzureCredential());
    } else {
        throw new Error(
            'Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME.'
        );
    }
    return blobServiceClient;
}

async function init() {
    const svc = getBlobServiceClient();
    containerClient = svc.getContainerClient(CONTAINER_NAME);
    // Create the container with public-read access for blobs so that the
    // returned URLs render directly in <img>/<video>. For private files,
    // switch to 'private' and serve via SAS URLs (helper below).
    await containerClient.createIfNotExists({ access: 'blob' });
    console.log(`[blob] Container "${CONTAINER_NAME}" ready.`);
}

/**
 * Upload a file buffer.
 * @param {Buffer} buffer        - the file bytes (multer memoryStorage)
 * @param {string} originalName  - original filename, for extension only
 * @param {string} contentType   - MIME type
 * @returns {{ blobName: string, url: string, size: number }}
 */
async function uploadFile(buffer, originalName, contentType) {
    if (!containerClient) throw new Error('Blob service not initialised.');

    const ext = path.extname(originalName) || '';
    const blobName = `${Date.now()}-${uuidv4()}${ext}`;
    const blockBlob = containerClient.getBlockBlobClient(blobName);

    await blockBlob.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: contentType }
    });

    return {
        blobName,
        url: blockBlob.url,
        size: buffer.length
    };
}

async function deleteFile(blobName) {
    if (!containerClient) throw new Error('Blob service not initialised.');
    await containerClient.deleteBlob(blobName, { deleteSnapshots: 'include' });
}

/**
 * Generate a time-limited SAS URL (used if the container is private).
 * Only works with shared-key auth, not Managed Identity — for MI use
 * `generateUserDelegationSasUrl` from @azure/storage-blob instead.
 */
function generateSasUrl(blobName, expiryMinutes = 60) {
    const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
    if (!account || !accountKey) {
        throw new Error('SAS generation needs AZURE_STORAGE_ACCOUNT_NAME and _KEY.');
    }

    const cred = new StorageSharedKeyCredential(account, accountKey);
    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const sas = generateBlobSASQueryParameters({
        containerName: CONTAINER_NAME,
        blobName,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn
    }, cred).toString();

    return `https://${account}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}?${sas}`;
}

module.exports = { init, uploadFile, deleteFile, generateSasUrl, CONTAINER_NAME };
