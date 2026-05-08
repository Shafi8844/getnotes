/**
 * Entra ID auth middleware — designed for App Service Easy Auth.
 *
 * When Easy Auth is enabled on the App Service, authenticated requests
 * carry an X-MS-CLIENT-PRINCIPAL header (base64-encoded JSON). We decode
 * that to identify the user.
 *
 * In local development (no Easy Auth), the middleware falls through in
 * passthrough mode so you can test without credentials.
 */

function parseEasyAuthPrincipal(req) {
    const raw = req.headers['x-ms-client-principal'];
    if (!raw) return null;
    try {
        return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

/**
 * Requires an authenticated user (via Easy Auth session cookie).
 * Returns 401 if the request has no principal header.
 */
function requireAuth(req, res, next) {
    const principal = parseEasyAuthPrincipal(req);

    if (principal) {
        req.user = {
            name:               principal.name || principal.userDetails || 'unknown',
            preferred_username: principal.userDetails || principal.name || 'unknown',
            provider:           principal.identityProvider
        };
        return next();
    }

    // In local dev (no App Service Easy Auth), allow through with a dev identity.
    if (process.env.NODE_ENV !== 'production' && !process.env.REQUIRE_AUTH) {
        req.user = { name: 'dev-user', preferred_username: 'dev@localhost' };
        return next();
    }

    return res.status(401).json({
        error: 'Authentication required. Please sign in with your Microsoft account.'
    });
}

/**
 * Sets req.user if an Easy Auth principal is present, but does not block
 * unauthenticated requests.
 */
function optionalAuth(req, res, next) {
    const principal = parseEasyAuthPrincipal(req);
    if (principal) {
        req.user = {
            name:               principal.name || principal.userDetails || 'unknown',
            preferred_username: principal.userDetails || principal.name || 'unknown'
        };
    } else {
        req.user = null;
    }
    next();
}

module.exports = { requireAuth, optionalAuth };
