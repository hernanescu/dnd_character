# Combat Weapon Display — Attack Bonus & Modifiers

## Problem

The "Equipped Weapons" section of the Combat tab (rendered by `invWeaponRow()` in
`static/js/sheet.js`) shows an attack bonus and damage value, but:

- The attack bonus is opaque — there's no indication of which ability modifier,
  proficiency, or magic bonus contributed to the number.
- Non-finesse weapons always use STR, even for ranged weapons (shortbow, longbow,
  crossbows), which should use DEX.
- Finesse weapons use `max(STR, DEX)` with no way for the player to override it.
- Thrown weapons (handaxe, spear) that aren't finesse always use STR with no way
  to model a thrown (DEX) attack.
- Magic weapon bonuses (e.g. "Warhammer, +1") apply to the attack roll but not to
  the damage roll, which is incorrect per RAW (the bonus applies to both).

## Goals

- Show a clear breakdown of what makes up the attack bonus and damage bonus.
- Correctly select STR vs DEX based on weapon type:
  - Ranged weapons (`ammunition` prop) → always DEX, no toggle.
  - Finesse or thrown weapons (`finesse` or `thrown` prop) → toggleable STR ⇄ DEX,
    defaulting to whichever is currently higher.
  - All other (melee, non-finesse, non-thrown) weapons → always STR, no toggle.
- Apply magic weapon bonuses to both attack and damage.
- Keep the existing PROF toggle behavior and styling.

## Non-goals

- The manual "Weapons" section (`char.weapons[]`) is unchanged. Its ability score
  is already player-selectable via a dropdown when adding a weapon. It will not
  get the breakdown subtext or ⇄ toggle in this pass.
- Versatile weapon damage dice (e.g. longsword 1d8 one-handed / 1d10 two-handed)
  are not modeled. Damage die stays at the one-handed value from `BASE_WEAPONS`.
- Thrown weapon range increments and ammo tracking are not addressed.

## Data model change

Add an optional field to inventory item records (alongside the existing
`proficient` boolean):

```js
item.preferred_ability = 'str' | 'dex'  // only meaningful for finesse/thrown weapons
```

- Persisted via the same `save({ inventory })` pattern used by
  `toggleWeaponProf` / `toggleEquip`.
- Absent/undefined means "no override yet" — the renderer falls back to the
  default (`max(STR mod, DEX mod)`).
- Ignored for ranged and plain-melee weapons (they have no toggle).

## Weapon classification

Derived from `BASE_WEAPONS[baseKey].props` (existing table, no changes needed to
the table itself):

| Category | Detection | Ability used | Toggle? |
|---|---|---|---|
| Ranged | `props.includes('ammunition')` | DEX | No |
| Finesse / thrown | `props.includes('finesse')` or `props.includes('thrown')` | `item.preferred_ability` ?? `max(STR, DEX)` | Yes (⇄ icon) |
| Plain melee | none of the above | STR | No |

If a weapon has no recognized `base_weapon` (custom item with only `weapon_bonus`
set), treat it as plain melee (STR), matching current fallback behavior.

## Formulas

```
abilityMod   = resolved per classification above
attackBonus  = abilityMod + (proficient ? profBonus : 0) + magicBonus
damageBonus  = abilityMod + magicBonus
damage       = `${die}${damageBonus >= 0 ? '+' : ''}${damageBonus}`
```

`magicBonus` continues to come from `lib.weapon_bonus` (e.g. +1 for "Warhammer, +1").

## UI changes (`invWeaponRow`)

Row layout becomes:

```
[Name + equipped badge]              [Attack bonus]  [Damage]      [⇄]   [PROF]
[type · magic · ranged]              [breakdown]     [breakdown]
```

- **Attack bonus column**: large bonus number, with a small subtext line below
  showing only non-zero terms, e.g. `STR+3 · PROF+2` or `DEX+4 · PROF+2 · magic+1`.
- **Damage column**: `die+bonus` with a subtext line, e.g. `STR+3 · magic+1` or
  `DEX+4`.
- **⇄ icon**: small circular swap icon next to the attack bonus, shown only for
  finesse/thrown weapons. Click toggles `preferred_ability` between `'str'` and
  `'dex'`, saves, and re-renders.
- **PROF chip**: unchanged — existing toggle, existing styling.
- **Type line**: existing `damage type · +N magic` format, with `· ranged`
  appended when the weapon is in the ranged category (so it's clear why no ⇄
  icon is present).

## Example renders

- **Warhammer, +1** (plain melee, STR 16/+3, prof +2):
  Attack `+5` / `STR+3 · PROF+2`; Damage `1d8+4` / `STR+3 · magic+1`. No ⇄.
- **Rapier** (finesse, STR 12/+1, DEX 18/+4, prof +2, defaults to higher = DEX):
  Attack `+6` / `DEX+4 · PROF+2`; Damage `1d8+4` / `DEX+4`. ⇄ shown, click swaps
  to STR-based values.
- **Shortbow** (ranged, DEX 18/+4, prof +2):
  Attack `+6` / `DEX+4 · PROF+2`; Damage `1d6+4` / `DEX+4`. No ⇄, type line shows
  `piercing · ranged`.
