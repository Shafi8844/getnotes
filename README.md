# GetNotes — A Cloud-Native Academic Resource Sharing Platform

**Module:** COM682 Cloud Native Development
**Coursework 2 — Project (50%)**
**Author:** MD Shafi Newaj Khan (B00974714)

GetNotes is the implementation of the cloud-native solution designed in CW1.
Students upload lecture notes, diagrams and tutorial videos; metadata is stored
in **Azure Cosmos DB**, files in **Azure Blob Storage**, and the platform is
hosted on **Azure App Service** with **Application Insights** for monitoring
and a **GitHub Actions** CI/CD pipeline.

---

## Architecture

```
                ┌─────────────────────────────────────────────────┐
                │                  USERS / BROWSER                │
                └──────────────────────┬──────────────────────────┘
                                       │ HTTPS
                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │  Azure App Service  ◄── GitHub Actions CI/CD          │
        │  (Node.js 20 + Express)                               │
        │  • Static frontend  (/public)                         │
        │  • REST API         (/api/resources, /api/interactions│
        │                       /api/users)                     │
        └────────┬────────────────────┬───────────────┬─────────┘
                 │                    │               │
                 ▼                    ▼               ▼
       ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐
       │  Cosmos DB        │  │  Blob Storage    │  │ App Insights    │
       │  (NoSQL metadata) │  │  (binary files)  │  │ (telemetry +    │
       │  • resources      │  │  • resources/    │  │  live metrics)  │
       │  • interactions   │  │  • thumbnails/   │  │                 │
       │  • users          │  │                  │  │                 │
       └───────────────────┘  └─────────┬────────┘  └─────────────────┘
                                        │ blob trigger
                                        ▼
                               ┌──────────────────┐
                               │  Azure Functions  │
                               │  (thumbnailer)    │
                               └──────────────────┘
```

---

## Azure resources used

| # | Service                  | Purpose                                                |
|---|--------------------------|--------------------------------------------------------|
| 1 | **App Service**          | Hosts the Node/Express app (frontend + REST API)       |
| 2 | **Cosmos DB (NoSQL)**    | Stores resource metadata, comments, ratings, users     |
| 3 | **Blob Storage**         | Stores binary files (PDF, images, video)               |
| 4 | **Application Insights** | Telemetry, live metrics, dependency tracking, exceptions |
| 5 | **Azure Functions**      | Async thumbnail generation (blob-triggered)            |
| 6 | **GitHub Actions**       | CI/CD pipeline → App Service & Function App           |
| 7 | **Log Analytics**        | Backing workspace for App Insights                     |

---

## Project structure

```
getnotes/
├── server.js                     # Express entry point
├── package.json
├── web.config                    # IIS Node config (Windows App Service)
├── .env.example                  # Environment variable template
├── .gitignore
├── routes/
│   ├── resources.js              # /api/resources CRUD
│   ├── interactions.js           # /api/interactions (comments, ratings)
│   └── users.js                  # /api/users
├── services/
│   ├── cosmosService.js          # Cosmos DB client + container init
│   ├── blobService.js            # Blob Storage client + helpers
│   └── insights.js               # App Insights wrapper
├── public/                       # Static frontend served by Express
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── functions/                    # Azure Functions (advanced feature)
│   ├── host.json
│   ├── package.json
│   └── src/functions/
│       └── thumbnailGenerator.js
├── scripts/
│   └── seed.js                   # Demo data seeder
├── .github/workflows/
│   ├── azure-deploy.yml          # CI/CD: App Service
│   └── azure-functions-deploy.yml# CI/CD: Functions
└── docs/
    ├── DEPLOYMENT.md             # Step-by-step Azure deployment
    └── VIDEO_SCRIPT.md           # 5-min walkthrough script
```

---

## REST API

