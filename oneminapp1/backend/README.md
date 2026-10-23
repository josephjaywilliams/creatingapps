# One Minute backend (Google Sheet + Apps Script)

Sign-ups and responses go into a Google Sheet you own. A small Apps Script attached to it
sends the confirmation email and the daily prompts from your Google account. No server or cost.

## Set up (about 5 minutes, once)

1. Create a new Google Sheet, e.g. "One Minute sign-ups" (https://sheets.new).
2. In the Sheet: **Extensions → Apps Script**. Delete what's in `Code.gs`, paste in the whole of
   [`Code.gs`](Code.gs) from this folder, and click **Save**.
3. In the function menu at the top, pick **setup** and click **Run**. Approve the permissions
   (Google will warn that the app is unverified: **Advanced → Go to … (unsafe)**; it's your own script).
   This creates the `subscribers` and `events` tabs and an hourly trigger that sends prompts.
4. **Deploy → New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Put that URL in [`../config.js`](../config.js) as `BACKEND_URL` (or ask Claude to), and merge.
   The sign-up form switches on once the site redeploys.

## Good to know

- **Sending limit:** a regular Gmail account can email about 100 people a day from Apps Script
  (Google Workspace accounts: about 1,500). That covers ~100 active subscribers.
- **Settings** (optional): Apps Script → Project Settings → Script properties:
  `PROGRAM_DAYS` (default 14), `SENDER_NAME` (default "One Minute"), `SITE_URL`.
- **Your data:** `subscribers` has one row per person (status: pending → active → completed or
  unsubscribed). `events` logs sign-ups, sends, "I did it" taps, and rewritten prompts.
- **Study design:** each person gets one week of immediate-action prompts and one week of
  reflection-first prompts, in random order (the `order` column), like the paper's study.
- **After changing the code:** paste the new `Code.gs`, then **Deploy → Manage deployments → Edit → Version: New version → Deploy**,
  so the URL stays the same.

## Editing prompts

The prompt library is `../prompts.js`, shared by the web page and the emails. After editing it or
`main.gs`, run `python3 backend/build.py` to regenerate `Code.gs`, then paste it into Apps Script again.
