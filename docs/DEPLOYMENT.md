# Azure Deployment Guide — GetNotes

This guide walks you through deploying GetNotes to Azure end-to-end. Follow it
in order. Every step assumes you are signed into the Azure Portal at
<https://portal.azure.com> with an account that has an active subscription
(the Azure for Students subscription works fine for everything here).

> **Time:** roughly 45–60 minutes the first time. About a quarter of that
> for repeat deployments thanks to GitHub Actions CI/CD.

---

## 0. One-time prep

Install these locally:

- Node.js 20+ (`node -v`)
- Git (`git --version`)
- VS Code with the **Azure App Service** extension
- Azure CLI (optional but useful): <https://aka.ms/installazurecli>

Then:

```bash
git clone <your-repo-url> getnotes
cd getnotes
npm install
cp .env.example .env
```

Don't fill `.env` yet — we'll get the values from Azure as we create resources.

---

## 1. Create a resource group

A resource group is a logical container that lets you delete everything in
one go later.

1. Portal → **Resource groups** → **+ Create**.
2. **Subscription:** your subscription.
3. **Resource group name:** `getnotes-rg`.
4. **Region:** UK South (or whichever is closest to you — keep it consistent
   for everything below).
5. **Review + create** → **Create**.

---

## 2. Create the Cosmos DB account

1. Portal → **+ Create a resource** → search "Azure Cosmos DB" → **Create**.
2. API: **Azure Cosmos DB for NoSQL** → **Create**.
3. Settings:
   - **Resource group:** `getnotes-rg`
   - **Account name:** something globally unique, e.g. `getnotes-cosmos-shafi`
   - **Location:** same region as the resource group
   - **Capacity mode:** **Serverless** (cheapest for coursework). If your
     subscription doesn't support Serverless in your region, choose
     "Provisioned throughput" with the **Apply Free Tier discount** toggle on.
4. **Review + create** → **Create**. Wait ~5 minutes for deployment.
5. Open the new Cosmos account → **Keys** (left menu, under Settings).
6. Copy:
   - **URI**  →  paste into `.env` as `COSMOS_ENDPOINT`
   - **PRIMARY KEY**  →  paste into `.env` as `COSMOS_KEY`

> The app creates the database (`getnotes`) and the three containers
> (`resources`, `interactions`, `users`) on first boot — you don't need to
> create them manually.

---

## 3. Create the Storage Account (for Blob Storage)

1. Portal → **+ Create a resource** → "Storage account" → **Create**.
2. Settings:
   - **Resource group:** `getnotes-rg`
   - **Storage account name:** globally unique, lowercase, 3–24 chars,
     e.g. `getnotesfilesshafi`
   - **Region:** same region
   - **Performance:** Standard
   - **Redundancy:** LRS (cheapest)
3. **Review + create** → **Create**. Wait ~2 minutes.
4. Open the storage account → **Access keys** (left menu, under Security + networking).
5. Click **Show** next to *key1* → copy the **Connection string**.
6. Paste into `.env` as `AZURE_STORAGE_CONNECTION_STRING`.

> The `resources` blob container is created automatically by the app on first
> boot, with public-read access on individual blobs so they render directly
> in `<img>` / `<video>` / `<iframe>` tags.

---

## 4. Create Application Insights

1. Portal → **+ Create a resource** → "Application Insights" → **Create**.
2. Settings:
   - **Resource group:** `getnotes-rg`
   - **Name:** `getnotes-insights`
   - **Region:** same region
   - **Resource Mode:** Workspace-based (default)
   - **Log Analytics Workspace:** click *Create new* if none exists
3. **Review + create** → **Create**.
4. Open the new Application Insights resource → **Overview**.
5. Copy the **Connection String** from the top right.
6. Paste into `.env` as `APPLICATIONINSIGHTS_CONNECTION_STRING`.

---

## 5. Test locally

Now `.env` has all the credentials. Run:

```bash
npm start
```

You should see:

```
[insights] Application Insights started.
[cosmos] Database "getnotes" ready with containers: resources, interactions, users
[blob] Container "resources" ready.
GetNotes server listening on port 8080
```

Open <http://localhost:8080>, upload a test PDF or image and verify the card
appears. If anything fails here, fix it before continuing — debugging is much
easier locally.

---

## 6. Push to GitHub

If you don't already have the project in GitHub:

```bash
git init
git add .
git commit -m "Initial commit: GetNotes"
git branch -M main
git remote add origin https://github.com/<your-username>/getnotes.git
git push -u origin main
```

> **Important:** verify that `.env` is in `.gitignore` and was *not* pushed.
> Connection strings in a public repo would let anyone use your Azure
> resources at your expense.

---

## 7. Create the App Service

