# HP Calculation Method — Design

## Problem

The character builder always computes `hp_max` using the standard 5e "fixed/average" rule for levels 2+ (`floor(hit_die/2) + 1 + CON` per level), with level 1 always at full hit die + CON. There's no way to choose a different HP calculation method (e.g., always max, or roll randomly).

## Solution

Add an **HP Method** selector to Step 1 (Basic Info) of the character builder, placed below the Level pills. Three options:

- **Average** (default, current behavior) — `floor(hit_die/2) + 1 + CON` per level for levels 2+.
- **Max** — `hit_die + CON` per level for levels 2+ (and implicitly for level 1 too, since level 1 is already max).
- **Random** — roll `1d(hit_die) + CON` per level for levels 2+.

Level 1 is unaffected by this choice and always uses `hit_die + CON`, matching RAW.

## UI

In `renderStep1`, after the Level pills block, add:

```html
<div class="field-label" style="margin-top:12px">Hit Points</div>
<div class="pills">
  <div class="pill${state.hpMethod==='average'?' selected':''}" onclick="selectHpMethod('average')">Average</div>
  <div class="pill${state.hpMethod==='max'?' selected':''}" onclick="selectHpMethod('max')">Max</div>
  <div class="pill${state.hpMethod==='random'?' selected':''}" onclick="selectHpMethod('random')">Random</div>
</div>
```

A new `window.selectHpMethod = (m) => { state.hpMethod = m; renderStep(); }` handler, mirroring `selectLevel`.

No live HP preview is shown in the wizard (matches current behavior — HP isn't previewed anywhere before creation).

## State

Add `hpMethod: 'average'` to the initial `state` object (default preserves current behavior).

## Calculation (finishBuilder)

Replace the existing single-line `hpMax` formula with a method-based branch:

```js
const hitDie = state.classData.hit_die;
const base = hitDie + conMod; // level 1, always max
let hpMax = base;
for (let lvl = 2; lvl <= level; lvl++) {
  if (state.hpMethod === 'max') {
    hpMax += base;
  } else if (state.hpMethod === 'random') {
    hpMax += rollDie(hitDie) + conMod;
  } else { // average (default)
    hpMax += Math.floor(hitDie / 2) + 1 + conMod;
  }
}
```

Add a small helper near `roll4d6`:

```js
function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}
```

`Math.max(1, hpMax)` guard on the final value stays as-is.

## Out of scope

- No backend/schema changes — `hp_max`/`hp_current` are stored exactly as before.
- No persistence of which method was used (not shown on the character sheet).
- No per-level roll breakdown or reroll button for Random mode.
- No changes to level-up flow (none exists currently).

## Testing

Extend the existing builder test suite (`tests/` browser tests) with cases for each HP method, verifying `hp_max` matches the expected formula for a known hit die / CON / level combination.
