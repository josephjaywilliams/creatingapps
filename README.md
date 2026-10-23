# creatingapps

Apps built in about a minute with Claude Code, each hosted for free on GitHub Pages.

**Gallery:** https://josephjaywilliams.github.io/creatingapps/

| App | What it is |
|---|---|
| [`oneminapp1`](oneminapp1/) | **One Minute**: sign up for one one-minute health action a day by email, based on [Designing for the Moment](https://arxiv.org/abs/2605.29051). Live at https://josephjaywilliams.github.io/creatingapps/oneminapp1/ |

## How it works

- Each app is a top-level folder with an `index.html` and an `app.json`.
- On every change to `main`, `.github/workflows/deploy.yml` runs `scripts/build_site.py`, which builds
  the gallery and publishes every app.
- `CLAUDE.md` tells Claude Code how to build apps here, so anyone can type `/new-app <idea>`.

## Adding a teammate

1. Joseph: **Settings → Collaborators → Add people** and invite their GitHub username.
2. Teammate: accept, connect GitHub at claude.ai/code, start a session on `josephjaywilliams/creatingapps`,
   and type `/new-app <idea>`.