1. Portal → **+ Create a resource** → "Web App" → **Create**.
2. Settings:
   - **Resource group:** `getnotes-rg`
   - **Name:** globally unique, e.g. `getnotes-web-shafi`
     (this becomes `https://getnotes-web-shafi.azurewebsites.net`)
   - **Publish:** Code
   - **Runtime stack:** Node 20 LTS
   - **Operating System:** Linux
   - **Region:** same region
   - **Pricing plan:** create a new App Service Plan; pick **Free F1** for
     development or **Basic B1** for marking (B1 doesn't sleep on idle).
3. **Review + create** → **Create**. Wait ~2 minutes.

### Configure environment variables

1. Open the App Service → **Settings → Environment variables** (left menu).
2. Click **+ Add** and add each of these one at a time:

| Name | Value |
|------|-------|
| `COSMOS_ENDPOINT` | (from step 2) |
| `COSMOS_KEY` | (from step 2) |
| `COSMOS_DB_NAME` | `getnotes` |
| `AZURE_STORAGE_CONNECTION_STRING` | (from step 3) |
| `BLOB_CONTAINER_NAME` | `resources` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | (from step 4) |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |

3. Click **Apply** → **Confirm**. The app will restart.

> The last two App Service-specific settings tell Oryx (the Linux App
> Service build engine) to install npm dependencies on deploy.

---

## 8. Set up CI/CD (GitHub Actions)

1. In the App Service → **Overview** → top toolbar → **Get publish profile**.
   Save the file.
2. Open the file in a text editor → **copy the entire XML contents**.
3. In your GitHub repo → **Settings → Secrets and variables → Actions →
   New repository secret**:
   - **Name:** `AZURE_WEBAPP_PUBLISH_PROFILE`
   - **Secret:** paste the XML
   - **Add secret**.
4. Open `.github/workflows/azure-deploy.yml` in your repo → change
   `AZURE_WEBAPP_NAME: getnotes-web` to the actual name you used (e.g.
   `getnotes-web-shafi`). Commit and push:

```bash
git add .github/workflows/azure-deploy.yml
git commit -m "ci: set App Service name"
git push
```

5. Watch the deployment under your repo's **Actions** tab. Both jobs (build
   and deploy) should turn green within ~3 minutes.

6. Open `https://<your-app-name>.azurewebsites.net` — the GetNotes UI should
   load. Try `https://<your-app-name>.azurewebsites.net/api/health` to
   confirm the API.

---

## 9. (Advanced) Deploy the Azure Function

The blob-triggered thumbnail generator in `functions/` is an optional advanced
feature. To deploy it:

1. Portal → **+ Create a resource** → "Function App" → **Create**.
   - **Name:** `getnotes-fn-shafi`
   - **Runtime stack:** Node 20 LTS
   - **OS:** Linux
   - **Plan:** Consumption (Serverless)
   - **Storage account:** select the one you created in step 3
   - **Application Insights:** select the one from step 4
2. After creation, open the Function App → **Get publish profile** → copy XML.
3. In GitHub → add secret `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`.
4. Edit `.github/workflows/azure-functions-deploy.yml` →
   `AZURE_FUNCTIONAPP_NAME: getnotes-fn-shafi`. Commit + push.
5. The function deploys via the workflow. Now: upload an image through the
   GetNotes UI → within seconds, a thumbnail appears in the `thumbnails`
   container of your storage account (visible in **Storage Browser**).

---

## 10. (Advanced) Auto-scale rules

To demonstrate horizontal scalability in the video:

1. App Service → **Settings → Scale out (App Service plan)**.
2. **Custom autoscale** → **Add a rule**:
   - Metric: CPU percentage
   - Threshold: 70%
   - Action: Increase by 1
3. Add a second rule for CPU < 30% → Decrease by 1.
4. Set instance limits: **min 1, max 3, default 1**.

> Free F1 doesn't support auto-scale; use B1 or above.

---

## 11. Verify the deployment

Run through this checklist before recording the marking video:

- [ ] `https://<app>.azurewebsites.net` loads the GetNotes UI
- [ ] `/api/health` returns `{"status":"healthy", ...}`
- [ ] Upload a PDF — appears as a card on the home page
- [ ] Upload an image — preview renders in the detail view
- [ ] Posting a comment + rating updates the detail view
- [ ] Deleting a resource removes it from both the UI and the Storage container
- [ ] App Insights → **Live Metrics** shows traffic when you click around
- [ ] App Insights → **Logs** → run `requests | take 50` returns rows
- [ ] GitHub Actions: making a code change and pushing redeploys automatically
- [ ] Storage account → `resources` container has your uploads
- [ ] Cosmos account → Data Explorer → `getnotes` → `resources` shows metadata

If all 10 boxes are checked, you have a strong CW2 submission. Record the
walkthrough using the script in `docs/VIDEO_SCRIPT.md`.

---

## Common issues

**App Service shows "Application Error"**
Open **Log stream** in the App Service. Usually missing env var, or the
Cosmos/Blob credentials are wrong. Fix the env var → restart the app.

**`MODULE_NOT_FOUND` on Linux App Service**
Ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is set so Oryx runs `npm install`.

**CORS errors when frontend and API are on different domains**
The default config in this app sets `ALLOWED_ORIGINS=*`. To restrict it,
set `ALLOWED_ORIGINS=https://your-frontend.azurewebsites.net` in App Service
env vars.

**File upload fails with 413**
Files over 100 MB are rejected by both multer and `web.config`. To raise
the limit, edit both `routes/resources.js` (multer config) and `web.config`
(`<requestLimits maxAllowedContentLength=...>`).

**Blob URLs return 404 in the browser**
Confirm the container access level is **Blob** (anonymous read for blobs
only), not Private. The app sets this on first boot, but if you created
the container manually it may be Private.

---

## Cleanup

To avoid charges after submission:

```bash
az group delete --name getnotes-rg --yes --no-wait
```

Or in the portal: **Resource groups** → `getnotes-rg` → **Delete**.
