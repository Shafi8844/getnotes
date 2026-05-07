/**
 * /api/interactions
 *
 * Stores comments and ratings in the `interactions` Cosmos container,
 * partitioned by resourceId. Updates the parent resource's avgRating /
 * ratingCount in the `resources` container in the same handler so trending
 * queries stay accurate.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cosmos = require('../services/cosmosService');
const insights = require('../services/insights');

const router = express.Router();

// ===== POST a comment =====
// body: { resourceId, userId, text }
router.post('/comments', async (req, res, next) => {
    try {
        const { resourceId, userId, text } = req.body;
        if (!resourceId || !text) {
            return res.status(400).json({ error: 'resourceId and text are required.' });
        }

        const item = {
            id: uuidv4(),
            type: 'comment',
            resourceId,
            userId: userId || 'anonymous',
            text: String(text).trim().slice(0, 2000),
            createdAt: new Date().toISOString()
        };

        const { resource } = await cosmos.container('interactions').items.create(item);
        insights.trackEvent('CommentPosted', { resourceId });
        res.status(201).json(resource);
    } catch (err) {
        next(err);
    }
});

// ===== GET comments for a resource =====
router.get('/comments/:resourceId', async (req, res, next) => {
    try {
        const query = {
            query: `SELECT * FROM c
                    WHERE c.resourceId = @rid AND c.type = 'comment'
                    ORDER BY c.createdAt DESC`,
            parameters: [{ name: '@rid', value: req.params.resourceId }]
        };
        const { resources } = await cosmos.container('interactions').items.query(query).fetchAll();
        res.json({ count: resources.length, comments: resources });
    } catch (err) {
        next(err);
    }
});

// ===== POST a rating (1-5) =====
// body: { resourceId, userId, rating }
router.post('/ratings', async (req, res, next) => {
    try {
        const { resourceId, userId, rating } = req.body;
        const r = Number(rating);
        if (!resourceId || !Number.isFinite(r) || r < 1 || r > 5) {
            return res.status(400).json({ error: 'resourceId and rating (1-5) required.' });
        }

        // Save the individual rating event.
        const item = {
            id: uuidv4(),
            type: 'rating',
            resourceId,
            userId: userId || 'anonymous',
            rating: r,
            createdAt: new Date().toISOString()
        };
        await cosmos.container('interactions').items.create(item);

        // Recompute aggregates from the source of truth instead of trusting
        // a running counter — slightly more expensive, but it self-heals if
        // a duplicate rating ever sneaks in.
        const aggQuery = {
            query: `SELECT VALUE {avg: AVG(c.rating), count: COUNT(1)}
                    FROM c WHERE c.resourceId = @rid AND c.type = 'rating'`,
            parameters: [{ name: '@rid', value: resourceId }]
        };
        const { resources: agg } = await cosmos.container('interactions')
            .items.query(aggQuery).fetchAll();
        const { avg = 0, count = 0 } = agg[0] || {};

        // Patch the resource doc. We need its partition key (module).
        const findRes = {
            query: 'SELECT c.id, c.module FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: resourceId }]
        };
        const { resources: found } = await cosmos.container('resources')
            .items.query(findRes).fetchAll();
        if (found.length) {
            await cosmos.container('resources').item(found[0].id, found[0].module).patch([
                { op: 'set', path: '/avgRating',   value: Math.round(avg * 10) / 10 },
                { op: 'set', path: '/ratingCount', value: count }
            ]);
        }

        insights.trackEvent('Rated', { resourceId, rating: String(r) });
        res.status(201).json({ ok: true, avgRating: Math.round(avg * 10) / 10, ratingCount: count });
    } catch (err) {
        next(err);
    }
});

// ===== DELETE a comment =====
router.delete('/comments/:resourceId/:id', async (req, res, next) => {
    try {
        await cosmos.container('interactions')
            .item(req.params.id, req.params.resourceId).delete();
        res.status(204).send();
    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'Comment not found.' });
        next(err);
    }
});

module.exports = router;
