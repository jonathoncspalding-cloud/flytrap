# iOS Shortcut: Capture to Forecaster

A quick-capture shortcut for sending URLs to the Cultural Forecaster Evidence Log directly from iPhone/iPad.

## Shortcut Flow

```
1. Share Sheet trigger (URL input)
   ↓
2. "Assign to Trend?" — Text Input prompt
   (user types partial trend name, or leaves blank)
   ↓
3. [If trend name entered] → GET /api/trends
   → Filter trends by name (fuzzy match)
   → Show "Choose Trend" menu from filtered list
   → User selects trend ID
   ↓
4. "Notes?" — Text Input prompt (optional)
   ↓
5. POST /api/capture → Forecaster
   ↓
6. Notification: "Evidence captured ✅" or "Failed ❌"
```

## Shortcut Variables

Set these as Text variables at the top of the shortcut:
- `forecasterUrl` — e.g., `https://your-forecaster.vercel.app`
- `forecasterSecret` — your FORECASTER_API_SECRET (leave blank if not set)

## Steps in Shortcuts App

### Step 1: Get Current URL
- Action: **Receive** [URL] from **Share Sheet**
- Variable: `sharedURL`

### Step 2: Ask for trend (optional)
- Action: **Ask for Input**
  - Question: "Assign to Forecaster trend? (type name or leave blank)"
  - Input type: Text
  - Default answer: (empty)
- Variable: `trendQuery`

### Step 3: Fetch matching trends (if trendQuery is not empty)
- Action: **If** `trendQuery` is not empty
  - **Get Contents of URL**
    - URL: `[forecasterUrl]/api/trends`
    - Method: GET
    - Headers: `Authorization: Bearer [forecasterSecret]`
  - Variable: `trendsResponse`

  - **Get Dictionary from Input**: `trendsResponse`
  - **Get Dictionary Value**: key `trends` → Variable: `trendsList`

  - **Filter Files** (or use Repeat with list to filter):
    Filter `trendsList` where `name` contains `trendQuery`
  - Variable: `matchingTrends`

  - **Choose from List**: `matchingTrends` (display `name`)
  - Variable: `selectedTrend`

  - **Get Dictionary Value**: `selectedTrend` key `id` → Variable: `trendId`
- **Otherwise**: Set `trendId` = (empty)
- **End If**

### Step 4: Ask for notes
- Action: **Ask for Input**
  - Question: "Quick notes? (optional)"
  - Input type: Text
  - Default answer: (empty)
- Variable: `userNotes`

### Step 5: Detect platform
- Action: **If** `sharedURL` contains `reddit.com`
  - Set `platform` = `Reddit`
- **Otherwise If** `sharedURL` contains `tiktok.com`
  - Set `platform` = `Social`
- **Otherwise If** `sharedURL` contains `twitter.com` or `x.com`
  - Set `platform` = `Social`
- **Otherwise**
  - Set `platform` = `Web`
- **End If**

### Step 6: Get page title (optional, nice-to-have)
- Action: **Get Contents of URL**: `sharedURL`
- Action: **Get Details of Web Page** → Title
- Variable: `pageTitle`
- (Wrap in error handling — some URLs won't return a clean title)

### Step 7: POST to Forecaster
- Action: **Get Contents of URL**
  - URL: `[forecasterUrl]/api/capture`
  - Method: POST
  - Headers:
    - `Content-Type: application/json`
    - `Authorization: Bearer [forecasterSecret]`
  - Request Body: JSON
    ```json
    {
      "title": "[pageTitle or sharedURL]",
      "url": "[sharedURL]",
      "summary": "[userNotes]",
      "platform": "[platform]",
      "trendId": "[trendId]"
    }
    ```
- Variable: `captureResponse`

### Step 8: Notify
- Action: **Get Dictionary Value**: `captureResponse` key `success`
- **If** success is true:
  - **Show Notification**: "✅ Captured to Forecaster" with `[pageTitle]`
- **Otherwise**:
  - **Show Notification**: "❌ Forecaster capture failed"
- **End If**

---

## Quick Version (No Trend Selection)

For a faster version that just captures without trend assignment (useful for rapid collection):

1. Receive URL from Share Sheet
2. Optional: Ask for quick notes
3. POST to `/api/capture` with just `title`, `url`, `summary`, `platform`
4. Notify

Unlinked evidence will be picked up by the signal processor in the next pipeline run and scored/assigned to trends automatically.

---

## Deployment

1. Create the shortcut in the **Shortcuts** app on iPhone
2. Set it as a **Share Sheet** action (appears in the share sheet for any URL)
3. Add to Home Screen for quick access

No additional API setup needed beyond configuring the Forecaster URL and secret.
