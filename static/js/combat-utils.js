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
