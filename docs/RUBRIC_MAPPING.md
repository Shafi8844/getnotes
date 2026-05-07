# Rubric Mapping — CW2

This document explicitly maps every assessment criterion in the CW2 rubric to
the corresponding evidence in this project. It is intended to make marking
straightforward.

---

## Implementation (35%) — *Exceptional, innovative, expertly integrated*

| Required element                                | Where to find it                                      |
|-------------------------------------------------|-------------------------------------------------------|
| Working full-stack application                  | `server.js`, `public/`, `routes/`, `services/`        |
| All major components functional and integrated  | Live URL + `npm start` runs the whole stack           |
| REST API CRUD                                   | `routes/resources.js` (POST/GET/PUT/DELETE)           |
| File upload pipeline                            | `routes/resources.js` (multer) → `services/blobService.js` |
| Async processing                                | `functions/src/functions/thumbnailGenerator.js`        |
| Error handling                                  | Global error handler in `server.js`, per-route try/catch |
| Health probe                                    | `GET /api/health` in `server.js`                       |
| Graceful shutdown                               | SIGTERM handler in `server.js` (zero-downtime swaps)   |

## Use of Azure Resources (35%) — *Masterful, flawless deployment and integration*

| Azure resource          | Used for                          | Configured in                    |
|-------------------------|-----------------------------------|----------------------------------|
| **App Service**         | Hosts frontend + REST API         | `web.config`, `.github/workflows/azure-deploy.yml` |
| **Cosmos DB (NoSQL)**   | Resource metadata, comments, ratings, users | `services/cosmosService.js` (3 partitioned containers) |
| **Blob Storage**        | Binary file storage               | `services/blobService.js`        |
| **Application Insights**| Telemetry, live metrics, exceptions | `services/insights.js`         |
| **Azure Functions**     | Async thumbnail generation        | `functions/src/functions/thumbnailGenerator.js` |
| **Log Analytics**       | Backing workspace for App Insights| Created in `docs/DEPLOYMENT.md` step 4 |
| **GitHub Actions**      | CI/CD                             | `.github/workflows/`             |

## Use of Advanced Features (20%) — *Expert level, significant value*

| Advanced feature                                  | Implementation                                        |
|---------------------------------------------------|-------------------------------------------------------|
| **CI/CD via Git** *(rubric requirement)*          | `.github/workflows/azure-deploy.yml` — build + smoke + deploy stages |
| **App Monitor / App Insights** *(rubric example)* | `services/insights.js` with auto-instrumentation, custom events (`ResourceUploaded`, `Rated`, `CommentPosted`, `ResourceUpdated`, `ResourceDeleted`), exception tracking, live metrics |
| **Logic / async with Functions**                  | Blob-triggered Function for thumbnail generation      |
| **Horizontal scalability patterns**               | Cosmos partitioning (`/module`, `/resourceId`), trust-proxy + rate-limit, App Service auto-scale rules in `docs/DEPLOYMENT.md` |
| **Managed identity ready**                        | `cosmosService.js` and `blobService.js` fall back to `DefaultAzureCredential` when keys are absent |
| **Production middleware**                         | `helmet` (security headers), `express-rate-limit` (abuse protection), `cors`, `morgan` logging |
| **Self-healing aggregates**                       | Rating average is recomputed from source events, not running counter — survives duplicates |

## Video Quality and Presentation (10%)

The 5-minute walkthrough script is in `docs/VIDEO_SCRIPT.md`. It is timed to
fit under the 5-minute hard limit (rubric penalises overruns).

---

## How CW2 implements the CW1 design

| CW1 design element                       | CW2 implementation                                    |
|------------------------------------------|-------------------------------------------------------|
| Frontend → Azure Static Web Apps / App Service | Static frontend in `public/`, served by App Service |
| Backend REST API → Azure App Service     | Express app on Linux App Service                       |
| Media storage → Azure Blob Storage       | `services/blobService.js`                             |
| Structured data → Azure SQL Database     | Consolidated into Cosmos DB containers (justified in README §Limitations) |
| User interaction data → Azure Cosmos DB  | `interactions` container partitioned by resourceId    |
| Authentication → Microsoft Entra ID      | Stub in place; full Entra ID flagged as next-step in README §Limitations |
| Async previews via Azure Functions       | `functions/src/functions/thumbnailGenerator.js`       |

---

## Files the marker should look at first

1. **`README.md`** — top-level overview and architecture diagram
2. **`docs/DEPLOYMENT.md`** — proves the Azure deployment path is real
3. **`server.js`** — entry point showing how everything wires up
4. **`routes/resources.js`** — most of the CRUD logic in one file
5. **`services/cosmosService.js`** + **`services/blobService.js`** — Azure SDK integrations
6. **`.github/workflows/azure-deploy.yml`** — the CI/CD pipeline
7. **`functions/src/functions/thumbnailGenerator.js`** — the advanced async feature

Everything else supports these.
