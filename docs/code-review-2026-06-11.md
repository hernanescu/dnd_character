# Deep Code Review — 2026-06-11

Scope: full codebase (`src/app.py`, `static/js/*`, `templates/*`, `scripts/scrape_*.py`, `data/*`) ahead of a friends launch. Live DB inspected (3 characters, stray `momentum_xp` column). Decisions taken with Hernán: **per-user accounts + character ownership**, fix **everything** this session.

## 1. Security / launch blockers

| # | Finding | Where |
|---|---------|-------|
| S1 | Hardcoded plaintext credentials (`hernan / hernan@2026!`) committed to git. | `src/app.py:26` |
| S2 | SQL injection via column names in character PUT: client JSON keys are interpolated into `SET {k} = ?`. Also causes 500s for unknown keys. | `src/app.py:272-277` |
| S3 | `FLASK_DEBUG` defaults to **on** with `host=0.0.0.0` → Werkzeug debugger RCE if port exposed. | `src/app.py:317` |
| S4 | `/api/log` is unauthenticated and appends to an unbounded file (disk-fill vector on the Jetson). | `src/app.py:295` |
| S5 | No ownership model: any logged-in user can read/edit/delete every character. | all `/api/characters*` |
| S6 | `_PUBLIC_ROUTES` is dead code (defined, never enforced); data endpoints are public by accident, not decision. | `src/app.py:28` |
| S7 | `data/.secret_key` and `data/app.log` not gitignored — one `git add -A` away from leaking. | `.gitignore` |
| S8 | XSS: `${c.name}` rendered unescaped in the character list. | `static/js/builder.js:370` |

## 2. Correctness bugs

| # | Finding | Where |
|---|---------|-------|
| B1 | Passive Perception ignores proficiency: `skillBonus('perception', …)` vs stored key `'Perception'` (and the bard half-prof fallback fires instead). | `static/js/sheet.js:236` |
| B2 | `lucky_points` / `bardic_inspiration` are saved to **nonexistent DB columns** → every save 500s (silently swallowed), values reset on reload. Verified against live DB. | `sheet.js:1437-1459`, schema |
| B3 | Builder can't select spells for prepared casters: cleric/druid/wizard/artificer have empty `spells_known_by_level` → `spellsMax = 0`. | `builder.js:776` |
| B4 | Cantrip count hardcoded `{1:2, 4:3, 10:4}` — ignores per-class `cantrips_known_by_level` already in the data; gives paladin/ranger (no cantrips) 2 cantrips. | `builder.js:853` |
| B5 | Max spell level `Math.ceil(level/2)` wrong for half-casters; should derive from `spell_slots_by_level`. | `builder.js:779` |
| B6 | Apostrophes in names break inline `onclick='…("${name}")'` handlers (e.g. "Thieves' Tools", a character named O'Malley): delete buttons, weapon suggestions. `escHtml` can't fix this — needs `data-*` attributes. | `sheet.js:252,1202`, `builder.js:375` |
| B7 | Manual weapons: magic bonus applied to attack but not damage (inconsistent with inventory weapon rows). | `sheet.js:496-501` |
| B8 | Builder step-5 spell search loses input focus on every keystroke (full step re-render). | `builder.js:825,965` |
| B9 | `scrape_class.py parse_spell`: `stat_idx` referenced before assignment when no level paragraph is found → those spells silently fail to scrape. | `scripts/scrape_class.py:394` |

## 3. Performance

- P1: `spells.json` (639 KB), `items.json` (270 KB), `backgrounds.json` (414 KB) are read **from disk and re-parsed on every request**. Cache in memory keyed by mtime.
- P2: No gzip — the sheet loads ~1 MB of JSON uncompressed on a Jetson Nano. Add `flask-compress` (~85% reduction on JSON).

## 4. Redundancy / dead code

- R1: Duplicated between `builder.js` and `sheet.js`: `escHtml`, `log`, `toggleTheme`, `abilityMod`, `fmtBonus`, `ordinalLabel`/`ordinalLabelBuilder`, `ABILITY_NAMES`, `ABILITY_FULL`, `SPELLCASTING_ABILITY`, rarity colors. → shared `static/js/utils.js`.
- R2: Dead code: `wRow()` inside `renderCombat`, `window.toggleSlot` (pip UI was replaced by use/free/restore), `_PUBLIC_ROUTES`.
- R3: Libraries fetch with raw `fetch()` while the rest uses `api.*`; `api.getItems(params)` param handling is never exercised.
- R4: Repo hygiene: `scripts/node_modules/`, `data/*.jpeg`, `*.xlsx:Zone.Identifier`, `.superpowers/` state not ignored.

## 5. Scraper / data status (the "still have to fetch" work)

Audit of `data/` (13 classes, 562 spells, 93 backgrounds, 962 items):

- `docs/next-session.md` is **stale**: subclass gaps are mostly fixed (cleric 18, fighter 10, monk 10…). The real remaining gap is **ranger: 1 subclass**.
- **Warlock pact magic** still unscraped: `spell_slots_by_level = {}`. Root cause found: the table parser only matches `1st/2nd/…` slot headers; warlock's table uses "Spell Slots" + "Slot Level" columns. Fixable in `_parse_class_table`.
- Spell description truncation is **less severe than documented**: only ~13 spells cluster at ~500 chars and the sampled ones end in complete sentences. The current `parse_spell` does not truncate. The skip-refetch guard (`'components' in spell`) would prevent refreshing any genuinely stale entries — needs a `--force` option if re-scraping.
- Prepared casters legitimately have no "spells known" column on wikidot — the fix is app-side (B3), not scraper-side.

## 6. Minor / accepted

- Sheet "Saving Throws" rendered on both Stats and Combat tabs (assumed intentional).
- Speed hardcoded to "30 ft" in Combat (races define `speed` but it isn't persisted on the character).
- No CSRF tokens; mitigated by SameSite=Lax default + JSON content type. Acceptable for friends-scale.
- Sessions: consider `SESSION_COOKIE_HTTPONLY` (default on) and `PERMANENT_SESSION_LIFETIME` later; app is served over Tailscale.

## Implementation

See `docs/superpowers/plans/2026-06-11-launch-readiness.md`.
