# Combat Weapon Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Combat tab's "Equipped Weapons" rows show a correct, transparent attack-bonus and damage breakdown — right ability score for melee/ranged/finesse/thrown weapons (with a player-toggleable STR⇄DEX for finesse/thrown), proficiency, and magic bonuses applied to both attack and damage.

**Architecture:** Extract the weapon classification and bonus-calculation math into a small dependency-free module (`static/js/combat-utils.js`) so it can be unit-tested with Node directly. `static/js/sheet.js`'s `invWeaponRow()` consumes these helpers to render the new row layout (bonus + breakdown subtext + STR⇄DEX toggle for applicable weapons). A small, necessary fix to the equipped-weapon filter is included so plain (non-magical) weapons actually render in this section.

**Tech Stack:** Vanilla JS (ES modules), Flask/SQLite backend (unchanged), Playwright for end-to-end verification (existing project convention, see `scripts/test_choices.mjs`).

---

## File Structure

- **Create** `static/js/combat-utils.js` — pure functions: weapon classification (ranged / finesse-or-thrown / plain melee), ability resolution, attack/damage formulas, breakdown formatting. No imports, so it can be unit-tested directly with `node --test`.
- **Create** `scripts/test_combat_utils.mjs` — Node unit tests for `combat-utils.js`.
- **Modify** `static/js/sheet.js` — import the new helpers; fix `_invWeaponEntries()` and the equipped-weapons render filter so plain weapons (no `itemData` entry) are recognized; rewrite `invWeaponRow()`; add `window.toggleWeaponAbility`.
- **Modify** `static/css/app.css` — add `.weapon-col`, `.weapon-breakdown`, `.ability-toggle` styles.
- **Create** `scripts/test_combat_display.mjs` — Playwright script that creates a temp character with a melee, a finesse, and a ranged weapon, checks the Combat tab output against the spec's example renders, then deletes the character.

---

### Task 1: Create `combat-utils.js` with pure weapon math (TDD)

**Files:**
- Create: `static/js/combat-utils.js`
- Test: `scripts/test_combat_utils.mjs`

- [ ] **Step 1: Write the failing test file**

Create `scripts/test_combat_utils.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAbilityToggleable,
  isRangedWeapon,
  resolveWeaponAbility,
  weaponAttackBonus,
  weaponDamageMod,
  formatBonusBreakdown,
} from '../static/js/combat-utils.js';

test('isAbilityToggleable is true for finesse and thrown', () => {
  assert.equal(isAbilityToggleable(['finesse']), true);
  assert.equal(isAbilityToggleable(['thrown']), true);
  assert.equal(isAbilityToggleable(['finesse', 'light']), true);
});

test('isAbilityToggleable is false for plain/versatile weapons', () => {
  assert.equal(isAbilityToggleable([]), false);
  assert.equal(isAbilityToggleable(['versatile (1d10)']), false);
});

test('isRangedWeapon is true only for ammunition weapons', () => {
  assert.equal(isRangedWeapon(['ammunition', 'two-handed']), true);
  assert.equal(isRangedWeapon(['finesse']), false);
  assert.equal(isRangedWeapon([]), false);
});

test('resolveWeaponAbility: ranged weapons always use DEX', () => {
  assert.equal(resolveWeaponAbility(['ammunition'], undefined, 3, 1), 'dex');
  assert.equal(resolveWeaponAbility(['ammunition'], 'str', 3, 1), 'dex');
});

test('resolveWeaponAbility: plain melee weapons always use STR', () => {
  assert.equal(resolveWeaponAbility([], undefined, 1, 4), 'str');
  assert.equal(resolveWeaponAbility(['versatile (1d10)'], 'dex', 1, 4), 'str');
});

test('resolveWeaponAbility: finesse defaults to whichever mod is higher', () => {
  assert.equal(resolveWeaponAbility(['finesse'], undefined, 1, 4), 'dex');
  assert.equal(resolveWeaponAbility(['finesse'], undefined, 4, 1), 'str');
});

test('resolveWeaponAbility: finesse honors a preferred override', () => {
  assert.equal(resolveWeaponAbility(['finesse'], 'str', 1, 4), 'str');
  assert.equal(resolveWeaponAbility(['finesse'], 'dex', 4, 1), 'dex');
});

test('resolveWeaponAbility: thrown (non-finesse) is toggleable like finesse', () => {
  assert.equal(resolveWeaponAbility(['thrown'], undefined, 1, 4), 'dex');
  assert.equal(resolveWeaponAbility(['thrown'], 'str', 1, 4), 'str');
});

test('weaponAttackBonus combines ability mod, proficiency, and magic bonus', () => {
  assert.equal(weaponAttackBonus(3, true, 2, 1), 6);
  assert.equal(weaponAttackBonus(3, false, 2, 1), 4);
  assert.equal(weaponAttackBonus(1, false, 2, 0), 1);
});

test('weaponDamageMod combines ability mod and magic bonus only', () => {
  assert.equal(weaponDamageMod(3, 1), 4);
  assert.equal(weaponDamageMod(1, 0), 1);
});

test('formatBonusBreakdown filters zero terms and formats signs', () => {
  assert.equal(
    formatBonusBreakdown([{ label: 'STR', value: 3 }, { label: 'PROF', value: 2 }]),
    'STR+3 · PROF+2'
  );
  assert.equal(
    formatBonusBreakdown([{ label: 'STR', value: 1 }, { label: 'PROF', value: 0 }, { label: 'magic', value: 1 }]),
    'STR+1 · magic+1'
  );
  assert.equal(
    formatBonusBreakdown([{ label: 'STR', value: -1 }]),
    'STR-1'
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/test_combat_utils.mjs`
Expected: FAIL — `Cannot find module '../static/js/combat-utils.js'`

