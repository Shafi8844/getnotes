/**
 * /api/resources
 *
 * Full CRUD for academic resources (lecture notes, diagrams, video tutorials).
 *  POST   /api/resources           upload a new resource (multipart)
 *  GET    /api/resources           list all resources, optional filters
 *  GET    /api/resources/:id       fetch one resource
 *  PUT    /api/resources/:id       update metadata
 *  DELETE /api/resources/:id       delete resource (DB + blob)
 *  GET    /api/resources/trending  top-rated resources (advanced query)
 */
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const cosmos = require('../services/cosmosService');
const blob = require('../services/blobService');
const insights = require('../services/insights');

const router = express.Router();

// 100 MB max — covers PDF notes and short video clips, while protecting
// the App Service from runaway uploads.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

const ALLOWED_TYPES = [
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
];

// ===== POST /api/resources : CREATE =====
router.post('/', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded (field name "file").' });
        }
        if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
            return res.status(400).json({
                error: `Unsupported file type: ${req.file.mimetype}`
            });
        }

        const { title, description, module, course, university, tags, uploadedBy } = req.body;
        if (!title || !module) {
            return res.status(400).json({ error: 'title and module are required.' });
        }

        // 1. Upload to Blob Storage first; if that fails, no DB row is created.
        const uploaded = await blob.uploadFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );

        // 2. Persist metadata in Cosmos DB.
        const resource = {
            id: uuidv4(),
            title: title.trim(),
            description: (description || '').trim(),
            module: module.trim(),
            course: (course || '').trim(),
            university: (university || '').trim(),
            tags: tags ? String(tags).split(',').map(t => t.trim()).filter(Boolean) : [],
            uploadedBy: uploadedBy || 'anonymous',
            originalFileName: req.file.originalname,
            blobName: uploaded.blobName,
            fileUrl: uploaded.url,
            fileSize: uploaded.size,
            contentType: req.file.mimetype,
            views: 0,
            avgRating: 0,
            ratingCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const { resource: created } = await cosmos.container('resources').items.create(resource);

        insights.trackEvent('ResourceUploaded', {
            module: resource.module,
            contentType: resource.contentType,
            sizeKB: String(Math.round(uploaded.size / 1024))
        });

        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
});

// ===== GET /api/resources : LIST =====
router.get('/', async (req, res, next) => {
    try {
        const { module, course, university, search, limit = 50 } = req.query;

        // Build a parameterised SQL query — never string-concat user input.
        const where = [];
        const parameters = [];
        if (module)     { where.push('c.module = @module');         parameters.push({ name: '@module', value: module }); }
        if (course)     { where.push('c.course = @course');         parameters.push({ name: '@course', value: course }); }
        if (university) { where.push('c.university = @university'); parameters.push({ name: '@university', value: university }); }
        if (search) {
            where.push('(CONTAINS(LOWER(c.title), @s) OR CONTAINS(LOWER(c.description), @s))');
            parameters.push({ name: '@s', value: search.toLowerCase() });
        }

        const query = {
            query: `SELECT TOP ${parseInt(limit, 10)} * FROM c
                    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                    ORDER BY c.createdAt DESC`,
            parameters
        };

        const { resources } = await cosmos.container('resources').items.query(query).fetchAll();
        res.json({ count: resources.length, resources });
    } catch (err) {
        next(err);
    }
});

// ===== GET /api/resources/trending =====
// Defined BEFORE /:id so 'trending' isn't captured as an id.
router.get('/trending', async (_req, res, next) => {
    try {
        const query = {
            query: `SELECT TOP 10 *
                    FROM c
                    WHERE c.ratingCount > 0
                    ORDER BY c.avgRating DESC, c.views DESC`
        };
        const { resources } = await cosmos.container('resources').items.query(query).fetchAll();
        res.json({ count: resources.length, resources });
    } catch (err) {
        next(err);
    }
});

// ===== GET /api/resources/:id : READ ONE =====
router.get('/:id', async (req, res, next) => {
    try {
        // Cross-partition query because we don't know the partition key (module)
        // from just the id. For higher scale, add ?module= to the URL and
        // do a point-read instead.
        const query = {
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: req.params.id }]
        };
        const { resources } = await cosmos.container('resources').items.query(query).fetchAll();
        if (!resources.length) return res.status(404).json({ error: 'Resource not found.' });

        const resource = resources[0];

        // Fire-and-forget view increment (don't block the response).
        cosmos.container('resources').item(resource.id, resource.module).patch([
            { op: 'incr', path: '/views', value: 1 }
        ]).catch(e => insights.trackException(e));

        res.json(resource);
    } catch (err) {
        next(err);
    }
});

// ===== PUT /api/resources/:id : UPDATE METADATA =====
router.put('/:id', async (req, res, next) => {
    try {
        // Find first to get the partition key (module).
        const find = {
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: req.params.id }]
        };
        const { resources } = await cosmos.container('resources').items.query(find).fetchAll();
        if (!resources.length) return res.status(404).json({ error: 'Resource not found.' });
        const existing = resources[0];

        const updatable = ['title', 'description', 'course', 'university', 'tags'];
        const patched = { ...existing };
        for (const key of updatable) {
            if (req.body[key] !== undefined) {
                patched[key] = key === 'tags'
                    ? (Array.isArray(req.body.tags)
                        ? req.body.tags
                        : String(req.body.tags).split(',').map(t => t.trim()).filter(Boolean))
                    : req.body[key];
            }
        }
        patched.updatedAt = new Date().toISOString();

        const { resource: updated } = await cosmos.container('resources')
            .item(existing.id, existing.module)
            .replace(patched);

        insights.trackEvent('ResourceUpdated', { id: existing.id });
        res.json(updated);
    } catch (err) {
        next(err);
    }
});

// ===== DELETE /api/resources/:id =====
router.delete('/:id', async (req, res, next) => {
    try {
        const find = {
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: req.params.id }]
        };
        const { resources } = await cosmos.container('resources').items.query(find).fetchAll();
        if (!resources.length) return res.status(404).json({ error: 'Resource not found.' });
        const existing = resources[0];

        // Delete the blob first; if Cosmos delete fails we'd otherwise have an orphaned row,
        // but at least the binary is gone. On a blob-delete failure we surface the error
        // and leave the row in place — operator can retry.
        await blob.deleteFile(existing.blobName);
        await cosmos.container('resources').item(existing.id, existing.module).delete();

        insights.trackEvent('ResourceDeleted', { id: existing.id, module: existing.module });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
