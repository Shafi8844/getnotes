/**
 * /api/auth
 *
 *  POST /api/auth/register   – create a new account
 *  POST /api/auth/login      – sign in, returns JWT
 *  GET  /api/auth/me         – return current user (requires token)
 */
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const cosmos   = require('../services/cosmosService');
const insights = require('../services/insights');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

// ===== POST /api/auth/register =====
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'name, email and password are required.' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Check if email already exists
        const existing = await cosmos.container('users').items.query({
            query: 'SELECT c.id FROM c WHERE c.email = @email',
            parameters: [{ name: '@email', value: email.toLowerCase() }]
        }).fetchAll();

        if (existing.resources.length) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = {
            id:           uuidv4(),
            name:         name.trim(),
            email:        email.toLowerCase().trim(),
            passwordHash,
            createdAt:    new Date().toISOString()
        };

        await cosmos.container('users').items.create(user);
        insights.trackEvent('UserRegistered', { email: user.email });

        const token = signToken(user);
        res.status(201).json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        next(err);
    }
});

// ===== POST /api/auth/login =====
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required.' });
        }

        const { resources } = await cosmos.container('users').items.query({
            query: 'SELECT * FROM c WHERE c.email = @email',
            parameters: [{ name: '@email', value: email.toLowerCase() }]
        }).fetchAll();

        const user = resources[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        insights.trackEvent('UserLogin', { email: user.email });

        const token = signToken(user);
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        next(err);
    }
});

// ===== GET /api/auth/me =====
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
