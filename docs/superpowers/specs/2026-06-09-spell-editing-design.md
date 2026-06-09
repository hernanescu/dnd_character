# Spell Editing & Slot Display Fix

**Date:** 2026-06-09

---

## Overview

Two related improvements to the Spells tab:

1. **Spell slot display**: Show remaining slots (`max − used / max`) instead of consumed slots (`used / max`), so a fresh character reads `4/4` instead of `0/4`.
2. **Spell list editing**: An edit mode on the Spells tab that lets the user add or remove known spells without rebuilding the character.

---

## Fix 1 — Spell Slot Display

### Current behaviour
`spell_slots` stores `{ used, max }` per level. `used` starts at 0 (fresh/after long rest). Display renders `${s.used}/${s.max}` → shows `0/4` when all slots are available.

### Target behaviour
Display `${s.max - s.used}/${s.max}` → shows `4/4` when all slots are available, ticks down to `3/4` as slots are expended.

### Changes

**`static/js/sheet.js` — `renderSpells`:**
- Change display from `${s.used}/${s.max}` → `${s.max - s.used}/${s.max}`
- Swap button → function mapping so the UI stays consistent:
  - `−` button → `useSlot(lvl)` (expend a slot; remaining decreases)
  - `+` button → `freeSlot(lvl)` (recover a slot; remaining increases)
- `↺` restore button stays: sets `used = 0` → shows full `max/max`

No data model or backend changes needed.

---

## Fix 2 — Spell List Editing

### Data model
`spells_known` is a JSON array of spell key strings stored on the character row. No schema change needed — the existing `save()` / `PATCH /api/characters/:id` endpoint already handles it.

### UX: Edit Mode Toggle

**Entry point:** A small "Edit" button (pencil icon or text) in the Spells tab header area, visible only when `editMode` is active (the sheet's existing edit toggle already gates other edits).

**Active edit state changes:**
- Each rendered spell card gets a `×` button positioned absolutely in its top-right corner. The card content (name, school, description, meta) is untouched — the `×` overlays it without reflowing text.
- A sticky "Add spell" panel renders above the spell level groups: a search `<input>` + a compact results list below it.

**Add spell panel behaviour:**
- Filters `spellData` to spells whose `classes` array includes `char.class_key`.
- Excludes spells already in `spells_known`.
- Debounced search (200 ms) against spell name (case-insensitive).
- Results shown as compact rows: level badge + name + school. Max ~8 rows shown, scrollable.
- Clicking a result adds the spell key to `spells_known` and calls `save()`.

**Remove spell behaviour:**
- Clicking `×` on a spell card removes its key from `spells_known` and calls `save()`. No confirmation dialog — it's inside edit mode and easily reversible.

**Exit edit mode:** User clicks "Done" (or the existing edit toggle). The add panel and `×` buttons disappear.

### No backend changes
`PATCH /api/characters/:id` already accepts `spells_known`. The frontend just calls `save({ spells_known: updatedArray })`.

---

## Scope / Out of Scope

| In scope | Out of scope |
|---|---|
| Display fix (remaining/max) | Racial spell filtering (future) |
| Add spells from class list | Custom/homebrew spell creation |
| Remove spells from known list | Spell slot max editing |
| Filtered by class only | Full-screen picker (only if A is unreadable) |

---

## Files Touched

- `static/js/sheet.js` — `renderSpells`, `spellCard`, slot display + edit mode logic
- `static/css/app.css` — `×` overlay styles, add-spell panel styles
