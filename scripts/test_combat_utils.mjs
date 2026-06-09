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
