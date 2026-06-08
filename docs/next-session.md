# Next session

## Stack
Flask + SQLite, no ORM. Vanilla JS ES modules, no build step. SPA with `?view=new` / `?view=sheet&id=N`.
- `src/app.py` — backend + REST API
- `static/js/builder.js` — 5-step character creation wizard
- `static/js/sheet.js` — 6-tab character sheet (tabs: Stats, Combat, Spells, Inventory, Feats, Notes)
- `data/classes/*.json` — 13 classes scraped from dnd5e.wikidot.com (English)
- `data/backgrounds.json` — 88 backgrounds (scraped, English)

## Completed
- Translatated all UI labels from Spanish to English (SKILLS array, stat labels, builder labels, feats, inventory edit buttons)
- Scraped all 13 classes from dnd5e.wikidot.com with features, subclasses, and spells
- Added Ironsworn resource bar (momentum, supply, stress) with +/- controls
- Refactored sheet to be class-agnostic: dynamic tabs (Spells hidden for non-casters), dynamic spellcasting ability, conditional Bardic Inspiration
- Refactored builder to use class selector (step 1), dynamic step count (4 for non-casters / 5 for casters)
- Builder loads class data dynamically on class selection (no hardcoded `bard`)
- Spell grouping by level with expand/collapse in sheet
- Compact spell slot pip layout (14px square, 3px gap)
- Spell search/filter input in builder step 5
- Responsive media queries (<360px, >768px)
- Added `SPELLCASTING_ABILITY` fallback map for scraped data that lacks `spellcasting_ability` field

## Pending tasks

### 1. Subclass data gaps
Some classes have 0 subclasses in scraped data (cleric, barbarian, fighter, monk, rogue, artificer). Wikidot may not have dedicated pages. Options:
- Parse class page directly for subclass mentions instead of following subclass links
- Add manual subclass data
- Allow manual entry in builder step 4

### 2. Warlock pact magic
Warlock shows `spell_slots_by_level: {}` for all levels — pact magic uses a different slot mechanic. Need to handle separately or special-case.

### 3. Class feature descriptions
Features are currently plain text names (`features_by_level`). No descriptions. Could scrape feature detail pages for richer display.

### 4. Spell description quality
Some spell descriptions are truncated (500 char cap in scraper). Consider raising limit or scraping from a better source.

### 5. Snapshot / restore tool
A button to save the current HP/resource state as a "snapshot" and restore it later — useful for tracking resource use across sessions.

## How to run
```bash
python3 src/app.py          # starts on :5000
```

## Key gotcha
`initBuilder()` in `builder.js` reassigns `state = {}` — must also do `window.state = state` right after, otherwise inline `oninput` handlers update a stale reference and inputs get wiped on re-render.
