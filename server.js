/**
 * GetNotes - Cloud-Native Academic Resource Sharing Platform
 * Main Express server entry point.
 *
 * IMPORTANT: Application Insights must be loaded BEFORE any other module
 * so that it can auto-instrument http, express, etc.
 */
require('dotenv').config();
const insights = require('./services/insights');
insights.start(); // safe no-op if INSTRUMENTATION KEY is not set

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const resourcesRouter = require('./routes/resources');
const interactionsRouter = require('./routes/interactions');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const cosmos = require('./services/cosmosService');
const blob = require('./services/blobService');

const app = express();
const PORT = process.env.PORT || 8080;

// ----- Security & middleware -----
app.use(helmet({
    // We allow inline scripts in our small frontend; tighten in production.
    contentSecurityPolicy: false
}));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : '*',
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic API rate limit (prevents abuse). App Service trusts proxy headers.
app.set('trust proxy', 1);
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 300,                  // 300 requests / IP / window
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', apiLimiter);

// ----- Static frontend -----
app.use(express.static(path.join(__dirname, 'public')));


// ----- Health probe (used by App Service + load balancers) -----
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'getnotes-api',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});

// ----- API routes -----
app.use('/api/auth', authRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/users', usersRouter);

// ----- 404 for /api/* -----
app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// ----- SPA fallback: any non-API route serves index.html -----
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----- Global error handler -----
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    insights.trackException(err);

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Max 100 MB.' });
    }
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// ----- Boot -----
async function bootstrap() {
    try {
        // Initialise Azure services in parallel — they're independent.
        await Promise.all([cosmos.init(), blob.init()]);
    } catch (err) {
        console.error('Azure init failed:', err.message);
        insights.trackException(err);
        // We still start the HTTP server so /api/health responds with the
        // current state — easier to diagnose than a process that won't boot.
    }

    const server = app.listen(PORT, () => {
        console.log(`GetNotes server listening on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown for Azure App Service deployments / slot swaps
    const shutdown = (signal) => {
        console.log(`${signal} received, closing server...`);
        server.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
        // Force-exit fallback so a hung connection cannot block the swap forever.
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();

module.exports = app;