- [ ] **Step 3: Create `static/js/combat-utils.js`**

```js
export function isAbilityToggleable(props = []) {
  return props.includes('finesse') || props.includes('thrown');
}

export function isRangedWeapon(props = []) {
  return props.includes('ammunition');
}

export function resolveWeaponAbility(props, preferredAbility, strMod, dexMod) {
  if (isRangedWeapon(props)) return 'dex';
  if (isAbilityToggleable(props)) {
    if (preferredAbility === 'str' || preferredAbility === 'dex') return preferredAbility;
    return dexMod > strMod ? 'dex' : 'str';
  }
  return 'str';
}

export function weaponAttackBonus(abilityMod, proficient, profBonus, magicBonus) {
  return abilityMod + (proficient ? profBonus : 0) + magicBonus;
}

export function weaponDamageMod(abilityMod, magicBonus) {
  return abilityMod + magicBonus;
}

export function formatBonusBreakdown(parts) {
  return parts
    .filter(p => p.value)
    .map(p => `${p.label}${p.value >= 0 ? '+' : ''}${p.value}`)
    .join(' · ');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/test_combat_utils.mjs`
Expected: PASS — all 11 tests pass, 0 failures

- [ ] **Step 5: Commit**

```bash
git add static/js/combat-utils.js scripts/test_combat_utils.mjs
git commit -m "feat: add weapon classification and bonus math helpers"
```

---

### Task 2: Wire `combat-utils.js` into `invWeaponRow()` and fix the equipped-weapon filter

**Files:**
- Modify: `static/js/sheet.js:1` (import)
- Modify: `static/js/sheet.js:365-376` (`_invWeaponEntries`)
- Modify: `static/js/sheet.js:400-427` (`invWeaponRow`)
- Modify: `static/js/sheet.js:450-456` (equipped-weapons render filter)
- Modify: `static/js/sheet.js:1279-1284` (add `toggleWeaponAbility` near `toggleWeaponProf`)
- Modify: `static/css/app.css:371-377`

- [ ] **Step 1: Add the import**

In `static/js/sheet.js`, line 1 currently reads:

```js
import { api } from '/static/js/api.js';
```

Change to:

```js
import { api } from '/static/js/api.js';
import {
  isAbilityToggleable,
  isRangedWeapon,
  resolveWeaponAbility,
  weaponAttackBonus,
  weaponDamageMod,
  formatBonusBreakdown,
} from '/static/js/combat-utils.js';
```

- [ ] **Step 2: Fix `_invWeaponEntries()` to not require an `itemData` entry**

