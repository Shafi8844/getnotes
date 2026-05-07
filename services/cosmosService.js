/**
 * Cosmos DB service.
 *
 * Three containers, all partitioned for horizontal scalability:
 *   - resources    : academic resources metadata          (PK: /module)
 *   - interactions : comments / ratings / view events     (PK: /resourceId)
 *   - users        : registered student accounts          (PK: /id)
 *
 * Uses the modern @azure/cosmos v4 SDK. The client supports either:
 *   1. Connection string (simple, what the labs use), or
 *   2. AAD / Managed Identity via DefaultAzureCredential (recommended in prod).
 */
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');

const DB_NAME = process.env.COSMOS_DB_NAME || 'getnotes';

const CONTAINERS = {
    resources:    { id: 'resources',    partitionKey: '/module' },
    interactions: { id: 'interactions', partitionKey: '/resourceId' },
    users:        { id: 'users',        partitionKey: '/id' }
};

let client;
let database;
const containers = {};

function getClient() {
    if (client) return client;

    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;

    if (!endpoint) {
        throw new Error('COSMOS_ENDPOINT is required (Cosmos DB account URI).');
    }

    if (key) {
        // Local / simple deployment path: key-based auth.
        client = new CosmosClient({ endpoint, key });
    } else {
        // Production path: Managed Identity. Grant the App Service's identity
        // the "Cosmos DB Built-in Data Contributor" role on the account.
        client = new CosmosClient({
            endpoint,
            aadCredentials: new DefaultAzureCredential()
        });
    }
    return client;
}

/**
 * Idempotent: creates DB + containers if they do not exist.
 * Safe to call on every cold start.
 */
async function init() {
    const c = getClient();
    const { database: db } = await c.databases.createIfNotExists({ id: DB_NAME });
    database = db;

    for (const [key, def] of Object.entries(CONTAINERS)) {
        const { container } = await db.containers.createIfNotExists({
            id: def.id,
            partitionKey: { paths: [def.partitionKey] }
        });
        containers[key] = container;
    }
    console.log(`[cosmos] Database "${DB_NAME}" ready with containers: ${Object.keys(containers).join(', ')}`);
    return containers;
}

function container(name) {
    if (!containers[name]) {
        throw new Error(`Cosmos container "${name}" not initialised. Call init() first.`);
    }
    return containers[name];
}

module.exports = { init, container, DB_NAME };
