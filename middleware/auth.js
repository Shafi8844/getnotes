/**
 * JWT authentication middleware.
 *
 * requireAuth  – blocks unauthenticated requests (401)
 * optionalAuth – populates req.user if a valid token is present, otherwise null
 *
 * Token is read from the Authorization: Bearer <token> header.
 * JWT_SECRET must be set in production via App Service environment variables.
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function extractToken(req) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    return null;
}

function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token. Please sign in again.' });
    }
}

function optionalAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) { req.user = null; return next(); }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    } catch {
        req.user = null;
    }
    next();
}

module.exports = { requireAuth, optionalAuth };
