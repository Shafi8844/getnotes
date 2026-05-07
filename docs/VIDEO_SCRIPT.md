# 5-Minute Video Walkthrough Script — GetNotes CW2

The CW2 rubric awards 10% for video quality and presentation. Within 5
minutes you must show:

> Running application + CRUD via REST → Backend Azure resources, logic apps,
> functions, DB, CI/CD → URIs of Azure resources → Advanced features.

This script keeps you under 5 minutes if you don't linger. **Turn your camera
on** (the rubric explicitly asks for this) and use Panopto Capture from the
Blackboard menu.

> Tip: have all the tabs open before you hit record. Tab-switching eats time.

---

## Tabs to open before recording

1. The deployed GetNotes app: `https://<your-app>.azurewebsites.net`
2. Azure Portal → your **App Service** → **Overview**
3. Azure Portal → your **Cosmos DB** → **Data Explorer**
4. Azure Portal → your **Storage Account** → **Storage browser** → `resources` container
5. Azure Portal → your **Application Insights** → **Live Metrics**
6. Azure Portal → your **Function App** → **Functions** list (if deployed)
7. GitHub repo → **Actions** tab showing the latest green run

Have one image and one PDF ready on your desktop to upload during the demo.

---

## The script

### [0:00 – 0:25]  Intro

> "Hi, I'm MD Shafi Newaj Khan, student number B00974714, and this is the
> implementation of my GetNotes platform for COM682 Coursework 2. GetNotes
> is a cloud-native academic resource sharing app deployed on Microsoft
> Azure. In the next five minutes I'll demo the running app, walk through
> the Azure resources, show CRUD via the REST API, and call out the
> advanced features I've integrated."

*(Keep camera on, smile, sound confident.)*

---

### [0:25 – 1:30]  CRUD demo on the live app

Switch to the live URL.

> "This is the production app at `https://<your-app>.azurewebsites.net`,
> hosted on Azure App Service. The home page lists existing resources from
> Cosmos DB."

**CREATE** — click **Upload**, fill in title "Cloud Native Lecture 6", module
"COM682", pick a PDF, click upload.

> "When I upload, the file goes to Azure Blob Storage and the metadata is
> persisted in Cosmos DB. You'll see the new card appear in the list."

**READ** — click the card you just uploaded.

> "The detail view fetches from `GET /api/resources/:id`, increments the view
> counter in Cosmos, and embeds the PDF preview directly from its Blob
> Storage URL — no file ever touches the App Service local disk."

**UPDATE** — click *Edit metadata*, change the title.

> "PUT request to `/api/resources/:id` patches the document in Cosmos."

**Comments + ratings**

> "Now I'll post a comment and a 5-star rating — these write to the
> `interactions` container, partitioned by resourceId for horizontal scale.
> The rating handler recomputes the average from all rating events to keep
> the trending feed accurate."

**DELETE** — pick an old card, hit Delete, confirm.

> "Delete removes both the metadata row from Cosmos and the file from Blob
> Storage in a single API call."

---

### [1:30 – 2:30]  Azure resources tour

Switch to **App Service → Overview**.

> "This is the App Service. Linux, Node 20, B1 plan. The URL you just saw
> is at the top right. Under **Environment variables** you can see I've
> configured the Cosmos endpoint, the Storage connection string, and the
> Application Insights connection string — *no secrets in source control*."

Switch to **Cosmos DB → Data Explorer**.

> "Cosmos DB, NoSQL API, serverless. Three containers: `resources`
> partitioned by `/module`, `interactions` partitioned by `/resourceId`,
> and `users`. I'll click into `resources` and run a quick query."

Run `SELECT * FROM c` or click the **Items** tab.

> "Here's the document I just uploaded — title, module, the blob URL, file
> size, average rating. All denormalised into a single document, which is
> the NoSQL pattern."

Switch to **Storage browser**.

> "Same file, in the `resources` blob container. Each upload gets a
> UUID-prefixed name so two students can upload `notes.pdf` without
> collision."

---

### [2:30 – 3:30]  REST API + URIs

Pop a terminal or browser tab.

> "Quick proof the REST endpoints work directly. Health check first."

Hit `https://<your-app>.azurewebsites.net/api/health` in the browser.

> "Returns the service status and version. Now the resource list endpoint."

Hit `https://<your-app>.azurewebsites.net/api/resources`.

> "JSON response with the same data you saw in Cosmos. The resource URIs
> are public — `/api/resources/:id`, `/api/interactions/comments/:resourceId`,
> `/api/users/:id`. Full CRUD on each, plus a `/api/resources/trending`
> endpoint that uses a Cosmos aggregate query to return the top-rated 10."

---

### [3:30 – 4:30]  Advanced features

#### CI/CD (15 sec)

Switch to the GitHub **Actions** tab.

> "CI/CD via GitHub Actions. Every push to main triggers a build job — npm
> install, smoke check that the server boots — then a deploy job that
> publishes to App Service using the publish profile. Here's the latest
> green run."

#### Application Insights (20 sec)

Switch to **App Insights → Live Metrics**.

> "Application Insights with auto-instrumentation. Live Metrics shows me
> request rate, dependency calls, failed requests in real-time. I also fire
> custom events from the code — `ResourceUploaded`, `Rated`, `Deleted` —
> visible under Logs."

Click **Logs**, run: `customEvents | take 20` — show the events.

#### Azure Functions (15 sec, if deployed)

Switch to the Function App tab.

> "And an Azure Function with a Blob trigger that watches the resources
> container. When an image goes in, the function generates a 300×300
> thumbnail and writes it to a separate `thumbnails` container. This is
> classic serverless decoupling — the upload request returns instantly,
> thumbnails are produced asynchronously."

Show the `thumbnails` container with a thumbnail blob inside.

---

### [4:30 – 5:00]  Wrap-up

> "Quick recap: App Service hosting a Node REST API + frontend; Cosmos DB
> for metadata with three partitioned containers; Blob Storage for binary
> files; Application Insights for telemetry; an Azure Function for async
> thumbnail generation; and GitHub Actions for continuous deployment.
>
> Full source code, deployment instructions and architecture diagrams are
> in the GitHub repository. Thanks for watching."

*(Stop recording.)*

---

## Time budget

| Segment              | Duration | Cumulative |
|----------------------|----------|------------|
| Intro                | 0:25     | 0:25       |
| CRUD demo            | 1:05     | 1:30       |
| Azure resources tour | 1:00     | 2:30       |
| REST API + URIs      | 1:00     | 3:30       |
| Advanced features    | 1:00     | 4:30       |
| Wrap-up              | 0:30     | 5:00       |

The rubric penalises overruns: 30s–1min over = -10%, >1min over = -20%.
Practise once before recording.

---

## Tips for the recording

- **Speak slightly slower than feels natural.** Nerves make people rush.
- **Show, don't tell.** Click into things rather than narrating from a static page.
- **No coursework slides.** The rubric explicitly says don't reuse CW1 slides.
- **Camera on.** It's required for full marks.
- **One take is fine.** A polished single take is better than a heavily
  edited compilation.

Good luck!
