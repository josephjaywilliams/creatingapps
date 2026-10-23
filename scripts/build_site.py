#!/usr/bin/env python3
"""Build the GitHub Pages site: copy every top-level app folder (one with an app.json)
into _site/<slug>/ and generate a gallery at _site/index.html."""
import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT
SITE = ROOT / "_site"
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# Kept out of the hosted site: notes, metadata, and server code.
PRIVATE = {"MARKETING.md", "app.json", "backend"}


def load_apps():
    apps, errors = [], []
    for folder in sorted(p for p in APPS.iterdir() if (p / "app.json").is_file()):
        slug = folder.name
        if not SLUG.match(slug):
            errors.append(f"{slug}: folder name must be lowercase-with-hyphens")
            continue
        if not (folder / "index.html").is_file():
            errors.append(f"{slug}: missing index.html")
            continue
        try:
            meta = json.loads((folder / "app.json").read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{slug}: app.json is not valid JSON ({e})")
            continue
        apps.append({
            "slug": slug,
            "name": meta.get("name") or slug.replace("-", " ").title(),
            "description": meta.get("description", ""),
            "author": meta.get("author", ""),
            "created": meta.get("created", ""),
        })
    return apps, errors


def gallery(apps):
    apps = sorted(apps, key=lambda a: a["created"], reverse=True)
    cards = "\n".join(
        f"""      <a class="card" href="./{a['slug']}/">
        <h2>{html.escape(a['name'])}</h2>
        <p>{html.escape(a['description'])}</p>
        <span class="meta">{html.escape(' · '.join(x for x in (a['author'], a['created']) if x))}</span>
      </a>"""
        for a in apps
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>One Minute Apps</title>
  <style>
    :root {{ --bg:#fafaf7; --fg:#1d1d1b; --muted:#6b6b66; --card:#fff; --line:#e4e4de; --accent:#d9572b; }}
    @media (prefers-color-scheme: dark) {{
      :root {{ --bg:#161614; --fg:#f0efe9; --muted:#a3a39b; --card:#20201d; --line:#33332f; --accent:#f07a4f; }}
    }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, sans-serif; }}
    main {{ max-width:960px; margin:0 auto; padding:48px 16px; }}
    h1 {{ margin:0 0 4px; font-size:2rem; }}
    .sub {{ color:var(--muted); margin:0 0 32px; }}
    .grid {{ display:grid; gap:16px; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); }}
    .card {{ display:block; padding:20px; background:var(--card); border:1px solid var(--line);
             border-radius:12px; color:inherit; text-decoration:none; transition:border-color .15s; }}
    .card:hover {{ border-color:var(--accent); }}
    .card h2 {{ margin:0 0 6px; font-size:1.1rem; }}
    .card p {{ margin:0 0 12px; color:var(--muted); }}
    .meta {{ font-size:.85rem; color:var(--muted); }}
  </style>
</head>
<body>
  <main>
    <h1>One Minute Apps</h1>
    <p class="sub">{len(apps)} app{'s' if len(apps) != 1 else ''}, each built in about a minute with Claude Code.</p>
    <div class="grid">
{cards}
    </div>
  </main>
</body>
</html>
"""


def main():
    apps, errors = load_apps()
    for e in errors:
        print(f"::warning::{e} (skipped)")
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()
    for a in apps:
        shutil.copytree(APPS / a["slug"], SITE / a["slug"],
                        ignore=lambda _d, names: [n for n in names if n in PRIVATE])
    (SITE / "index.html").write_text(gallery(apps))
    print(f"Built {len(apps)} app(s) into {SITE.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
