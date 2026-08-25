# Facebook / Meta Graph API Setup

The app never scrapes the GVS Facebook Page. All content comes through the
official Meta Graph API and Webhooks. The Page Access Token lives only on
the server (`server/services/facebookService.js`); the mobile/web client
only ever calls our own `/api/facebook/feed`.

## What the GVS Page administrator must do

1. **Create/confirm a Meta App** at https://developers.facebook.com/apps.
2. **Generate a Page Access Token** for Page ID `61592435229097` with at
   least the `pages_read_engagement` permission (add `pages_show_list` if
   generating via a User token first). For production, exchange it for a
   **long-lived Page token** (Meta's tokens don't expire for Pages once
   long-lived, but rotate periodically as a security practice).
3. **Note the current Graph API version** (e.g. `v21.0`) from the Meta
   changelog — Meta deprecates versions on a schedule.
4. Set on the server (never in the client):
   ```
   PAGE_ID=61592435229097
   META_GRAPH_VERSION=v21.0   # use whatever is current at deploy time
   PAGE_ACCESS_TOKEN=<the token>
   ```
5. **App Review**: if the token is a User-linked token from an app not yet
   reviewed, Meta may restrict access to public Page data. For a Page the
   business fully owns, a System User token (Meta Business Suite → Business
   Settings → System Users) generally avoids the App Review requirement for
   reading your own Page's feed — confirm current Meta policy at deploy time.

## Webhooks (for near-real-time updates)

1. In the Meta App dashboard, add the **Webhooks** product, subscribe to
   the **Page** object, and pick fields like `feed`.
2. Set a callback URL: `https://<your-domain>/webhooks/facebook`.
3. Choose a **Verify Token** — any random string — and set it as
   `WEBHOOK_VERIFY_TOKEN` on the server. Meta will call
   `GET /webhooks/facebook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
   and our server must echo back `hub.challenge` when the token matches
   (already implemented).
4. Copy the App Secret from **App Settings → Basic** into `META_APP_SECRET`.
   Every `POST /webhooks/facebook` is verified against the
   `X-Hub-Signature-256` header using this secret before it's trusted.
5. Subscribe the **Page** to the app (Page Settings → Webhooks, or via the
   `/{page-id}/subscribed_apps` Graph API call) — the App-level subscription
   alone is not enough.

## Behavior without credentials

- No `PAGE_ACCESS_TOKEN`/`META_GRAPH_VERSION` → `/api/facebook/feed` returns
  `configured:false` and the app shows: *"Official Facebook updates will
  appear here when the GVS Page connection is activated."* plus a link to
  the live Facebook Page. Nothing is faked.
- No `WEBHOOK_VERIFY_TOKEN`/`META_APP_SECRET` → the webhook routes respond
  `503` and log a warning; they never silently pretend to work.

## Caching, rate limits, retries

- Successful fetches are cached in-memory and persisted to
  `server/data/fbCache.json` for 2 minutes, so repeated app opens don't
  hammer the Graph API.
- On a `429`/rate-limit response, the fetch retries up to 3 times with
  exponential backoff.
- If Meta is unreachable and a cache exists, the API returns
  `status:"stale_cache"` with *"Showing recently cached GVS updates."*
  If there is no cache at all, it returns `status:"error"` with
  *"Live Facebook updates are temporarily unavailable."* and a link to open
  Facebook directly. The app never crashes on Facebook failures.
