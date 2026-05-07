/**
 * /api/users
 *
 * Minimal user records, stored in the `users` Cosmos container.
 * Authentication itself is handled by Microsoft Entra ID in the production
 * design (see CW1 deck). This endpoint keeps the lightweight profile data
 * the app needs for display purposes.
 *
 * NOTE: in a real deployment you would (a) require an Entra ID token on
 * write operations and (b) hash any local password fields with bcrypt/argon2.
 * The CW1 design specifies Entra ID, so we deliberately don't store
 * passwords here.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cosmos = require('../services/cosmosService');

const router = express.Router();

// CREATE / UPSERT
router.post('/', async (req, res, next) => {
    try {
        const { email, displayName, university, course } = req.body;
        if (!email || !displayName) {
            return res.status(400).json({ error: 'email and displayName are required.' });
        }
        const user = {
            id: uuidv4(),
            email: email.trim().toLowerCase(),
            displayName: displayName.trim(),
            university: university || '',
            course: course || '',
            createdAt: new Date().toISOString()
        };
        const { resource } = await cosmos.container('users').items.upsert(user);
        res.status(201).json(resource);
    } catch (err) {
        next(err);
    }
});

// LIST
router.get('/', async (_req, res, next) => {
    try {
        const { resources } = await cosmos.container('users').items
            .query('SELECT * FROM c').fetchAll();
        res.json({ count: resources.length, users: resources });
    } catch (err) {
        next(err);
    }
});

// READ ONE
router.get('/:id', async (req, res, next) => {
    try {
        const { resource } = await cosmos.container('users')
            .item(req.params.id, req.params.id).read();
        if (!resource) return res.status(404).json({ error: 'User not found.' });
        res.json(resource);
    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'User not found.' });
        next(err);
    }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
    try {
        await cosmos.container('users').item(req.params.id, req.params.id).delete();
        res.status(204).send();
    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'User not found.' });
        next(err);
    }
});

module.exports = router;
