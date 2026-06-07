# D&D Character Sheet PWA — Design Spec

**Date:** 2026-06-07  
**Status:** Approved  

---

## Overview

A mobile-first PWA for building and tracking D&D 5e characters, starting with the Bard class. Hosted on the Jetson Nano (Tailscale `nvidia@100.87.133.11`), deployed via the same systemd + git pull pattern as Kwenta. Class and background data is scraped from wikidot, committed to the repo as JSON, and never fetched at runtime.

---

## Architecture

**Stack:** Vanilla HTML/CSS/JS frontend + Flask backend + SQLite. No build step. No Node.js required on the Jetson.

**Project structure:**

```
dnd_character/
├── data/
│   ├── classes/
│   │   └── bard.json          # scraped from dnd5e.wikidot.com/bard
│   ├── backgrounds.json       # scraped from dnd2014.wikidot.com/backgrounds
│   └── dnd.db                 # SQLite database
├── scripts/
│   ├── scrape_class.py        # usage: python scrape_class.py bard
│   └── scrape_backgrounds.py  # usage: python scrape_backgrounds.py
├── src/
│   └── app.py                 # Flask: static files + REST API
├── static/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # service worker (offline cache)
│   ├── css/app.css
│   └── js/
│       ├── api.js             # fetch wrapper
│       ├── builder.js         # multi-step creation wizard
│       └── sheet.js           # character sheet view + edit
├── templates/
│   └── index.html             # single-page app shell
└── Makefile                   # same pattern as Kwenta
```

**Deploy:** New systemd service `dnd-web`. `make jetson-restart` = git pull + restart. `make jetson-deploy` = git pull + pip install + restart (for new deps).

---

## Data Model

### SQLite — `characters` table

| field | type | notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | character name |
| class_key | TEXT | `"bard"`, `"wizard"`, etc. |
| subclass_key | TEXT | `"lore"`, `"valor"`, `"glamour"`, etc. |
| level | INTEGER | 1–20 |
| race | TEXT | |
| background | TEXT | key into backgrounds.json |
| ability_scores | JSON | `{"str":10,"dex":14,"con":13,"int":12,"wis":10,"cha":18}` |
| skill_proficiencies | JSON | list of proficient skill keys (merged from class + background + race + manual) |
| expertise | JSON | list of skill keys with expertise (double prof) |
| spells_known | JSON | list of spell keys |
| spell_slots | JSON | `{"1":{"max":4,"used":1},"2":{"max":3,"used":0},...}` |
| hp_max | INTEGER | |
| hp_current | INTEGER | |
| ac | INTEGER | |
| features | JSON | extra features / feats list |
| weapons | JSON | list of `{name, type, ability, proficient, damage_die}` |
| inventory | JSON | list of `{name, qty}` |
| coins | JSON | `{"pp":0,"gp":45,"ep":0,"sp":80,"cp":5}` |
| notes | JSON | list of `{type:"npc"|"lugar", title, body}` |
| created_at | TIMESTAMP | |

### `data/classes/bard.json` (scraped)

```json
{
  "key": "bard",
  "name": "Bard",
  "hit_die": 8,
  "saving_throws": ["dex", "cha"],
  "skill_choices": ["Acrobatics", "Athletics", ...],
  "skill_count": 3,
  "subclasses": {
    "lore": {
      "name": "College of Lore",
      "features_by_level": { "3": ["Cutting Words", "Bonus Proficiencies"], "6": ["Additional Magical Secrets"], "14": ["Peerless Skill"] }
    },
    "valor": { ... },
    "glamour": { ... }
  },
  "spells": {
    "vicious_mockery": { "name": "Vicious Mockery", "level": 0, "school": "Enchantment", "description": "..." },
    ...
  },
  "features_by_level": {
    "1": ["Spellcasting", "Bardic Inspiration (d6)"],
    "2": ["Jack of All Trades", "Song of Rest (d6)"],
    "3": ["Expertise", "Bard College"],
    ...
  },
  "spells_known_by_level": { "1": 4, "2": 5, "3": 6, ... },
  "cantrips_known_by_level": { "1": 2, "4": 3, "10": 4 },
  "spell_slots_by_level": {
    "1": {"1": 2},
    "2": {"1": 3},
    "3": {"1": 4, "2": 2},
    ...
  }
}
```

### `data/backgrounds.json` (scraped from dnd2014.wikidot.com/backgrounds)

```json
{
  "entertainer": {
    "name": "Entertainer",
    "skill_proficiencies": ["Acrobatics", "Performance"],
    "tool_proficiencies": ["Disguise kit", "Musical instrument x1"],
    "languages": 0,
    "feature": "By Popular Demand"
  },
  "sage": {
    "name": "Sage",
    "skill_proficiencies": ["Arcana", "History"],
    "tool_proficiencies": [],
    "languages": 2,
    "feature": "Researcher"
  }
}
```

Minimum target: all **Common Backgrounds** from the page. The scraper follows each background link recursively.

---

## Proficiency Calculation

```
ability_mod(score)  = floor((score - 10) / 2)
prof_bonus          = floor((level - 1) / 4) + 2

for each skill:
  proficient = skill in class_skills_chosen
            OR skill in background.skill_proficiencies
            OR skill in race_bonus_skills

  bonus = ability_mod(skill_ability)
  if proficient  → bonus += prof_bonus
  if expertise   → bonus += prof_bonus        // Bard: 2 skills at level 3, 2 more at level 10
  if not proficient AND bard level >= 2        // Jack of All Trades
               → bonus += floor(prof_bonus / 2)

attack_bonus (weapon) = ability_mod(weapon.ability) + (proficient ? prof_bonus : 0)
damage_formula        = weapon.damage_die + "+" + ability_mod(weapon.ability)
spell_save_dc         = 8 + prof_bonus + cha_mod
spell_attack_bonus    = prof_bonus + cha_mod
```