Currently (lines 365-376), a weapon is skipped entirely if `itemData` has no entry for its slug — which is always true for plain (non-magical) weapons added via the common-items picker (e.g. `slug: 'com-weapon-rapier'`), since `itemData` only contains the magic-items DB. This means finesse/ranged weapons without a magic bonus would never appear in "Equipped Weapons" at all, so the new toggle/ranged logic would be unreachable for ordinary gear. Fix by checking `it.base_weapon` first, before requiring `lib`:

Replace:

```js
function _invWeaponEntries() {
  return (char.inventory || []).filter(it => {
    if (!it.equipped) return false;
    const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
    if (!lib) return false;
    if (it.base_weapon) return true;
    if (lib.base_weapon_type) return true;
    if (_baseKeyFromName(it.name)) return true;
    if (lib.weapon_bonus) return true;
    return false;
  });
}
```

With:

```js
function _invWeaponEntries() {
  return (char.inventory || []).filter(it => {
    if (!it.equipped) return false;
    if (it.base_weapon) return true;
    const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
    if (!lib) return false;
    if (lib.base_weapon_type) return true;
    if (_baseKeyFromName(it.name)) return true;
    if (lib.weapon_bonus) return true;
    return false;
  });
}
```

- [ ] **Step 3: Apply the same fix to the equipped-weapons render filter**

Currently (lines 450-456 inside `renderCombat`):

```js
    ${(char.inventory || []).map((it, idx) => {
      if (!it.equipped) return '';
      const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
      if (!lib) return '';
      if (!it.base_weapon && !lib.base_weapon_type && !_baseKeyFromName(it.name) && !lib.weapon_bonus) return '';
      return invWeaponRow(it, idx);
    }).join('')}` : ''}
```

Replace with:

```js
    ${(char.inventory || []).map((it, idx) => {
      if (!it.equipped) return '';
      const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
      const isWeapon = it.base_weapon || lib?.base_weapon_type || _baseKeyFromName(it.name) || lib?.weapon_bonus;
      if (!isWeapon) return '';
      return invWeaponRow(it, idx);
    }).join('')}` : ''}
```

- [ ] **Step 4: Rewrite `invWeaponRow()`**

Currently (lines 400-427):

```js
  function invWeaponRow(it, idx) {
    const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
    const bonus = lib?.weapon_bonus || 0;
    const baseKey = it.base_weapon || _baseKeyFromName(it.name);
    const base = baseKey ? BASE_WEAPONS[baseKey] : null;
    const die = base?.die || '1d6';
    const isFinesse = base?.props?.includes('finesse');
    const mod = isFinesse ? Math.max(abilityMod(scores.str || 10), abilityMod(scores.dex || 10)) : abilityMod(scores.str || 10);
    const prof = it.proficient !== false;
    const atk = fmtBonus(mod + (prof ? pb : 0) + bonus);
    const typeParts = [];
    if (base?.type) typeParts.push(base.type);
    if (bonus) typeParts.push(`+${bonus} magic`);
    const typeLine = typeParts.join(' · ');
    const eqBadge = '<span class="eq-dot"></span>';
    return `<div class="weapon-row">
      <div>
        <div class="weapon-name">${escHtml(it.name)}${eqBadge}<span style="font-size:9px;color:#4a4;margin-left:2px">equipped</span></div>
        <div style="font-size:10px;color:#888">${typeLine}</div>
      </div>
      <div class="weapon-atk">${atk}</div>
      <div class="weapon-dmg">${die}${mod >= 0 ? '+' : ''}${mod}</div>
      <div class="prof-toggle" onclick="toggleWeaponProf(${idx})" title="Toggle proficiency">
        <div class="prof-check${prof ? ' on' : ''}"></div>
        <span class="prof-label">PROF</span>
      </div>
    </div>`;
  }
```

Replace with:

