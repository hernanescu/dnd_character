# Character Sheet Typography Scale-Up

## Problem

On the character sheet (Stats/Combat/Spells/Inventory/Feats/World tabs), most
"content" text — feature and spell descriptions, item/weapon names, stat
breakdowns — sits at 9-13px. Combined with the dim `--text-dim` color used for
secondary text, it reads as cramped and hard to read, especially in dark mode.

Confirmed via mockups comparing the "Rage" feature description and the equipped
weapon stat line at several scales; the user picked the larger of two proposed
scales plus a lightened `--text-dim`.

## Scope

Sheet view only (`static/css/app.css`, plus two inline-style spots in
`static/js/sheet.js`). The character-creation builder is out of scope for this
pass.

The tiny uppercase micro-labels (ability/stat/resource/coin labels at 7-9px,
tab labels, badges/tags) are left unchanged — they're intentional compact
design accents and bumping them risks overflow in the tight grid layouts
(ability grid, combat grid, coin grid) on narrow (360px) screens.

## Changes

### Color

`[data-theme="dark"] --text-dim`: `#6a6460` → `#8a847e` (lighter, better
contrast for dim/secondary text on dark backgrounds). Light mode `--text-dim`
is unchanged — its contrast against the light background is already adequate.

### Tier A — descriptions/prose: 11-12px → 15px, line-height → 1.6

- `.feat-desc`
- `.spell-desc`
- `.spell-higher` (keep `font-style: italic`)
- `.note-body`
- Subclass description block (sheet.js, `renderFeats`) — currently
  13px/1.65 inline style
- Background description block (sheet.js, `renderBgCard`) — currently
  13px/1.65 inline style

### Tier B — names/titles: 13-14px → 15px

- `.feat-name`
- `.spell-name`
- `.weapon-name`
- `.item-name`
- `.note-title`
- `.spell-row-name`

### Tier C — secondary values/rows: 12px → 14px, section titles 13px → 14px

- `.weapon-atk`
- `.weapon-dmg`
- `.item-qty`
- `.ability-mod`
- `.skill-row` (base font-size, covers `.skill-name`)
- `.skill-bonus`
- `.save-row` (base font-size, covers `.save-name`)
- `.save-bonus`
- `.spell-level-title`
- `.spell-progress`
- `.prof-info`
- `.section-title`

### Tier D — small annotations: 9-10px → 11-12px

- `.feat-level`
- `.weapon-breakdown`
- Weapon type-line ("bludgeoning · +1 magic", sheet.js inline style) — bump to
  12px and switch hardcoded `#888` to `var(--text-dim)`
- `.spell-school`
- `.spell-meta`
- `.skill-ability`
- `.spell-level-count`
- `.eq-btn`
- `.spell-row-level`
- `.spell-row-school`

## Out of scope

- Character-creation builder screens (`.subclass-desc`, `.step-sub`,
  `.field-label`, etc.)
- The tiny uppercase micro-labels listed above
- Any layout/structure changes — this is font-size, line-height, and one color
  token only
