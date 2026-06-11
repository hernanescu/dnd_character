# Next session

## Stack
Flask + SQLite, no ORM. Vanilla JS ES modules, no build step. SPA with `?view=new` / `?view=sheet&id=N`.
- `src/app.py` — backend + REST API (per-user auth, ownership, JSON cache, gzip)
- `static/js/builder.js` — 5-step character creation wizard
- `static/js/sheet.js` — 6-tab character sheet (Stats, Combat, Spells, Inventory, Feats, World)
- `static/js/utils.js` — shared helpers (escHtml, abilityMod, log, theme, constants)
- `static/js/spell-rules.js` — pure spell-count rules (tested in `scripts/test_spell_rules.mjs`)
- `data/classes/*.json` — 13 classes scraped from dnd5e.wikidot.com
- `data/backgrounds.json` — 93 backgrounds

## Tests
- Backend: `python3 -m pytest tests/ -q` (auth, ownership, whitelist, cache)
- Pure JS: `node scripts/test_spell_rules.mjs`, `node scripts/test_combat_utils.mjs`
- Browser (server must run on :5000): `node scripts/test_choices.mjs`, `node scripts/test_combat_display.mjs`
- `scripts/test_fixes.mjs` is a stale scratch script (assumes character id=1) — delete or rewrite.

## Accounts (new)
- Users live in the `users` table, passwords hashed. No self-registration.
- Create a friend's account: `flask --app src/app.py create-user <name>` (prompts for password).
- Characters belong to the creating user; friends only see their own.
- **TODO: change hernan's password** — the old one is in git history. Same command updates it.

## Deploy notes (Jetson)
- `pip install -r requirements.txt` (adds `flask-compress` for gzip; app runs without it too).
- Debug is now OFF by default (`FLASK_DEBUG=1` only for local dev).
- After first deploy of this version the DB self-migrates (new columns); existing characters were claimed by `hernan`.

## Pending tasks

### 1. Ranger/warlock data — DONE 2026-06-11
Ranger re-scraped (8 subclasses), warlock pact-magic slots parse now (`Spell Slots` + `Slot Level` columns). `scrape_class.py` preserves `feature_choices` across re-scrapes.

### 2. Remaining scraping (the "fetch content" backlog)
- Class feature descriptions exist but are sparse for some classes (wizard 7, sorcerer 8, cleric 9) — could scrape feature detail pages.
- If re-scraping spells, note the skip-guard: spells with a `components` field are never re-fetched; add a `--force` flag if descriptions need refreshing.

### 3. Warlock sheet UX
Pact slots now stored like normal slots (e.g. level 5 → `{"3": 2}`). Sheet renders them, but all pact slots refresh on a *short* rest — consider a "short rest" restore button.

### 4. Snapshot / restore tool
Button to save current HP/resource state as a snapshot and restore later.

### 5. Speed hardcoded
Combat tab shows "30 ft" always; races define `speed` but it isn't persisted on the character.

## How to run
```bash
python3 src/app.py          # starts on :5000, debug off
FLASK_DEBUG=1 python3 src/app.py   # dev mode
```

## Key gotchas
- `initBuilder()` in `builder.js` reassigns `state = {}` — must also do `window.state = state` right after, otherwise inline `oninput` handlers update a stale reference and inputs get wiped on re-render.
- Character PUT only accepts whitelisted fields (`_JSON_FIELDS` + `_SCALAR_FIELDS` in app.py); adding a new persisted field needs a column + whitelist entry.
- Inline `onclick` handlers must pass user strings via `data-*` attributes (apostrophes break quoted JS args; `escHtml` can't help there).

## Review
Full findings: `docs/code-review-2026-06-11.md`.
