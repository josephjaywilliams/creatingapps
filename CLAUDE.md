# creatingapps

Joseph Jay Williams's hub for apps built quickly with Claude Code. Each app is a top-level folder;
GitHub Pages hosts them all with a gallery.

Gallery:  https://josephjaywilliams.github.io/creatingapps/
Each app: https://josephjaywilliams.github.io/creatingapps/<slug>/

## Making an app

When someone describes an app idea, build it like this (or run `/new-app <idea>`):

1. Pick a short slug: lowercase words joined by hyphens or digits (`oneminapp2`, `tip-splitter`).
   Check that the folder doesn't already exist.
2. Create `<slug>/index.html`, a static page:
   - Plain HTML/CSS/JS, no build step. Libraries only from a CDN (cdnjs, jsdelivr, unpkg) with pinned versions.
   - Works on phones (viewport meta, no horizontal scroll) and in light and dark mode.
   - Relative paths only, since the app is served from a subfolder.
   - No API keys or secrets in the code: the repo is public.
   - If the app must store data shared between people (sign-ups, responses), use a Google Sheet +
     Apps Script backend in `<slug>/backend/` the way `oneminapp1/` does. `backend/` folders are not hosted.
3. Create `<slug>/app.json`:
   ```json
   { "name": "Tip Splitter", "description": "One sentence on what it does.", "author": "<who asked>", "created": "YYYY-MM-DD" }
   ```
4. Create `<slug>/MARKETING.md` (not hosted): a one-line pitch, a LinkedIn post draft (3–6 short lines,
   first person, ends with the live link), and who would want it.
5. Check it locally: `python3 scripts/build_site.py` should list the app with no warnings.
6. Commit only `<slug>/`, push the branch, and open a pull request titled `New app: <Name>`.
   The app goes live about a minute after the pull request is merged into `main`.
7. Tell the person the pull request link, the live URL, and the LinkedIn draft.

Only change files outside the app's folder when someone explicitly asks to change the shared setup.
