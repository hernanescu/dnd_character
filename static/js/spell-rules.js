// Pure rules for how many spells/cantrips a character can pick in the builder.
// Known casters (bard, sorcerer, ranger, warlock) have a scraped
// spells_known_by_level table; prepared casters (cleric, druid, wizard,
// paladin, artificer) prepare ability mod + (level or level/2) instead.
const HALF_CASTERS = new Set(['paladin', 'artificer', 'ranger']);

export function maxPreparedSpells(classKey, classData, level, castingMod) {
  const known = classData?.spells_known_by_level?.[String(level)];
  if (known) return known;
  const slots = classData?.spell_slots_by_level || {};
  if (!Object.keys(slots).length) return 0; // non-caster
  const eff = HALF_CASTERS.has(classKey) ? Math.floor(level / 2) : level;
  return Math.max(1, castingMod + eff);
}

export function cantripsKnown(classData, level) {
  const table = classData?.cantrips_known_by_level;
  if (table) {
    const lvls = Object.keys(table).map(Number).filter(l => l <= level);
    return lvls.length ? table[String(Math.max(...lvls))] : 0;
  }
  const fallback = { 1: 2, 4: 3, 10: 4 };
  const ks = Object.keys(fallback).map(Number).filter(l => l <= level);
  return fallback[Math.max(...ks)];
}

export function maxSpellLevel(classKey, classData, level) {
  const slots = classData?.spell_slots_by_level?.[String(level)];
  if (slots && Object.keys(slots).length) return Math.max(...Object.keys(slots).map(Number));
  if (classKey === 'warlock') return Math.min(5, Math.ceil(level / 2));
  return Math.ceil(level / 2); // legacy fallback for missing data
}
