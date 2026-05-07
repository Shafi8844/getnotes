/**
 * Seed script — populates Cosmos with a few demo resources so the app
 * doesn't look empty during the marking video.
 *
 * Run after the app has booted at least once (so containers exist):
 *     npm run seed
 *
 * Note: this only inserts metadata rows. The fileUrl points at placeholder
 * URLs — for the demo video, do real uploads through the UI to also exercise
 * the Blob Storage path.
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const cosmos = require('../services/cosmosService');

const samples = [
    {
        title: 'Cloud Native Development - Week 6 Lecture Notes',
        description: 'Covers Azure Functions and Logic Apps. Includes diagrams and worked examples.',
        module: 'COM682',
        course: 'MSc Computer Science',
        university: 'Ulster University',
        tags: ['azure', 'functions', 'serverless', 'lecture'],
        contentType: 'application/pdf',
        fileUrl: 'https://example.blob.core.windows.net/resources/sample-week6.pdf',
        blobName: 'placeholder-week6.pdf',
        originalFileName: 'week6-notes.pdf',
        fileSize: 2_500_000
    },
    {
        title: 'Cosmos DB partitioning explained — diagram',
        description: 'Hand-drawn diagram showing logical vs physical partitions and request routing.',
        module: 'COM682',
        course: 'MSc Computer Science',
        university: 'Ulster University',
        tags: ['cosmos-db', 'partitioning', 'diagram'],
        contentType: 'image/png',
        fileUrl: 'https://example.blob.core.windows.net/resources/cosmos-diagram.png',
        blobName: 'placeholder-cosmos.png',
        originalFileName: 'cosmos-diagram.png',
        fileSize: 380_000
    },
    {
        title: 'Tutorial recording: deploying Node.js to App Service',
        description: '12-minute walkthrough of VS Code → Azure deployment with the Azure extension.',
        module: 'COM682',
        course: 'MSc Computer Science',
        university: 'Ulster University',
        tags: ['app-service', 'deployment', 'tutorial', 'video'],
        contentType: 'video/mp4',
        fileUrl: 'https://example.blob.core.windows.net/resources/tutorial.mp4',
        blobName: 'placeholder-tutorial.mp4',
        originalFileName: 'app-service-tutorial.mp4',
        fileSize: 24_000_000
    }
];

async function main() {
    console.log('Initialising Cosmos containers...');
    await cosmos.init();
    const container = cosmos.container('resources');

    for (const s of samples) {
        const item = {
            id: uuidv4(),
            ...s,
            uploadedBy: 'seed-script',
            views: Math.floor(Math.random() * 100),
            avgRating: Number((4 + Math.random()).toFixed(1)),
            ratingCount: Math.floor(Math.random() * 30) + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await container.items.create(item);
        console.log(`  + ${s.title}`);
    }
    console.log('Done.');
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