| Method | Endpoint                                    | Description                          |
|--------|---------------------------------------------|--------------------------------------|
| GET    | `/api/health`                               | Health probe                         |
| POST   | `/api/resources`                            | Upload a new resource (multipart)    |
| GET    | `/api/resources`                            | List resources (filter, search)      |
| GET    | `/api/resources/trending`                   | Top-rated resources                  |
| GET    | `/api/resources/:id`                        | Read one (also bumps view count)     |
| PUT    | `/api/resources/:id`                        | Update metadata                      |
| DELETE | `/api/resources/:id`                        | Delete resource (DB + blob)          |
| POST   | `/api/interactions/comments`                | Post a comment                       |
| GET    | `/api/interactions/comments/:resourceId`    | List comments for a resource         |
| DELETE | `/api/interactions/comments/:resourceId/:id`| Delete a comment                     |
| POST   | `/api/interactions/ratings`                 | Submit a 1-5 rating                  |
| POST   | `/api/users`                                | Create / upsert user                 |
| GET    | `/api/users`                                | List users                           |
| GET    | `/api/users/:id`                            | Read user                            |
| DELETE | `/api/users/:id`                            | Delete user                          |

---

## Quick start (local)

```bash
git clone <your-repo-url>
cd getnotes
cp .env.example .env       # then fill in your Azure connection strings
npm install
npm start
```

Open <http://localhost:8080>.

> The app needs real Azure Cosmos and Blob Storage to work. The free
> Cosmos tier (1000 RU/s, 25 GB) and the lowest Blob tier are plenty for
> this coursework.

To pre-populate with sample data:

```bash
npm run seed
```

---

## Deploying to Azure

The complete walkthrough is in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
Summary:

1. Create resource group `getnotes-rg`.
2. Create Cosmos DB (NoSQL API) → copy endpoint + key.
3. Create Storage Account → copy connection string.
4. Create Application Insights → copy connection string.
5. Create App Service (Linux, Node 20) `getnotes-web`.
6. In App Service → **Environment variables**, paste all six of the values above.
7. Push the repo to GitHub. Add `AZURE_WEBAPP_PUBLISH_PROFILE` secret. The
   GitHub Actions workflow deploys on every push to `main`.
8. (Optional) Create a Function App and deploy the thumbnail Function for the
   advanced-features tick.

---

## Advanced features used

The CW2 rubric awards 20% for advanced features. This project ships with:

1. **Application Insights** with auto-instrumentation, custom events
   (`ResourceUploaded`, `Rated`, `CommentPosted`, etc.), exception tracking
   and live metrics.
2. **Azure Functions** with a Blob trigger for async thumbnail generation —
   demonstrates serverless decoupling.
3. **CI/CD pipeline** using GitHub Actions → App Service deployment with
   build, smoke check and zip-deploy stages, plus a separate workflow for
   Functions.
4. **Horizontal scalability** patterns: Cosmos partition keys
   (`/module`, `/resourceId`), App Service auto-scale ready (rule examples
   in `docs/DEPLOYMENT.md`), Blob Storage independent scaling tier.
5. **Managed identity ready**: `cosmosService` and `blobService` both detect
   absent keys and fall back to `DefaultAzureCredential`, so flipping to a
   passwordless production setup is one-line config.
6. **Rate limiting** (`express-rate-limit`) and **security headers**
   (`helmet`) — production-quality middleware.
7. **Graceful shutdown** with SIGTERM handling for zero-downtime
   App Service slot swaps.
8. **Health probe** at `/api/health` for load balancer integration.

---

## Limitations (honest list)

- No authentication enforced on write endpoints. The CW1 design specifies
  Microsoft Entra ID; integrating it is a documented next step but adds
  substantial setup overhead beyond the scope of CW2.
- The blob container is configured `public-read` for simplicity. Switch to
  `private` and use SAS URLs (helper already implemented in
  `services/blobService.js`) for any real deployment.
- No moderation pipeline. CW1 mentions Azure AI Content Safety as a future
  enhancement.
- Cross-partition queries on resource ID are used in PUT/DELETE for UX
  convenience. At very high scale, callers would supply the module
  partition key for point reads.

---

## License

MIT — see source headers.