```js
  function invWeaponRow(it, idx) {
    const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
    const bonus = lib?.weapon_bonus || 0;
    const baseKey = it.base_weapon || _baseKeyFromName(it.name);
    const base = baseKey ? BASE_WEAPONS[baseKey] : null;
    const die = base?.die || '1d6';
    const props = base?.props || [];
    const strMod = abilityMod(scores.str || 10);
    const dexMod = abilityMod(scores.dex || 10);
    const ability = resolveWeaponAbility(props, it.preferred_ability, strMod, dexMod);
    const mod = ability === 'dex' ? dexMod : strMod;
    const prof = it.proficient !== false;
    const atkBonus = weaponAttackBonus(mod, prof, pb, bonus);
    const dmgMod = weaponDamageMod(mod, bonus);
    const atk = fmtBonus(atkBonus);
    const dmg = `${die}${dmgMod >= 0 ? '+' : ''}${dmgMod}`;
    const atkParts = [{ label: ABILITY_NAMES[ability], value: mod }];
    if (prof) atkParts.push({ label: 'PROF', value: pb });
    if (bonus) atkParts.push({ label: 'magic', value: bonus });
    const dmgParts = [{ label: ABILITY_NAMES[ability], value: mod }];
    if (bonus) dmgParts.push({ label: 'magic', value: bonus });
    const typeParts = [];
    if (base?.type) typeParts.push(base.type);
    if (bonus) typeParts.push(`+${bonus} magic`);
    if (isRangedWeapon(props)) typeParts.push('ranged');
    const typeLine = typeParts.join(' · ');
    const eqBadge = '<span class="eq-dot"></span>';
    const abilityToggle = isAbilityToggleable(props)
      ? `<span class="ability-toggle" onclick="toggleWeaponAbility(${idx})" title="Switch to ${ability === 'dex' ? 'STR' : 'DEX'}">⇄</span>`
      : '';
    return `<div class="weapon-row">
      <div>
        <div class="weapon-name">${escHtml(it.name)}${eqBadge}<span style="font-size:9px;color:#4a4;margin-left:2px">equipped</span></div>
        <div style="font-size:10px;color:#888">${typeLine}</div>
      </div>
      <div class="weapon-col">
        <div class="weapon-atk">${atk}${abilityToggle}</div>
        <div class="weapon-breakdown">${formatBonusBreakdown(atkParts)}</div>
      </div>
      <div class="weapon-col">
        <div class="weapon-dmg">${dmg}</div>
        <div class="weapon-breakdown">${formatBonusBreakdown(dmgParts)}</div>
      </div>
      <div class="prof-toggle" onclick="toggleWeaponProf(${idx})" title="Toggle proficiency">
        <div class="prof-check${prof ? ' on' : ''}"></div>
        <span class="prof-label">PROF</span>
      </div>
    </div>`;
  }
```

- [ ] **Step 5: Add `window.toggleWeaponAbility`**

In `static/js/sheet.js`, currently (lines 1279-1284):

```js
window.toggleWeaponProf = (i) => {
  const inventory = JSON.parse(JSON.stringify(char.inventory || []));
  inventory[i].proficient = inventory[i].proficient === false ? true : false;
  save({ inventory }).then(() => renderActiveTab());
  log('weapon', `Toggled proficiency ${inventory[i].name}: ${inventory[i].proficient}`);
};
```

Add immediately after it:

```js

window.toggleWeaponAbility = (i) => {
  const inventory = JSON.parse(JSON.stringify(char.inventory || []));
  const it = inventory[i];
  const baseKey = it.base_weapon || _baseKeyFromName(it.name);
  const base = baseKey ? BASE_WEAPONS[baseKey] : null;
  const props = base?.props || [];
  const strMod = abilityMod(char.ability_scores?.str || 10);
  const dexMod = abilityMod(char.ability_scores?.dex || 10);
  const current = resolveWeaponAbility(props, it.preferred_ability, strMod, dexMod);
  it.preferred_ability = current === 'dex' ? 'str' : 'dex';
  save({ inventory }).then(() => renderActiveTab());
  log('weapon', `Set ${it.name} attack ability to ${it.preferred_ability}`);
};
```

- [ ] **Step 6: Add CSS for the breakdown subtext, column layout, and ability toggle**

In `static/css/app.css`, currently (lines 371-377):

```css
.weapon-row {
  display: flex; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--border-subtle); gap: 8px;
}
.weapon-name { flex: 1; font-size: 13px; font-weight: 700; }
.weapon-atk { font-size: 12px; color: var(--text-dim); }
.weapon-dmg { font-size: 12px; font-weight: 700; }
```

Replace with:

