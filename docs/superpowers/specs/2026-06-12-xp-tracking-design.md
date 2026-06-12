# XP Tracking — Design

## Problem

There's no way to track a character's accumulated experience points or see progress toward the next level. `level` is set once during character creation and is otherwise static.

## Data model

- New column on `characters`: `xp INTEGER NOT NULL DEFAULT 0`, added via the existing `ALTER TABLE ADD COLUMN` migration pattern in `src/app.py` (SQLite backfills existing rows with `0`).
- Add `'xp'` to `_SCALAR_FIELDS` so it's accepted on create/update.

## XP thresholds

New shared constant in `static/js/utils.js`, used by both the builder and the sheet:

```js
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
// index 0 = Level 1 threshold ... index 19 = Level 20 threshold
```

This is the standard 5e PHB XP-to-level table.

## Builder integration

In `finishBuilder` (`static/js/builder.js`), add to the create payload:

```js
xp: XP_THRESHOLDS[level - 1],
```

A new character starts at the XP minimum for its selected level (0 for Level 1, 6,500 for Level 5, etc.), so the progress bar starts at 0% progress toward the next level. No new builder UI.

## Sheet header — XP progress bar

Below the `.char-meta` line in `render()` (`static/js/sheet.js`), add a new row:

```html
<div class="xp-bar-wrap" onclick="toggleXpEditor()">
  <div class="xp-bar-label">${label}</div>
  <div class="xp-bar"><div class="xp-bar-fill${ready ? ' ready' : ''}" style="width:${pct}%"></div></div>
  ${xpEditorOpen ? popup : ''}
</div>
```

Computation, given `level = char.level` and `xp = char.xp ?? 0`:

- **Level < 20:**
  - `cur = XP_THRESHOLDS[level-1]`, `next = XP_THRESHOLDS[level]`
  - `pct = clamp((xp-cur)/(next-cur)*100, 0, 100)`
  - `label = "${xp.toLocaleString()} / ${next.toLocaleString()} XP"`
  - If `xp >= next`: append `" — Ready to level up!"` to the label and add a `.ready` class to the bar fill (gold/highlight color). This is purely visual — no level or stat changes happen. A future level-up feature will own the actual transition.
- **Level 20:** `pct = 100`, `label = "${xp.toLocaleString()} XP"` — no fraction, since there's no next threshold.

New CSS classes (`.xp-bar-wrap`, `.xp-bar-label`, `.xp-bar`, `.xp-bar-fill`, `.xp-bar-fill.ready`) added near the existing `.stat-pill` rules, with dark-mode variants alongside the other dark-theme overrides.

## Tap-to-edit interaction

A module-level `xpEditorOpen` flag (like `editMode`/`activeTab`), toggled by `window.toggleXpEditor`. When open, a small popup renders inside `.xp-bar-wrap`:

```html
<div class="xp-editor-popup" onclick="event.stopPropagation()">
  <div class="xp-editor-btn" onclick="addXp()"><span class="xp-editor-icon">+</span>Add XP</div>
  <div class="xp-editor-btn" onclick="setXpTotal()"><span class="xp-editor-icon">=</span>Set Total</div>
</div>
```

Handlers, mirroring the existing `openHpEditor`/`adjustHp` pattern:

```js
window.toggleXpEditor = () => { xpEditorOpen = !xpEditorOpen; render(); };

window.addXp = () => {
  const val = prompt('Add XP:');
  xpEditorOpen = false;
  if (val !== null && !isNaN(+val) && +val !== 0) {
    const newXp = Math.max(0, char.xp + Math.trunc(+val));
    save({ xp: newXp }).then(() => { render(); log('xp', `XP +${Math.trunc(+val)} → ${newXp}`); });
  } else render();
};

window.setXpTotal = () => {
  const val = prompt('Set total XP:', char.xp);
  xpEditorOpen = false;
  if (val !== null && !isNaN(+val)) {
    const newXp = Math.max(0, Math.trunc(+val));
    save({ xp: newXp }).then(() => { render(); log('xp', `XP set → ${newXp}`); });
  } else render();
};
```

`event.stopPropagation()` on the popup prevents the wrapper's `onclick` from immediately re-toggling when a button is clicked.

## Out of scope

- No automatic level/stat changes when XP crosses a threshold — that belongs to a future level-up feature (selecting ASIs, features, new spells, etc. on level-up).
- No custom starting-XP input in the builder — always derived from the selected level.
- No XP history beyond the existing activity log entries written by `addXp`/`setXpTotal`.

## Testing

Extend the browser test suite (new `scripts/test_xp.mjs`, following the pattern of `scripts/test_hp_method.mjs`):

- Creating a Level 5 character results in `xp === 6500` and the bar shows `6,500 / 14,000 XP` at 0%.
- "Add XP" increases the total and persists across reload.
- "Set Total" overwrites the total and persists across reload.
- Setting XP at/above the next threshold shows the "Ready to level up!" state with the `.ready` fill.
- A Level 20 character shows `"<xp> XP"` with a full bar and no fraction.
