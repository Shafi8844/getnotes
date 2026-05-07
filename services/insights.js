/**
 * Application Insights wrapper.
 *
 * Why a wrapper:
 *  - Lets the app run locally without an instrumentation key (no-op start).
 *  - Single import path so route handlers can call trackEvent / trackException
 *    without re-checking whether AI is configured.
 */
let appInsights;
let client = null;

function start() {
    const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
        || process.env.APPINSIGHTS_INSTRUMENTATIONKEY;

    if (!conn) {
        console.warn('[insights] No App Insights connection string set; telemetry disabled.');
        return;
    }

    appInsights = require('applicationinsights');
    appInsights.setup(conn)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true, true)
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(true)
        .start();

    client = appInsights.defaultClient;
    client.context.tags[client.context.keys.cloudRole] = 'getnotes-api';
    console.log('[insights] Application Insights started.');
}

function trackEvent(name, properties = {}) {
    if (client) client.trackEvent({ name, properties });
}

function trackException(error, properties = {}) {
    if (client) client.trackException({ exception: error, properties });
}

function trackMetric(name, value, properties = {}) {
    if (client) client.trackMetric({ name, value, properties });
}

module.exports = { start, trackEvent, trackException, trackMetric };