```css
.weapon-row {
  display: flex; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--border-subtle); gap: 8px;
}
.weapon-name { flex: 1; font-size: 13px; font-weight: 700; }
.weapon-atk { font-size: 12px; color: var(--text-dim); }
.weapon-dmg { font-size: 12px; font-weight: 700; }
.weapon-col { display: flex; flex-direction: column; align-items: center; min-width: 46px; }
.weapon-breakdown { font-size: 9px; color: var(--text-dim); white-space: nowrap; }
.ability-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; margin-left: 3px;
  font-size: 9px; line-height: 1; color: var(--text-dim);
  border: 1px solid var(--border); border-radius: 50%; cursor: pointer;
}
```

- [ ] **Step 7: Commit**

```bash
git add static/js/sheet.js static/css/app.css
git commit -m "feat: show attack/damage breakdown and STR/DEX toggle for equipped weapons"
```

---

### Task 3: End-to-end verification with Playwright

**Files:**
- Create: `scripts/test_combat_display.mjs`

This follows the existing pattern in `scripts/test_choices.mjs` (Playwright against the running dev server at `http://localhost:5000`, login with `hernan` / `hernan@2026!`).

- [ ] **Step 1: Confirm the dev server is running**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/login`
Expected: `200`

If not running, start it (matches `scripts/dnd.service`): `cd /home/hernan/dnd_character && .venv/bin/python src/app.py &`

- [ ] **Step 2: Write the test script**

Create `scripts/test_combat_display.mjs`:

```js
/**
 * Playwright check for the Combat tab "Equipped Weapons" display:
 *  - Plain melee weapon (Warhammer, +1): STR-based, magic bonus applies to
 *    both attack and damage, no ability toggle.
 *  - Finesse weapon (Rapier): defaults to the higher of STR/DEX, shows the
 *    ability toggle, and toggling swaps STR<->DEX in both columns.
 *  - Ranged weapon (Shortbow): always DEX, no ability toggle, "ranged" shown
 *    in the type line.
 * Creates a temporary character (STR 16, DEX 18, level 3 -> prof +2) with
 * these three weapons equipped, then deletes it.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
let pass = 0;
let fail = 0;
function ok(msg) { console.log(`  ✓ ${msg}`); pass++; }
function ko(msg) { console.error(`  ✗ ${msg}`); fail++; }
function check(cond, msg) { if (cond) ok(msg); else ko(msg); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  await page.goto(BASE + '/login');
  await page.fill('#username', 'hernan');
  await page.fill('#password', 'hernan@2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const charId = await page.evaluate(async () => {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Combat Display Test',
        class_key: 'fighter',
        level: 3,
        hp_max: 20,
        hp_current: 20,
        ability_scores: { str: 16, dex: 18, con: 12, int: 10, wis: 10, cha: 10 },
        inventory: [
          { slug: 'weapon-1', name: 'Warhammer, +1', base_weapon: 'warhammer', equipped: true, proficient: true },
          { slug: 'com-weapon-rapier', name: 'Rapier', base_weapon: 'rapier', equipped: true, proficient: true },
          { slug: 'com-weapon-shortbow', name: 'Shortbow', base_weapon: 'shortbow', equipped: true, proficient: true },
        ],
      }),
    });
    const data = await res.json();
    return data.id;
  });

  try {
    await page.goto(`${BASE}/?view=sheet&id=${charId}`);
    await page.waitForTimeout(500);
    const tabs = await page.$$('.tab');
    for (const tab of tabs) {
      if ((await tab.textContent()).trim() === 'Combat') { await tab.click(); break; }
    }
    await page.waitForTimeout(300);

    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.weapon-row')).map(r => ({
        name: r.querySelector('.weapon-name')?.textContent.trim(),
        type: r.querySelector('.weapon-name + div')?.textContent.trim(),
        atk: r.querySelector('.weapon-atk')?.textContent.trim().replace('⇄', ''),
        dmg: r.querySelector('.weapon-dmg')?.textContent.trim(),
        breakdowns: Array.from(r.querySelectorAll('.weapon-breakdown')).map(b => b.textContent.trim()),
        hasToggle: !!r.querySelector('.ability-toggle'),
      }));
    });

    const warhammer = rows.find(r => r.name?.startsWith('Warhammer'));
    check(!!warhammer, 'Warhammer row rendered');
    check(warhammer?.atk === '+6', `Warhammer attack is +6 (STR+3, PROF+2, magic+1) [got ${warhammer?.atk}]`);
    check(warhammer?.dmg === '1d8+4', `Warhammer damage is 1d8+4, magic bonus applied [got ${warhammer?.dmg}]`);
    check(warhammer?.breakdowns[0] === 'STR+3 · PROF+2 · magic+1', `Warhammer attack breakdown [got ${warhammer?.breakdowns[0]}]`);
    check(warhammer?.breakdowns[1] === 'STR+3 · magic+1', `Warhammer damage breakdown [got ${warhammer?.breakdowns[1]}]`);
    check(warhammer?.hasToggle === false, 'Warhammer has no ability toggle');

    const rapier = rows.find(r => r.name?.startsWith('Rapier'));
    check(!!rapier, 'Rapier row rendered');
    check(rapier?.atk === '+6', `Rapier defaults to DEX: attack +6 (DEX+4, PROF+2) [got ${rapier?.atk}]`);
    check(rapier?.dmg === '1d8+4', `Rapier damage 1d8+4 (DEX+4) [got ${rapier?.dmg}]`);
    check(rapier?.breakdowns[0] === 'DEX+4 · PROF+2', `Rapier attack breakdown [got ${rapier?.breakdowns[0]}]`);
    check(rapier?.hasToggle === true, 'Rapier has ability toggle');

    // Toggle Rapier from DEX to STR (index 1 in the inventory array above)
    await page.evaluate(() => window.toggleWeaponAbility(1));
    await page.waitForTimeout(300);
    const rapierAfter = await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('.weapon-row'))
        .find(r => r.querySelector('.weapon-name')?.textContent.trim().startsWith('Rapier'));
      return {
        atk: r.querySelector('.weapon-atk')?.textContent.trim().replace('⇄', ''),
        breakdown: r.querySelector('.weapon-breakdown')?.textContent.trim(),
      };
    });
    check(rapierAfter.atk === '+5', `Rapier toggled to STR: attack +5 (STR+3, PROF+2) [got ${rapierAfter.atk}]`);
    check(rapierAfter.breakdown === 'STR+3 · PROF+2', `Rapier STR breakdown [got ${rapierAfter.breakdown}]`);

    const shortbow = rows.find(r => r.name?.startsWith('Shortbow'));
    check(!!shortbow, 'Shortbow row rendered');
    check(shortbow?.atk === '+6', `Shortbow always DEX: attack +6 (DEX+4, PROF+2) [got ${shortbow?.atk}]`);
    check(shortbow?.dmg === '1d6+4', `Shortbow damage 1d6+4 (DEX+4) [got ${shortbow?.dmg}]`);
    check(shortbow?.type?.includes('ranged'), `Shortbow type line includes "ranged" [got ${shortbow?.type}]`);
    check(shortbow?.hasToggle === false, 'Shortbow has no ability toggle');
  } finally {
    await page.evaluate(async (id) => { await fetch(`/api/characters/${id}`, { method: 'DELETE' }); }, charId);
    await browser.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the test**

Run: `cd /home/hernan/dnd_character/scripts && node test_combat_display.mjs`
Expected: all checks print `✓` and the final line reads `15 passed, 0 failed`. If any check fails, re-open `static/js/sheet.js` and compare against Task 2 step 4/5 before re-running.

- [ ] **Step 4: Commit**

```bash
git add scripts/test_combat_display.mjs
git commit -m "test: add e2e check for combat weapon display"
```

---

## Self-Review Notes

- **Spec coverage:** weapon classification table, `preferred_ability` persistence, attack/damage formulas with magic bonus on both, breakdown subtext, ⇄ toggle for finesse/thrown only, ranged always DEX with "ranged" type-line tag, PROF chip unchanged, manual weapons section untouched — all covered by Tasks 1-3.
- **Beyond spec:** Task 2 Step 2/3 fixes the equipped-weapon filter so plain (non-magical) weapons render at all — without this, the Rapier/Shortbow scenarios from the spec's "Example renders" would never appear in the UI. This is a small, targeted fix required for the feature to work on ordinary gear.
- **Type/name consistency:** `preferred_ability`, `resolveWeaponAbility`, `weaponAttackBonus`, `weaponDamageMod`, `formatBonusBreakdown`, `isAbilityToggleable`, `isRangedWeapon`, and `toggleWeaponAbility` are named identically across Task 1 (definitions) and Task 2 (usage).
