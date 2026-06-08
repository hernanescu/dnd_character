# Next session

## Stack
Flask + SQLite, no ORM. Vanilla JS ES modules, no build step. SPA with `?view=new` / `?view=sheet&id=N`.
- `src/app.py` — backend + REST API
- `static/js/builder.js` — 5-step character creation wizard
- `static/js/sheet.js` — 6-tab character sheet
- `data/classes/bard.json` — 144 spells, 8 subclasses, 20 levels (scraped from dnd5e.wikidot.com, English)
- `data/backgrounds.json` — 88 backgrounds (scraped, English)

## Pending tasks

### 1. Translate UI labels to English
Skills in `static/js/sheet.js` (`SKILLS` array) and stat labels are in Spanish (e.g. "Fuerza", "Destreza"). Change all to English ("Strength", "Dexterity", etc.). Same for any hardcoded labels in `builder.js` and `app.css`.

### 2. Spell browser UX
The spells tab in the sheet shows a flat list. Needs:
- Group by spell level (cantrips, 1st, 2nd, …)
- Expand/collapse per level
- On click → show name + school + description inline (description already in `bard.json`)
- Consider scraping higher-quality descriptions if current ones are too short (current cap: 500 chars, field `description` in each spell object)

### 3. General polish
- Spell slot pips feel cramped at high levels; consider a compact row layout
- Builder step 5 (spell selection) has no search/filter — add a text filter input
- Mobile layout review (no media queries yet)

## How to run
```bash
python3 src/app.py          # starts on :5000
# or for playwright testing:
python3 -m pytest tests/    # if tests exist
```

## Key gotcha
`initBuilder()` in `builder.js` reassigns `state = {}` — must also do `window.state = state` right after, otherwise inline `oninput` handlers update a stale reference and inputs get wiped on re-render.
