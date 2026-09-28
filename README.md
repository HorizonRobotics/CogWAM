# CogWAM — Project Website

Project page for **CogWAM: Aligning Semantic Cognition with World Action Modeling
via Event-Driven Interfaces**.

**Live site:** https://horizonrobotics.github.io/CogWAM/

| Resource | Status |
| --- | --- |
| Model checkpoint | [HorizonRobotics/CogWAM](https://huggingface.co/HorizonRobotics/CogWAM) on Hugging Face |
| Paper (arXiv) | Not released yet |
| Training code | Not released yet |

## What's in here

This is a **plain static site** — HTML, CSS and vanilla JS, no framework, no
build step, no dependency install.

```
index.html                 single page; site links are configured in the
                           window.COGWAM_SITE_CONFIG block at the top
css/style.css
js/main.js                 renders the result tables and the video galleries
data/*.json                video manifests fetched at runtime
assets/figures/            paper figures
assets/posters/            video poster frames
assets/videos/             demo clips (real robot + RoboDojo rollouts)
assets/favicon.svg
```

All asset references are **relative**, so the site works unchanged whether it is
served from a domain root or from a `/CogWAM/` subpath.

## Local development

No toolchain needed — just serve the folder over HTTP (opening `index.html`
via `file://` will not work, because `js/main.js` fetches `data/*.json`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Deployment (GitHub Pages)

The site is served directly from the `gh-pages` branch, no Actions build required:

**Settings → Pages → Source: "Deploy from a branch" → Branch: `gh-pages` / `/ (root)`**

Published at https://horizonrobotics.github.io/CogWAM/ a minute or two after each push
to `gh-pages`.

## Updating the video galleries

`data/robodojo_videos.json` and `data/real_robot_videos.json` list each clip's
`web_path`, `poster_path` and metadata. Add or edit entries there; `js/main.js`
picks them up on load with no other changes.