**Manual override:** Any skill can be toggled manually from the Stats tab (pencil icon enters edit mode). If a background is missing from the JSON, a blank editable background is shown with all fields unlocked.

---

## Character Builder — 5-step wizard

Each step is a full-screen mobile view with a progress bar at the top and Back / Next navigation.

| Step | Content |
|---|---|
| 1 — Info básica | Name, level (pills 1–20), race (pills) |
| 2 — Ability scores | Standard array assignment (dropdowns per attribute). Racial bonuses applied automatically and shown inline. |
| 3 — Skills + Background | Background picker (pills from backgrounds.json). Bard's 3 skill choices (filtered to avoid background duplicates). |
| 4 — Subclase | Cards for each Bard college with name, description, and feature list. Shown for all levels; grayed out with note "disponible a nivel 3" if level < 3. |
| 5 — Spells | Cantrips (2 at level 1) + spells known (count from table). Spell save DC and attack bonus shown in header. Checkboxes. |

On finish → character is POSTed to `/api/characters` and the sheet view is rendered.

---

## Character Sheet — 6 tabs

Tabs scroll horizontally on mobile. HP is always visible in the header.

| Tab | Content |
|---|---|
| **Stats** | Ability scores grid (score + modifier). Saving throws. Full skills list with proficiency dots and calculated bonuses. Proficiency bonus shown. Edit mode (pencil icon) lets user toggle any proficiency manually. |
| **Combate** | HP (editable inline, tap to change current). AC, Speed, Initiative. Saving throw quick-reference. Bardic Inspiration die. |
| **Magia** | Spell slots tracker per level (tap slot to mark used/available). Spell save DC and attack bonus. List of known spells with level, school, and description expandable on tap. |
| **Inventario** | Coins (PP/GP/EP/SP/CP, editable). Weapons with auto-calculated attack bonus and damage formula. General items list with quantity. Add buttons for weapons and items. |
| **Feats** | Class features by level (from bard.json). Subclass features (from subclass data). Race traits. Manual feats entry. |
| **Notas** | Cards tagged NPC or Lugar. Title + free text. Add / delete. |

---

## REST API

All endpoints return JSON. No authentication (Jetson + Tailscale access only).

```
GET  /                        → index.html (SPA shell)
GET  /api/classes/:key        → full class JSON (bard.json)
GET  /api/backgrounds         → full backgrounds.json
GET  /api/characters          → list of all characters [{id, name, class_key, level}]
GET  /api/characters/:id      → full character record
POST /api/characters          → create character, returns {id}
PUT  /api/characters/:id      → update character (full or partial), returns updated record
```

---

## PWA

- `static/manifest.json`: name, short_name, theme_color (#111), background_color (#fff), display: standalone, icons (192 + 512 SVG)
- `static/sw.js`: caches app shell (index.html, CSS, JS, fonts) on install. Network-first for API calls, cache fallback if offline.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` + mobile-optimized touch targets

---

## Visual Design

- **Colors:** Black (`#111`), white (`#fff`), grays (`#555`, `#888`, `#ddd`, `#f5f5f5`)
- **Heading font:** AlegreyaSC (from `/home/hernan/kalakthul/fonts/`) — small-caps serif, D&D feel
- **Body font:** Lato (from `/home/hernan/kalakthul/fonts/`)
- **Font files** copied to `static/fonts/` at setup, referenced via `@font-face` in CSS
- No color accents. Hierarchy via weight, size, and border thickness.

---

## Scraper Design

Both scrapers use `requests` + `BeautifulSoup4`. They are run manually and their output committed to the repo.

**`scrape_class.py <classname>`:**
1. Fetches `https://dnd5e.wikidot.com/<classname>`
2. Parses class features table, hit die, saving throws, skill list
3. Follows subclass links (e.g. `/bard:college-of-lore`) and parses features
4. Follows spell links and parses spell data (level, school, description)
5. Writes `data/classes/<classname>.json`

**`scrape_backgrounds.py`:**
1. Fetches `http://dnd2014.wikidot.com/backgrounds`
2. Identifies all Common Background links
3. Follows each link and parses: skill proficiencies, tool proficiencies, languages, feature name
4. Writes `data/backgrounds.json`

Both scripts print a summary on completion and warn about any pages that returned errors or had unexpected structure, so partial results are detectable.

---

## Makefile targets (new service)

```makefile
DND_SERVICE := dnd-web
JETSON      := nvidia@100.87.133.11

dnd-run:
    python src/app.py

dnd-restart:
    ssh $(JETSON) 'cd ~/dnd_character && git pull && sudo systemctl restart $(DND_SERVICE)'

dnd-deploy:
    ssh $(JETSON) 'cd ~/dnd_character && git pull && pip install -e . -q && sudo systemctl restart $(DND_SERVICE)'

dnd-logs:
    ssh -t $(JETSON) 'sudo journalctl -u $(DND_SERVICE) -f --no-pager'
```

---

## Out of scope (MVP)

- Multiple users / authentication
- Character export (PDF)
- Dice roller
- Combat tracker / initiative order
- Non-Bard classes (data pipeline is ready; UI is class-agnostic at the sheet level)
