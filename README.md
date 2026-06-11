# D&D Character Companion

A mobile-first web app for building D&D 5e characters and running them at the
table: HP, spell slots, inventory, attunement, feats, and world notes. Built
for a small group of friends — per-user accounts, each user sees only their
own characters.

**Stack:** Flask + SQLite (no ORM) · vanilla JS ES modules (no build step) ·
data scraped from dnd5e.wikidot.com.

## Run locally

```bash
pip install -r requirements.txt
python3 src/app.py            # http://localhost:5000, debug off
FLASK_DEBUG=1 python3 src/app.py   # dev mode (Werkzeug debugger — never in prod)
```

First run creates `data/dnd.db` and `data/.secret_key`. Create a login:

```bash
flask --app src/app.py create-user <name>      # prompts for password
flask --app src/app.py claim-characters <name> # adopt characters with no owner
```

There is no self-registration; accounts are created by the admin.

## Tests

```bash
python3 -m pytest tests/ -q            # backend: auth, ownership, whitelist, cache
node scripts/test_spell_rules.mjs      # spell-count rules (pure)
node scripts/test_combat_utils.mjs     # weapon math (pure)
# Browser suites (need `cd scripts && npm install`, server on :5000):
node scripts/test_choices.mjs
node scripts/test_combat_display.mjs
```

## Project layout

```
src/app.py              Backend + REST API (auth, ownership, JSON cache, gzip)
static/js/builder.js    5-step character creation wizard + list/library views
static/js/sheet.js      6-tab character sheet (Stats/Combat/Spells/Inventory/Feats/World)
static/js/utils.js      Shared helpers and constants
static/js/spell-rules.js  Pure rules: spells prepared/known, cantrips, max spell level
static/js/combat-utils.js Pure weapon math
data/classes/*.json     13 classes (features, subclasses, slots) — scraped
data/spells.json        562 spells, slug-keyed — scraped
data/backgrounds.json   93 backgrounds — scraped
data/items.json         962 magic items (from dnd_pricing.xlsx)
scripts/                Scrapers, converters, test suites
docs/next-session.md    Working notes: pending tasks, gotchas
docs/code-review-*.md   Review findings
```

## Data pipeline (dnd5e.wikidot.com)

```bash
python3 scripts/scrape_class.py <class>   # class page + subclasses + its spells
python3 scripts/scrape_backgrounds.py     # all backgrounds
python3 scripts/scrape_choices.py         # feature choices (fighting styles, invocations…)
python3 scripts/convert_items.py          # data/dnd_pricing.xlsx → items.json
```

Notes:
- `scrape_class.py` preserves previously injected `feature_choices` on re-scrape.
- Spells already enriched (have a `components` field) are not re-fetched.
- Warlock pact magic is parsed from its "Spell Slots / Slot Level" table format.

## Deploy (Jetson Nano)

Production: `dnd.hernanescudero.io` → Jetson at `nvidia@100.87.133.11`,
project at `/home/nvidia/dnd_character`, conda env
`/home/nvidia/miniforge3/envs/dnd_env`, systemd unit `dnd.service` (port 1404).

```bash
# 1. Sync code (NEVER overwrite the server's data/dnd.db, data/.secret_key, data/app.log)
rsync -av src/ nvidia@100.87.133.11:/home/nvidia/dnd_character/src/
rsync -av static/ nvidia@100.87.133.11:/home/nvidia/dnd_character/static/
rsync -av templates/ nvidia@100.87.133.11:/home/nvidia/dnd_character/templates/
rsync -av requirements.txt nvidia@100.87.133.11:/home/nvidia/dnd_character/
# data files only when they changed:
rsync -av data/classes/ nvidia@100.87.133.11:/home/nvidia/dnd_character/data/classes/
rsync -av data/spells.json nvidia@100.87.133.11:/home/nvidia/dnd_character/data/

# 2. New deps only:
ssh nvidia@100.87.133.11 "/home/nvidia/miniforge3/envs/dnd_env/bin/pip install -r /home/nvidia/dnd_character/requirements.txt"

# 3. Restart + verify
ssh nvidia@100.87.133.11 "sudo systemctl restart dnd"
ssh nvidia@100.87.133.11 "curl -s http://localhost:1404/api/health"
```

DB schema migrates itself on service start (`init_db` ALTERs). Create friends'
accounts on the server:

```bash
ssh nvidia@100.87.133.11 "cd /home/nvidia/dnd_character && \
  /home/nvidia/miniforge3/envs/dnd_env/bin/python -m flask --app src/app.py create-user <name>"
```
