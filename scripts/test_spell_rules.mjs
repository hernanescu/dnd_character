import test from 'node:test';
import assert from 'node:assert/strict';
import { maxPreparedSpells, cantripsKnown, maxSpellLevel } from '../static/js/spell-rules.js';

const known = { spells_known_by_level: { '3': 6 }, spell_slots_by_level: { '3': { '1': 4, '2': 2 } } };
const cleric = { spells_known_by_level: {}, spell_slots_by_level: { '3': { '1': 4, '2': 2 } }, cantrips_known_by_level: { '1': 3 } };
const paladin = { spells_known_by_level: {}, spell_slots_by_level: { '3': { '1': 3 } }, cantrips_known_by_level: {} };
const warlock = { spells_known_by_level: { '3': 4 }, spell_slots_by_level: {}, cantrips_known_by_level: { '1': 2 } };
const barbarian = { spells_known_by_level: {}, spell_slots_by_level: {} };

test('known casters use the scraped table', () => {
  assert.equal(maxPreparedSpells('bard', known, 3, 2), 6);
});

test('prepared full casters: mod + level (min 1)', () => {
  assert.equal(maxPreparedSpells('cleric', cleric, 3, 2), 5);
  assert.equal(maxPreparedSpells('cleric', cleric, 1, -2), 1);
});

test('prepared half casters: mod + half level (min 1)', () => {
  assert.equal(maxPreparedSpells('paladin', paladin, 3, 2), 3);
  assert.equal(maxPreparedSpells('artificer', paladin, 2, 0), 1);
});

test('non-casters get 0 spells', () => {
  assert.equal(maxPreparedSpells('barbarian', barbarian, 3, 2), 0);
});

test('cantrips come from class data; empty table means none', () => {
  assert.equal(cantripsKnown(cleric, 3), 3);
  assert.equal(cantripsKnown(paladin, 3), 0);
  assert.equal(cantripsKnown({}, 5), 3); // missing table → legacy fallback
});

test('max spell level derives from slots; warlock special-cased', () => {
  assert.equal(maxSpellLevel('cleric', cleric, 3), 2);
  assert.equal(maxSpellLevel('warlock', warlock, 3), 2);
  assert.equal(maxSpellLevel('warlock', warlock, 11), 5);
});
