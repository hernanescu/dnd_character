import { api } from '/static/js/api.js';

const SKILLS = [
  { key: 'Acrobatics',      ability: 'dex', label: 'Acrobatics' },
  { key: 'Animal Handling', ability: 'wis', label: 'Animal Handling' },
  { key: 'Arcana',          ability: 'int', label: 'Arcana' },
  { key: 'Athletics',       ability: 'str', label: 'Athletics' },
  { key: 'Deception',       ability: 'cha', label: 'Deception' },
  { key: 'History',         ability: 'int', label: 'History' },
  { key: 'Insight',         ability: 'wis', label: 'Insight' },
  { key: 'Intimidation',    ability: 'cha', label: 'Intimidation' },
  { key: 'Investigation',   ability: 'int', label: 'Investigation' },
  { key: 'Medicine',        ability: 'wis', label: 'Medicine' },
  { key: 'Nature',          ability: 'int', label: 'Nature' },
  { key: 'Perception',      ability: 'wis', label: 'Perception' },
  { key: 'Performance',     ability: 'cha', label: 'Performance' },
  { key: 'Persuasion',      ability: 'cha', label: 'Persuasion' },
  { key: 'Religion',        ability: 'int', label: 'Religion' },
  { key: 'Sleight of Hand', ability: 'dex', label: 'Sleight of Hand' },
  { key: 'Stealth',         ability: 'dex', label: 'Stealth' },
  { key: 'Survival',        ability: 'wis', label: 'Survival' },
];

const ABILITY_NAMES = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

const ARMORS = [
  { key: 'none',        name: 'Unarmored',      type: 'none',   base: 10, dex: true,  maxDex: null },
  { key: 'leather',     name: 'Leather',         type: 'light',  base: 11, dex: true,  maxDex: null },
  { key: 'studded',     name: 'Studded Leather', type: 'light',  base: 12, dex: true,  maxDex: null },
  { key: 'chain_shirt', name: 'Chain Shirt',     type: 'medium', base: 13, dex: true,  maxDex: 2 },
  { key: 'scale_mail',  name: 'Scale Mail',      type: 'medium', base: 14, dex: true,  maxDex: 2 },
  { key: 'breastplate', name: 'Breastplate',     type: 'medium', base: 14, dex: true,  maxDex: 2 },
  { key: 'half_plate',  name: 'Half Plate',      type: 'medium', base: 15, dex: true,  maxDex: 2 },
  { key: 'chain_mail',  name: 'Chain Mail',      type: 'heavy',  base: 16, dex: false, maxDex: 0 },
  { key: 'splint',      name: 'Splint',          type: 'heavy',  base: 17, dex: false, maxDex: 0 },
  { key: 'plate',       name: 'Plate',           type: 'heavy',  base: 18, dex: false, maxDex: 0 },
];

const BASE_WEAPONS = {
  'dagger':        { name: 'Dagger',        die: '1d4', type: 'piercing',   props: ['finesse', 'light', 'thrown'] },
  'shortsword':    { name: 'Shortsword',    die: '1d6', type: 'piercing',   props: ['finesse', 'light'] },
  'longsword':     { name: 'Longsword',     die: '1d8', type: 'slashing',   props: ['versatile (1d10)'] },
  'greatsword':    { name: 'Greatsword',    die: '2d6', type: 'slashing',   props: ['heavy', 'two-handed'] },
  'rapier':        { name: 'Rapier',        die: '1d8', type: 'piercing',   props: ['finesse'] },
  'shortbow':      { name: 'Shortbow',      die: '1d6', type: 'piercing',   props: ['ammunition', 'two-handed'] },
  'longbow':       { name: 'Longbow',       die: '1d8', type: 'piercing',   props: ['ammunition', 'heavy', 'two-handed'] },
  'light-crossbow':{ name: 'Light Crossbow',die: '1d8', type: 'piercing',   props: ['ammunition', 'loading', 'two-handed'] },
  'handaxe':       { name: 'Handaxe',       die: '1d6', type: 'slashing',   props: ['light', 'thrown'] },
  'battleaxe':     { name: 'Battleaxe',     die: '1d8', type: 'slashing',   props: ['versatile (1d10)'] },
  'warhammer':     { name: 'Warhammer',     die: '1d8', type: 'bludgeoning',props: ['versatile (1d10)'] },
  'scimitar':      { name: 'Scimitar',      die: '1d6', type: 'slashing',   props: ['finesse', 'light'] },
  'quarterstaff':  { name: 'Quarterstaff',  die: '1d6', type: 'bludgeoning',props: ['versatile (1d8)'] },
  'mace':          { name: 'Mace',          die: '1d6', type: 'bludgeoning',props: [] },
  'spear':         { name: 'Spear',         die: '1d6', type: 'piercing',   props: ['thrown', 'versatile (1d8)'] },
  'hand-crossbow': { name: 'Hand Crossbow', die: '1d6', type: 'piercing',   props: ['ammunition', 'light', 'loading'] },
  'heavy-crossbow':{ name: 'Heavy Crossbow',die: '1d10',type: 'piercing',   props: ['ammunition', 'heavy', 'loading', 'two-handed'] },
  'glaive':        { name: 'Glaive',        die: '1d10',type: 'slashing',   props: ['heavy', 'reach', 'two-handed'] },
  'halberd':       { name: 'Halberd',       die: '1d10',type: 'slashing',   props: ['heavy', 'reach', 'two-handed'] },
  'morningstar':   { name: 'Morningstar',   die: '1d8', type: 'piercing',   props: [] },
  'whip':          { name: 'Whip',          die: '1d4', type: 'slashing',   props: ['finesse', 'reach'] },
  'club':          { name: 'Club',          die: '1d4', type: 'bludgeoning',props: ['light'] },
};

function getEquippedBonuses() {
  const inv = char.inventory || [];
  const out = { ac: 0, saves: 0 };
  for (const item of inv) {
    if (!item.equipped) continue;
    const lib = item.slug ? (itemData || {})[item.slug] : findItemByName(item.name);
    if (!lib) continue;
    if (lib.attunement === 'Yes' && !item.attuned) continue;
    out.ac += lib.ac_bonus || 0;
    out.saves += lib.save_bonus || 0;
  }
  return out;
}

function activeAttunementCount() {
  return (char.inventory || []).filter(i => {
    const lib = i.slug ? (itemData || {})[i.slug] : findItemByName(i.name);
    return lib && lib.attunement === 'Yes' && i.attuned;
  }).length;
}

function attunementSlotCount() {
  return (char.inventory || []).filter(i => {
    const lib = i.slug ? (itemData || {})[i.slug] : findItemByName(i.name);
    return lib && lib.attunement === 'Yes';
  }).length;
}

function _invArmorEntry() {
  return (char.inventory || []).find(it => it.equipped && it.base_armor);
}

function _invShieldEntry() {
  return (char.inventory || []).find(it => {
    if (!it.equipped) return false;
    const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
    return lib && lib.name.toLowerCase().startsWith('shield, +');
  });
}

function computeAC() {
  const invArmor = _invArmorEntry();
  const manualArmor = char.armor || { key: 'none', shield: false };
  const armorKey = invArmor ? invArmor.base_armor : manualArmor.key;
  const armorDef = ARMORS.find(a => a.key === armorKey) || ARMORS[0];
  const dexMod = abilityMod(char.ability_scores?.dex || 10);
  let ac = armorDef.base;
  if (armorDef.dex) {
    ac += armorDef.maxDex !== null ? Math.min(dexMod, armorDef.maxDex) : dexMod;
  }
  const hasShield = !!_invShieldEntry() || manualArmor.shield;
  if (hasShield) ac += 2;
  ac += getEquippedBonuses().ac;
  return ac;
}
const ARMOR_COSTS = { leather: 10, studded: 45, chain_shirt: 50, scale_mail: 50, breastplate: 400, half_plate: 750, chain_mail: 75, splint: 200, plate: 1500 };

const COMMON_ITEMS = [
  ...ARMORS.filter(a => a.key !== 'none').map(a => ({ slug: `com-armor-${a.key}`, name: a.name, cost_gp: ARMOR_COSTS[a.key] || 0, base_armor_type: true })),
  ...Object.entries(BASE_WEAPONS).map(([key, w]) => ({ slug: `com-weapon-${key}`, name: w.name, cost_gp: 0, base_weapon_type: true })),
  { slug: 'com-backpack', name: 'Backpack', cost_gp: 2 },
  { slug: 'com-bedroll', name: 'Bedroll', cost_gp: 1 },
  { slug: 'com-candle', name: 'Candle', cost_gp: 0.01 },
  { slug: 'com-rations', name: 'Rations (1 day)', cost_gp: 0.5 },
  { slug: 'com-waterskin', name: 'Waterskin', cost_gp: 0.2 },
  { slug: 'com-hempen-rope', name: 'Hempen Rope (50 ft)', cost_gp: 1 },
  { slug: 'com-torch', name: 'Torch', cost_gp: 0.01 },
  { slug: 'com-potion-healing', name: 'Potion of Healing', cost_gp: 50 },
  { slug: 'com-arrows', name: 'Arrows (20)', cost_gp: 1 },
  { slug: 'com-bolts', name: 'Bolts (20)', cost_gp: 1 },
  { slug: 'com-holy-water', name: 'Holy Water (flask)', cost_gp: 25 },
  { slug: 'com-alchemist-fire', name: "Alchemist's Fire (flask)", cost_gp: 50 },
  { slug: 'com-manacles', name: 'Manacles', cost_gp: 2 },
  { slug: 'com-thieves-tools', name: "Thieves' Tools", cost_gp: 25 },
  { slug: 'com-healers-kit', name: "Healer's Kit", cost_gp: 5 },
  { slug: 'com-component-pouch', name: 'Component Pouch', cost_gp: 25 },
];

const ABILITY_FULL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const SPELLCASTING_ABILITY = { artificer: 'int', bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int' };
function getTabs() {
  const hasSpells = spellData && Object.keys(spellData).length > 0;
  return hasSpells ? ['Stats', 'Combat', 'Spells', 'Inventory', 'Feats', 'World'] : ['Stats', 'Combat', 'Inventory', 'Feats', 'World'];
}

let char = null;
let classData = null;
let spellData = null;
let bgData = null;
let itemData = null;
let activeTab = 0;
let editMode = false;
let _expandedItems = {};
let _worldAddType = null;

function abilityMod(score) { return Math.floor((score - 10) / 2); }
function profBonus(level) { return Math.floor((level - 1) / 4) + 2; }
function bardicInspirationMax() { return Math.max(1, abilityMod(char.ability_scores?.cha ?? 10)); }
function fmtBonus(n) { return (n >= 0 ? '+' : '') + n; }
function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function log(category, msg, data) {
  const entry = { t: new Date().toISOString(), c: category, m: msg };
  if (data) entry.d = data;
  console.log(`[${category}] ${msg}`, data || '');
  try { fetch('/api/log', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entry) }); } catch(e) {}
}
window.toggleTheme = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dnd-theme', next);
};

function skillBonus(skillKey, skillAbility) {
  const mod = abilityMod(char.ability_scores[skillAbility]);
  const pb = profBonus(char.level);
  const prof = char.skill_proficiencies.includes(skillKey);
  const exp = char.expertise.includes(skillKey);
  let bonus = mod;
  if (exp) { bonus += pb * 2; }
  else if (prof) { bonus += pb; }
  else if (char.class_key === 'bard' && char.level >= 2) { bonus += Math.floor(pb / 2); }
  return bonus;
}

let _saveQueue = Promise.resolve();
function save(patch) {
  Object.assign(char, patch);
  const snapshot = JSON.parse(JSON.stringify(patch));
  _saveQueue = _saveQueue
    .then(() => api.updateCharacter(char.id, snapshot))
    .then(() => log('save', `Saved ${Object.keys(snapshot).join(', ')}`))
    .catch(e => { console.error('Save error', e); log('save', `Save error: ${e.message}`); });
  return _saveQueue;
}

export async function initSheet(id) {
  const app = document.getElementById('app');
  app.innerHTML = `<div style="padding:24px;text-align:center;color:#888">Loading...</div>`;
  try {
    const charData = await api.getCharacter(id);
    [char, classData, spellData, bgData, itemData] = await Promise.all([
      charData, api.getClass(charData.class_key), api.getSpells(charData.class_key), api.getBackgrounds(), api.getItems(),
    ]);
    char.background_name = (bgData[char.background] || {}).name || char.background;
    char.lucky_points = char.lucky_points ?? 3;
    char.expertise = char.expertise ?? [];
    char.bardic_inspiration = char.bardic_inspiration ?? bardicInspirationMax();
  } catch (e) {
    app.innerHTML = `<div style="padding:24px;color:#888">Error loading character</div>`;
    return;
  }
  render();
}

function render() {
  const app = document.getElementById('app');
  const tabs = getTabs();
  const clsName = char.class_key.charAt(0).toUpperCase() + char.class_key.slice(1);
  const acVal = computeAC();
  const ppVal = 10 + skillBonus('perception', 'wis');
  const hpPct = char.hp_current / char.hp_max;
  app.innerHTML = `
    <div class="app-header">
      <div style="flex:1;min-width:0">
        <button class="back-btn" style="padding:0 0 6px;color:#888" onclick="window.location='/'">‹ Characters</button>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="char-name" style="flex-shrink:0">${escHtml(char.name)}</div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            <div class="stat-pill" title="Armor Class"><span class="stat-pill-val">${acVal}</span> AC</div>
            <div class="stat-pill" title="Passive Perception"><span class="stat-pill-val">${ppVal}</span> PP</div>
            <div class="stat-pill stat-pill-hp" onclick="openHpEditor()" style="cursor:pointer" title="Hit Points">
              <span class="stat-pill-val" style="${hpPct <= 0.3 ? 'color:#ff6b6b' : ''}">${char.hp_current}</span>
              / ${char.hp_max} HP
            </div>
            <button class="icon-btn" onclick="event.stopPropagation();toggleTheme()" title="Toggle theme">🌓</button>
            <button class="icon-btn icon-btn-danger" onclick="event.stopPropagation();deleteCurrentChar(${char.id},'${escHtml(char.name)}')" title="Delete character">✕</button>
          </div>
        </div>
        <div class="char-meta">${clsName}${char.subclass_key ? ` · ${escHtml(char.subclass_key)}` : ''} · Level ${char.level} · ${escHtml(char.background_name)}</div>
      </div>
    </div>
    <div class="resource-bar">
      ${[['momentum','Momentum',0,10],['supply','Supplies',0,5],['stress','Stress',0,5],['lucky_points','Lucky',0,3]].map(([key,label,min,max]) => {
        const val = char[key] ?? RESOURCE_DEFAULTS[key];
        return `<div class="resource-item">
          <div class="resource-label">${label}</div>
          <div class="resource-controls">
            <button class="resource-btn" onclick="adjResource('${key}',-1)">−</button>
            <div class="resource-val" id="res-${key}">${val}</div>
            <button class="resource-btn" onclick="adjResource('${key}',+1)">+</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="tabs">
      ${tabs.map((t, i) => `<div class="tab${activeTab === i ? ' active' : ''}" onclick="switchTab(${i})">${t}</div>`).join('')}
    </div>
    ${tabs.map((_, i) => `<div class="tab-content${activeTab === i ? ' active' : ''}" id="tab-${i}"></div>`).join('')}
  `;
  renderActiveTab();
}

function renderActiveTab() {
  const tabs = getTabs();
  const renderers = { Stats: renderStats, Combat: renderCombat, Spells: renderSpells, Inventory: renderInventory, Feats: renderFeats, World: renderWorld };
  const fn = renderers[tabs[activeTab]];
  if (fn) fn(document.getElementById(`tab-${activeTab}`));
}

function renderStats(el) {
  const scores = char.ability_scores;
  const pb = profBonus(char.level);
  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
    </div>
    <div class="section-title">Ability Scores</div>
    <div class="ability-grid">
      ${['str','dex','con','int','wis','cha'].map(ab => { const v = scores[ab] ?? 10; return `
        <div class="ability-box">
          <div class="ability-label">${ABILITY_FULL[ab]}</div>
          <div class="ability-score">${v}</div>
          <div class="ability-mod">${fmtBonus(abilityMod(v))}</div>
        </div>`; }).join('')}
    </div>
    <div class="section-title">Saving Throws</div>
    ${(() => { const eq = getEquippedBonuses(); return ['str','dex','con','int','wis','cha'].map(ab => {
      const isProf = classData?.saving_throws?.includes(ab);
      const bonus = abilityMod(scores[ab]) + (isProf ? pb : 0) + eq.saves;
      const eqStr = eq.saves ? ` <span style="font-size:9px;color:#888">+${eq.saves} eq</span>` : '';
      return `<div class="save-row">
        <div class="save-dot${isProf ? ' prof' : ''}"></div>
        <div class="save-name">${ABILITY_FULL[ab]}</div>
        <div class="save-bonus">${fmtBonus(bonus)}${eqStr}</div>
      </div>`;
    }).join(''); })()}
    <div class="section-title">Skills</div>
    ${SKILLS.map(sk => {
      const bonus = skillBonus(sk.key, sk.ability);
      const prof = char.skill_proficiencies.includes(sk.key);
      const exp = char.expertise.includes(sk.key);
      const dotCls = exp ? 'expert' : prof ? 'prof' : '';
      return `<div class="skill-row">
        <div class="skill-dot ${dotCls}" onclick="${editMode ? `toggleSkillProf('${sk.key}')` : ''}"></div>
        <div class="skill-name">${sk.label}</div>
        <div class="skill-ability">${ABILITY_NAMES[sk.ability]}</div>
        <div class="skill-bonus">${fmtBonus(bonus)}</div>
      </div>`;
    }).join('')}
    <div class="prof-info" style="margin-top:12px">
      <span style="font-size:11px;color:#888">Proficiency Bonus: <b>${fmtBonus(pb)}</b></span>
    </div>
    ${renderBgCard()}
  `;
}

function renderBgCard() {
  const bg = bgData?.[char.background];
  if (!bg) return '';
  const skills = bg.skill_proficiencies || [];
  const tools = bg.tool_proficiencies || [];
  const langs = bg.languages || 0;
  const features = bg.features || [];

  const featureHtml = features.map(f => {
    let html = `<div style="margin-top:6px"><b>${escHtml(f.name)}</b>`;
    if (f.description) {
      html += `<div style="font-size:11px;color:var(--text);margin-top:2px">${escHtml(f.description)}</div>`;
    }
    if (f.table && f.table.entries?.length) {
      html += `<div style="margin-top:4px;font-size:10px">`;
      for (const [die, entry] of f.table.entries) {
        html += `<div style="padding:1px 0"><span style="color:#888">${escHtml(die)}</span> ${escHtml(entry)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }).join('');

  return `
    <div class="section-title" style="margin-top:16px">Background: ${escHtml(bg.name)}</div>
    <div style="padding:10px 12px;background:var(--gray-bg);border-radius:6px;font-size:12px">
      ${bg.description ? `<div style="font-size:13px;line-height:1.65;margin-bottom:6px">${escHtml(bg.description)}</div>` : ''}
      ${skills.length ? `<div style="margin-bottom:2px"><span style="color:#888">Skills:</span> <b>${escHtml(skills.join(', '))}</b></div>` : ''}
      ${tools.length ? `<div style="margin-bottom:2px"><span style="color:#888">Tools:</span> ${escHtml(tools.join(', '))}</div>` : ''}
      ${langs ? `<div style="margin-bottom:2px"><span style="color:#888">Languages:</span> +${langs} of choice</div>` : ''}
      ${bg.equipment ? `<div style="margin-bottom:2px"><span style="color:#888">Equipment:</span> ${escHtml(bg.equipment)}</div>` : ''}
      ${featureHtml}
    </div>`;
}

function _baseKeyFromName(name) {
  const n = name.toLowerCase();
  return Object.keys(BASE_WEAPONS).find(k => n.includes(BASE_WEAPONS[k].name.toLowerCase())) || null;
}

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

function renderCombat(el) {
  const scores = char.ability_scores;
  const pb = profBonus(char.level);
  const dexMod = abilityMod(scores.dex);
  const conMod = abilityMod(scores.con);
  const weapons = char.weapons || [];
  const invWeapons = _invWeaponEntries();
  const subclassName = char.subclass_key && classData?.subclasses?.[char.subclass_key]?.name || '—';

  function wRow(label, die, atkBonus, dmgBonus, typeLine, deletable) {
    const dmg = `${die}${dmgBonus >= 0 ? '+' : ''}${dmgBonus}`;
    return `<div class="weapon-row">
      <div>
        <div class="weapon-name">${label}</div>
        <div style="font-size:10px;color:#888">${typeLine}</div>
      </div>
      <div class="weapon-atk">${atkBonus}</div>
      <div class="weapon-dmg">${dmg}</div>
      ${deletable ? `<button class="delete-btn" onclick="removeWeapon(${deletable})">×</button>` : ''}
    </div>`;
  }

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

  el.innerHTML = `
    <div class="hp-editor">
      <button class="hp-editor-btn" onclick="adjustHp(-1)">−</button>
      <div style="flex:1;text-align:center">
        <div class="hp-editor-val">${char.hp_current}</div>
        <div class="hp-editor-max">of ${char.hp_max} HP</div>
      </div>
      <button class="hp-editor-btn" onclick="adjustHp(+1)">+</button>
    </div>
    <div class="combat-grid">
      <div class="stat-box"><div class="stat-val">${computeAC()}</div><div class="stat-label">AC</div></div>
      <div class="stat-box"><div class="stat-val">${fmtBonus(dexMod)}</div><div class="stat-label">Initiative</div></div>
      <div class="stat-box"><div class="stat-val">30 ft</div><div class="stat-label">Speed</div></div>
      <div class="stat-box"><div class="stat-val">${fmtBonus(pb)}</div><div class="stat-label">Prof Bonus</div></div>
      <div class="stat-box"><div class="stat-val">${char.hp_max}</div><div class="stat-label">Max HP</div></div>
      <div class="stat-box"><div class="stat-val">${fmtBonus(conMod)}</div><div class="stat-label">Con Mod</div></div>
    </div>
    ${invWeapons.length ? `
    <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;margin-top:6px">
      <span>Equipped Weapons</span>
    </div>
    ${(char.inventory || []).map((it, idx) => {
      if (!it.equipped) return '';
      const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
      if (!lib) return '';
      if (!it.base_weapon && !lib.base_weapon_type && !_baseKeyFromName(it.name) && !lib.weapon_bonus) return '';
      return invWeaponRow(it, idx);
    }).join('')}` : ''}
    <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;${invWeapons.length ? 'margin-top:10px' : ''}">
      <span>Weapons</span>
      <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
    </div>
    ${weapons.length ? weapons.map((w, i) => {
      const linkedInv = w.linkedInvName ? (char.inventory || []).find(it => it.name === w.linkedInvName) : null;
      const invLib = linkedInv ? (linkedInv.slug ? (itemData || {})[linkedInv.slug] : findItemByName(linkedInv.name)) : null;
      const wBonus = invLib?.weapon_bonus || (w.slug ? (itemData || {})[w.slug]?.weapon_bonus : 0) || 0;
      const mod = abilityMod(scores[w.ability] || 10);
      const atk = fmtBonus(mod + (w.proficient ? pb : 0) + wBonus);
      const dmgParts = [];
      if (linkedInv?.base_weapon && BASE_WEAPONS[linkedInv.base_weapon]) dmgParts.push(BASE_WEAPONS[linkedInv.base_weapon].die);
      else dmgParts.push(w.damage_die || '1d6');
      const dmgDie = dmgParts[0];
      const dmg = `${dmgDie}${mod >= 0 ? '+' : ''}${mod}`;
      const bonusTag = wBonus ? ` <span style="font-size:9px;color:#888">+${wBonus} eq</span>` : '';
      const linkBadge = linkedInv
        ? (linkedInv.equipped
          ? '<span style="font-size:9px;color:#4a4;margin-left:4px">● in inventory</span>'
          : '<span style="font-size:9px;color:#a84;margin-left:4px">⚠ unequipped</span>')
        : '';
      return `<div class="weapon-row">
        <div>
          <div class="weapon-name">${escHtml(w.name)}${bonusTag}${linkBadge}</div>
          <div style="font-size:10px;color:#888">${escHtml(w.type || '')}</div>
        </div>
        <div class="weapon-atk">${atk}</div>
        <div class="weapon-dmg">${dmg}</div>
        ${editMode ? `<button class="delete-btn" onclick="removeWeapon(${i})">×</button>` : ''}
      </div>`;
    }).join('') : '<div style="padding:8px;color:#888;font-size:12px">No weapons. Add one below.</div>'}
    ${editMode ? `
    <div class="add-row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
      <div style="flex:2;min-width:120px;position:relative">
        <input class="input-field" id="w-name" placeholder="Weapon name" style="width:100%" oninput="onWeaponNameInput()">
        <div id="w-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:10;background:var(--card-bg);border:1px solid var(--gray-light);border-radius:4px;max-height:150px;overflow-y:auto"></div>
      </div>
      <input class="input-field input-sm" id="w-die-qty" type="number" min="1" max="9" value="1" style="width:40px">
      <select class="input-field input-sm" id="w-die" style="width:60px">
        <option value="d4">d4</option>
        <option value="d6" selected>d6</option>
        <option value="d8">d8</option>
        <option value="d10">d10</option>
        <option value="d12">d12</option>
      </select>
      <input class="input-field input-sm" id="w-type" placeholder="Type" style="width:70px">
      <select class="input-field input-sm" id="w-ability">${['str','dex','cha'].map(a=>`<option value="${a}">${ABILITY_NAMES[a]}</option>`).join('')}</select>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="checkbox" id="w-prof" checked> Prof</label>
      <button class="btn btn-primary btn-sm" onclick="addWeapon()">+ Add</button>
    </div>
    <div id="w-link-status" style="font-size:10px;color:#888;margin-top:4px"></div>` : ''}
    ${char.class_key === 'bard' ? `
    <div class="section-title">Bardic Inspiration</div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="inspiration-die">${inspirationDieByLevel(char.level)}</div>
        <div style="font-size:12px;color:var(--gray-dark)">${subclassName}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="resource-btn" onclick="adjBardicInspiration(-1)">−</button>
        <div class="resource-val" id="res-bardic_inspiration">${char.bardic_inspiration ?? bardicInspirationMax()}</div>
        <span style="font-size:11px;color:var(--gray-mid)">/ ${bardicInspirationMax()}</span>
        <button class="resource-btn" onclick="adjBardicInspiration(+1)">+</button>
      </div>
    </div>` : ''}
    <div class="section-title">Saving Throws</div>
    <div class="saves-grid">
    ${(() => { const eq = getEquippedBonuses(); return ['str','dex','con','int','wis','cha'].map(ab => {
      const isProf = classData?.saving_throws?.includes(ab);
      const bonus = abilityMod(scores[ab]) + (isProf ? pb : 0) + eq.saves;
      return `<div class="save-box">
        <div class="save-bonus">${fmtBonus(bonus)}</div>
        <div class="save-name">${ABILITY_FULL[ab]}${isProf ? ' •' : ''}${eq.saves ? '+' : ''}</div>
      </div>`;
    }).join(''); })()}
    </div>
  `;
}

function inspirationDieByLevel(level) {
  if (level >= 15) return 'd12';
  if (level >= 10) return 'd10';
  if (level >= 5) return 'd8';
  return 'd6';
}

let expandedLevels = {};

function renderSpells(el) {
  const scores = char.ability_scores;
  const pb = profBonus(char.level);
  const castingAb = SPELLCASTING_ABILITY[char.class_key] || 'cha';
  const castingMod = abilityMod(scores[castingAb]);
  const spellDC = 8 + pb + castingMod;
  const spellAtk = pb + castingMod;
  const slots = char.spell_slots || {};
  const allSpells = spellData || {};
  const known = char.spells_known || [];
  const knownSpells = known.map(k => allSpells[k] ? { ...allSpells[k], _key: k } : null).filter(Boolean);

  const grouped = {};
  for (const s of knownSpells) {
    const key = s.level === 0 ? 0 : s.level;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  const levels = Object.keys(grouped).sort((a, b) => +a - +b);

  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
    </div>
    <div class="spell-dc-bar">
      <div class="spell-dc-item"><div class="spell-dc-val">${spellDC}</div><div class="spell-dc-label">Spell DC</div></div>
      <div class="spell-dc-item"><div class="spell-dc-val">${fmtBonus(spellAtk)}</div><div class="spell-dc-label">Spell Atk</div></div>
      <div class="spell-dc-item"><div class="spell-dc-val">${fmtBonus(castingMod)}</div><div class="spell-dc-label">${ABILITY_NAMES[castingAb]} Mod</div></div>
    </div>
    ${Object.keys(slots).length ? `
    <div class="section-title">Spell Slots</div>
    ${Object.entries(slots).sort(([a],[b])=>+a-+b).map(([lvl, s]) => `
      <div class="spell-level-row">
        <div class="spell-level-label">Lv ${lvl}</div>
        <div style="flex:1;text-align:center;font-size:15px;font-weight:700">${s.max - s.used}/${s.max}</div>
        <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="useSlot('${lvl}')">−</button>
        <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="freeSlot('${lvl}')">+</button>
        <button class="btn-icon" style="font-size:14px" onclick="restoreSlots('${lvl}')" title="Restore all">↺</button>
      </div>`).join('')}` : ''}
    ${!known.length ? '<div style="padding:24px;text-align:center;color:#888;font-size:13px">No known spells</div>' : ''}
    ${levels.map(lvl => {
      const label = lvl == 0 ? 'Cantrips' : ordinalLabel(lvl);
      const isOpen = expandedLevels[lvl] !== false;
      return `
      <div class="spell-level-group">
        <div class="spell-level-header" onclick="toggleLevel(${lvl})">
          <span class="spell-level-arrow">${isOpen ? '▾' : '▸'}</span>
          <span class="spell-level-title">${label}</span>
          <span class="spell-level-count">${grouped[lvl].length}</span>
        </div>
        <div class="spell-level-body${isOpen ? ' open' : ''}">
          ${grouped[lvl].map(s => spellCard(s)).join('')}
        </div>
      </div>`;
    }).join('')}
  `;
}

function ordinalLabel(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function spellCard(s) {
  const levelLabel = s.level === 0 ? 'Cantrip' : `Lv ${s.level}`;
  const ritual = s.ritual ? ' <span class="spell-tag">R</span>' : '';
  const conc = s.concentration ? ' <span class="spell-tag">C</span>' : '';
  const removeBtn = editMode && s._key
    ? `<button class="delete-btn" data-spell-key="${escHtml(s._key)}" onclick="event.stopPropagation();removeSpell(this.dataset.spellKey)" title="Remove">×</button>`
    : '';
  return `<div class="spell-card" onclick="this.classList.toggle('expanded')">
    <div class="spell-header">
      <span class="spell-level-badge">${levelLabel}</span>
      <span class="spell-name">${escHtml(s.name)}${ritual}${conc}</span>
      <span class="spell-school">${escHtml(s.school)}</span>
      ${removeBtn}
    </div>
    <div class="spell-desc">${escHtml(s.description)}</div>
    <div class="spell-meta">
      <span><b>Casting:</b> ${escHtml(s.casting_time || '')}</span>
      <span><b>Range:</b> ${escHtml(s.range || '')}</span>
      <span><b>Components:</b> ${escHtml(s.components || '')}${s.material ? ' (' + escHtml(s.material) + ')' : ''}</span>
      <span><b>Duration:</b> ${escHtml(s.duration || '')}</span>
    </div>
    ${s.higher_levels ? `<div class="spell-higher">${escHtml(s.higher_levels)}</div>` : ''}
  </div>`;
}

function findItemByName(name) {
  if (!itemData) return null;
  const key = Object.keys(itemData).find(k => itemData[k].name.toLowerCase() === name.toLowerCase());
  return key ? itemData[key] : null;
}

const RARITY_COLORS = { common: '#888', uncommon: '#2d7d46', rare: '#2a5a9e', 'very rare': '#8b3a9e', legendary: '#c97d2e', artifact: '#c93232' };

let _itemPickerFilter = '';

function _acBreakdown() {
  const invArmor = _invArmorEntry();
  const manual = char.armor || { key: 'none', shield: false };
  const key = invArmor ? invArmor.base_armor : manual.key;
  const d = ARMORS.find(x => x.key === key) || ARMORS[0];
  const dex = abilityMod(char.ability_scores?.dex || 10);
  const parts = [];
  if (d.type === 'none') parts.push(`10 + DEX(${dex})`);
  else if (d.type === 'light') parts.push(`${d.base} + DEX(${dex})`);
  else if (d.type === 'medium') parts.push(`${d.base} + DEX(min ${dex},${d.maxDex})`);
  else parts.push(`${d.base} (no DEX)`);
  const hasShield = !!_invShieldEntry() || manual.shield;
  if (hasShield) parts.push('Shield +2');
  const eq = getEquippedBonuses();
  if (eq.ac) parts.push(`Items +${eq.ac}`);
  return parts.join(' + ');
}

function renderInventory(el) {
  const coins = char.coins || { pp:0, gp:0, ep:0, sp:0, cp:0 };
  const inventory = char.inventory || [];
  const baseArmor = char.armor || { key: 'none', shield: false };
  const baseDef = ARMORS.find(a => a.key === baseArmor.key) || ARMORS[0];
  const totalGP = (coins.gp || 0) + (coins.pp || 0) * 10 + (coins.ep || 0) * 0.5 + (coins.sp || 0) * 0.1 + (coins.cp || 0) * 0.01;
  const eqBonuses = getEquippedBonuses();
  const attCount = activeAttunementCount();
  const attTotal = attunementSlotCount();

  function libFor(item) {
    return item.slug ? (itemData || {})[item.slug] : findItemByName(item.name);
  }

  function bonuses(lib) {
    if (!lib) return [];
    const b = [];
    if (lib.ac_bonus) b.push(`AC +${lib.ac_bonus}`);
    if (lib.weapon_bonus) b.push(`Atk +${lib.weapon_bonus}`);
    if (lib.save_bonus) b.push(`Save +${lib.save_bonus}`);
    if (lib.set_score != null) b.push(`Ability +${lib.set_score}`);
    if (lib.rare_material) b.push(lib.rare_material);
    if (lib.spell_level != null) b.push(`Spell Lv ${lib.spell_level}`);
    if (lib.condition) b.push(lib.condition);
    return b;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--gray-bg);border-radius:6px;margin-bottom:12px">
      <div>
        <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.05em">Armor Class</div>
        <div style="font-size:22px;font-weight:700">${computeAC()}</div>
        ${_invArmorEntry() ? `<div style="font-size:9px;color:#4a4">from ${escHtml(_invArmorEntry().name)}</div>` : ''}
        ${_invShieldEntry() ? `<div style="font-size:9px;color:#4a4">+ ${escHtml(_invShieldEntry().name)}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:9px;color:#888;line-height:1.5">
        ${_acBreakdown().split(' + ').map(p => `<div>${p}</div>`).join('')}
      </div>
      ${editMode && !_invArmorEntry() ? `<div style="margin-left:8px;display:flex;flex-direction:column;gap:2px">
        <select class="input-field input-sm" style="font-size:9px;padding:2px 4px;width:80px" onchange="equipArmor(this.value)">
          ${ARMORS.map(a => `<option value="${a.key}" ${baseArmor.key === a.key ? 'selected' : ''}>${escHtml(a.name)}</option>`).join('')}
        </select>
        <label style="font-size:9px;display:flex;align-items:center;gap:2px;cursor:pointer">
          <input type="checkbox" ${baseArmor.shield ? 'checked' : ''} onchange="toggleShield()"> Shield +2
        </label>
      </div>` : ''}
    </div>

    <div class="section-title">Coins</div>
    <div class="coin-grid">
      ${['pp','gp','ep','sp','cp'].map(c => `
        <div class="coin-box">
          <div class="coin-val" onclick="editCoin('${c}')">${coins[c] ?? 0}</div>
          <div class="coin-label">${c.toUpperCase()}</div>
        </div>`).join('')}
      <div class="coin-box" style="background:var(--card-bg)">
        <div class="coin-val" style="font-size:11px">${totalGP.toFixed(0)}</div>
        <div class="coin-label">TOTAL GP</div>
      </div>
    </div>

    <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;margin-top:16px">
      <span>Items</span>
      <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
    </div>
    ${attTotal > 0 ? `
    <div style="margin-bottom:8px;padding:6px 8px;background:var(--gray-bg);border-radius:4px;font-size:11px;display:flex;align-items:center;gap:8px">
      <span style="font-weight:600">Attunement:</span>
      <span style="color:${attCount > 3 ? '#c44' : '#888'}">${attCount}/3</span>
      <span style="color:#888;font-size:10px">(${attTotal} items require attunement)</span>
    </div>` : ''}
    ${inventory.length === 0 ? '<div style="padding:12px;color:#888;font-size:12px;text-align:center">No items carried.</div>' : inventory.map((item, i) => {
      const lib = libFor(item);
      const rColor = lib ? (RARITY_COLORS[(lib.rarity || '').toLowerCase()] || '#888') : '#888';
      const isEq = !!item.equipped;
      const isAt = !!item.attuned;
      const needsAt = lib?.attunement === 'Yes';
      const canBenefit = isEq && (!needsAt || isAt);
      const bonusList = bonuses(lib);
      return `<div class="spell-card" style="margin-bottom:6px">
        <div class="spell-header" onclick="toggleItemDetail(${i})" style="cursor:pointer">
          <span style="font-size:10px;color:#888;width:14px;flex-shrink:0" id="item-arrow-${i}">▸</span>
          <span style="font-size:11px;flex-shrink:0;width:14px;text-align:center;cursor:pointer" onclick="event.stopPropagation();toggleEquip(${i})" title="${isEq ? 'Equipped (click to unequip)' : 'Unequipped (click to equip)'}">${isEq ? '<span style="color:#4a4">●</span>' : '<span style="color:#aaa">○</span>'}</span>
          ${lib ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${rColor};flex-shrink:0"></span>` : ''}
          <span class="spell-name" style="font-size:12px">${escHtml(item.name)}</span>
          <span class="spell-school" style="font-size:13px;font-weight:600;color:var(--text)">x${item.qty}</span>
          ${editMode ? `<button class="delete-btn" onclick="event.stopPropagation();removeItem(${i})" style="font-size:11px;flex-shrink:0">×</button>` : ''}
        </div>
        <div id="item-detail-${i}" class="spell-desc" style="display:none;padding-top:6px">
          ${lib ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:4px">
            <span style="color:${rColor};font-size:10px;font-weight:600">${escHtml(lib.rarity)}</span>
            <span style="color:#888;font-size:9px">${escHtml(lib.source)}</span>
            ${needsAt ? `<span style="font-size:8px;background:#555;color:#fff;padding:1px 5px;border-radius:8px">Requires Attunement</span>` : ''}
          </div>
          ${item.base_weapon && BASE_WEAPONS[item.base_weapon] ? `<div style="font-size:10px;color:#888;margin-bottom:3px">Base: ${escHtml(BASE_WEAPONS[item.base_weapon].name)} (${BASE_WEAPONS[item.base_weapon].die} ${BASE_WEAPONS[item.base_weapon].type})</div>` : ''}
          ${item.base_armor ? `<div style="font-size:10px;color:#888;margin-bottom:3px">Base: ${escHtml(ARMORS.find(a=>a.key===item.base_armor)?.name || item.base_armor)}</div>` : ''}
          ${bonusList.length ? `<div style="font-size:11px;margin-bottom:4px;color:${canBenefit ? 'var(--text)' : '#888'}">${bonusList.join(' · ')}</div>` : ''}
          ${!canBenefit && lib ? `<div style="font-size:10px;color:#a44;margin-bottom:3px">${!isEq ? 'Not equipped — bonuses inactive' : 'Not attuned — bonuses inactive'}</div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;padding-top:4px;border-top:1px solid var(--gray-light)">
            ${editMode ? `
            <span class="eq-btn ${isEq ? 'on' : ''}" onclick="toggleEquip(${i})">${isEq ? '✓ Equipped' : '○ Equip'}</span>` : `
            <span style="font-size:10px;color:${isEq ? '#4a4' : '#888'}">${isEq ? '● Equipped' : '○ Not equipped'}</span>`}
            ${needsAt ? `<span class="eq-btn ${isAt ? 'on' : ''}" onclick="toggleAttune(${i})" style="${editMode ? '' : 'font-size:10px;cursor:pointer;color:#888'}">${isAt ? '✦ Attuned' : '○ Attune'}</span>` : ''}
          </div>
          ${lib.note ? `<div style="font-size:9px;color:#888;margin-top:4px;padding-top:3px;border-top:1px solid var(--gray-light)">Pricing: ${escHtml(lib.note)}</div>` : ''}
          ` : `<div style="color:#888;font-size:10px">No library data. <span style="color:#aaa">Add from library to link stats.</span></div>`}
        </div>
      </div>`;
    }).join('')}
    ${editMode ? `
    <div class="add-row">
      <input class="input-field" id="item-name" placeholder="Add custom item" style="flex:1">
      <input class="input-field input-sm" id="item-qty" placeholder="1" type="number" min="1" value="1" style="width:50px">
      <button class="btn btn-primary btn-sm" onclick="addItem()">+</button>
    </div>
    <div style="margin-top:6px">
      <button class="btn btn-sm btn-outline" onclick="toggleItemPicker()" style="width:100%"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:4px"><rect x="2" y="1.5" width="10" height="11" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="4.5" y1="4.5" x2="9.5" y2="4.5" stroke="currentColor" stroke-width="1.2"/><line x1="4.5" y1="7" x2="9.5" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="4.5" y1="9.5" x2="7.5" y2="9.5" stroke="currentColor" stroke-width="1.2"/></svg>Browse Item Library</button>
      <div id="item-picker" style="display:none;margin-top:6px;padding:8px;background:var(--gray-bg);border-radius:6px;max-height:300px;overflow-y:auto">
        <input class="input-field input-sm" id="ip-search" placeholder="Search items..." style="width:100%;margin-bottom:6px" oninput="filterItemPicker()">
        <div id="ip-results"></div>
      </div>
    </div>` : ''}
  `;

  Object.keys(_expandedItems).forEach(i => {
    if (_expandedItems[i]) {
      const el = document.getElementById(`item-detail-${i}`);
      const arrow = document.getElementById(`item-arrow-${i}`);
      if (el) el.style.display = 'block';
      if (arrow) arrow.textContent = '▾';
    }
  });

  if (editMode) renderItemPickerResults();
}

function renderItemPickerResults() {
  const q = (document.getElementById('ip-search')?.value || '').toLowerCase();
  const results = document.getElementById('ip-results');
  if (!results || !itemData) return;

  const magicEntries = Object.entries(itemData).filter(([, it]) =>
    !q || it.name.toLowerCase().includes(q)
  );
  const commonEntries = COMMON_ITEMS.filter(it =>
    !q || it.name.toLowerCase().includes(q)
  ).map(it => [it.slug, it]);
  const entries = [...commonEntries, ...magicEntries].sort((a, b) => a[1].name.localeCompare(b[1].name)).slice(0, 50);
  results.innerHTML = entries.map(([slug, it]) => {
    const color = RARITY_COLORS[(it.rarity || '').toLowerCase()] || '#888';
    const cost = it.cost_gp != null ? `${it.cost_gp.toLocaleString()} gp` : '—';
    const has = (char.inventory || []).some(i => i.slug === slug);
    const isWeapon = it.base_weapon_type;
    const isArmor = it.base_armor_type;
    const needsBase = isWeapon || isArmor;
    const choices = needsBase ? (isWeapon ? Object.entries(BASE_WEAPONS) : ARMORS.filter(a => a.key !== 'none').map(a => [a.key, a])) : null;
    const rowId = `ip-row-${slug}`;
    return `<div class="item-row" style="${has ? 'opacity:0.4' : 'cursor:pointer'}" ${has ? '' : `onclick="addLibraryItem('${slug}', parseInt(document.getElementById('ip-qty-${slug}')?.value || '1'))"`}>
      <div class="item-name" style="flex-wrap:wrap;gap:3px">
        <span style="display:inline-flex;align-items:center;gap:4px">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0"></span>
          ${escHtml(it.name)}
          <span style="font-size:9px;color:#888">${escHtml(it.rarity || '')}</span>
        </span>
        ${!has ? `<span style="display:inline-flex;align-items:center;gap:2px;font-size:10px;color:#888">× <input id="ip-qty-${slug}" type="number" min="1" value="1" style="width:28px;padding:1px 2px;font-size:9px;border:1px solid var(--gray-light);border-radius:3px;background:var(--card-bg);color:var(--text);text-align:center" onclick="event.stopPropagation()"></span>` : '<span style="font-size:9px;color:#888">(owned)</span>'}
        ${needsBase && !has ? `
        <select style="font-size:9px;padding:1px 4px;border:1px solid var(--gray-light);border-radius:3px;background:var(--card-bg);color:var(--text);cursor:pointer" onclick="event.stopPropagation()" onchange="confirmBaseItem('${slug}','${isWeapon ? 'w-' : 'a-'}'+this.value, parseInt(document.getElementById('ip-qty-${slug}')?.value || '1'))">
          <option value="">+ Select base...</option>
          ${choices.map(([key, val]) => `<option value="${key}">${escHtml(val.name)}</option>`).join('')}
        </select>` : ''}
      </div>
      <div class="item-qty">${cost}</div>
    </div>`;
  }).join('');
  if (!entries.length) results.innerHTML = '<div style="font-size:11px;color:#888;padding:4px">No items found.</div>';
}

window.toggleItemPicker = () => {
  const el = document.getElementById('item-picker');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  if (el.style.display === 'block') renderItemPickerResults();
};

window.filterItemPicker = () => renderItemPickerResults();

function _itemBySlug(slug) {
  return itemData?.[slug] || COMMON_ITEMS.find(c => c.slug === slug);
}

window.confirmBaseItem = (slug, prefixed, qty) => {
  const it = _itemBySlug(slug);
  if (!it) return;
  const isWeapon = prefixed.startsWith('w-');
  const baseKey = prefixed.slice(2);
  const baseData = isWeapon ? BASE_WEAPONS[baseKey] : ARMORS.find(a => a.key === baseKey);
  if (!baseData) return;
  const displayName = `${baseData.name}, ${it.name.replace(/^[WeaponArmor]+,\s*/, '')}`;
  const entry = { name: displayName, qty: qty || 1, slug, cost_gp: it.cost_gp };
  if (isWeapon) entry.base_weapon = baseKey;
  else entry.base_armor = baseKey;
  const inventory = [...(char.inventory || []), entry];
  save({ inventory }).then(() => renderActiveTab());
  document.getElementById('ip-search').value = '';
  log('item', `Added library item: ${displayName} x${qty||1} (base: ${baseKey})`);
};

window.addLibraryItem = (slug, qty) => {
  const it = _itemBySlug(slug);
  if (!it) return;
  const inventory = [...(char.inventory || []), { name: it.name, qty: qty || 1, slug, cost_gp: it.cost_gp }];
  save({ inventory }).then(() => renderActiveTab());
  log('item', `Added library item: ${it.name} x${qty||1}`);
};

function choicePickLimit(cfg, level) {
  if (cfg.pick_by_level) {
    const keys = Object.keys(cfg.pick_by_level).map(Number).filter(k => k <= level).sort((a, b) => b - a);
    return cfg.pick_by_level[String(keys[0])] || 0;
  }
  return cfg.pick || 1;
}

function renderChoiceSection(allChoices) {
  if (!allChoices || !Object.keys(allChoices).length) return '';
  let html = `<div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
    <span>Feature Choices</span>
    <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
  </div>`;
  for (const [featName, cfg] of Object.entries(allChoices)) {
    if (!cfg.options?.length) continue;
    const limit = choicePickLimit(cfg, char.level);
    if (!limit) continue;
    const selected = (char.choices || {})[featName] || [];
    const label = cfg.label || featName;
    html += `<div style="margin-bottom:10px;padding:8px 10px;background:var(--gray-bg);border-radius:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;font-weight:600">${escHtml(label)}</span>
        <span style="font-size:10px;color:#888">${selected.length}/${limit}</span>
      </div>`;
    if (editMode) {
      html += `<div class="pills" style="margin-bottom:4px">`;
      html += cfg.options.map(opt => {
        const sel = selected.includes(opt.name);
        const dis = !sel && selected.length >= limit;
        return `<div class="pill${sel ? ' selected' : ''}${dis ? ' disabled' : ''}" style="font-size:10px" onclick="toggleSheetChoice(${escHtml(JSON.stringify(featName))},${escHtml(JSON.stringify(opt.name))},${limit})" title="${escHtml(opt.desc)}">${escHtml(opt.name)}</div>`;
      }).join('');
      html += `</div>`;
    }
    if (selected.length) {
      html += selected.map(n => {
        const opt = cfg.options.find(o => o.name === n);
        return `<div style="padding:3px 8px;background:var(--card-bg);border-radius:4px;margin-top:3px;font-size:11px">
          <b>${escHtml(n)}</b>
          ${opt?.desc ? `<div style="color:var(--text-muted,#666);margin-top:1px;font-size:10px">${escHtml(opt.desc.substring(0, 120))}${opt.desc.length > 120 ? '…' : ''}</div>` : ''}
        </div>`;
      }).join('');
    } else {
      html += `<div style="font-size:10px;color:#888;padding:2px 0">No selection made yet.</div>`;
    }
    html += `</div>`;
  }
  return html;
}

function renderFeats(el) {
  const level = char.level;
  const featuresByLevel = classData?.features_by_level || {};
  const featureDescs = classData?.feature_descriptions || {};
  const subclass = char.subclass_key && classData?.subclasses?.[char.subclass_key];
  const subFeatures = subclass?.features_by_level || {};
  const manualFeats = char.features || [];

  const subDescs = subclass?.feature_descriptions || {};
  function findDesc(name) {
    if (featureDescs[name]) return featureDescs[name];
    if (subDescs[name]) return subDescs[name];
    for (const [key, desc] of Object.entries(featureDescs)) {
      if (name.startsWith(key) || key.startsWith(name)) return desc;
    }
    for (const [key, desc] of Object.entries(subDescs)) {
      if (name.startsWith(key) || key.startsWith(name)) return desc;
    }
    return '';
  }

  function featHtml(name, desc, lvl, idx) {
    const d = desc || findDesc(name);
    const hasDesc = !!d;
    return `<div class="feat-card" onclick="this.classList.toggle('expanded')">
      ${lvl ? `<div class="feat-level">Level ${lvl}</div>` : ''}
      <div class="feat-name-row">
        <span class="feat-name">${escHtml(name)}</span>
        ${hasDesc ? '<span class="feat-arrow">▸</span>' : ''}
      </div>
      ${hasDesc ? `<div class="feat-desc">${escHtml(d)}</div>` : ''}
      ${idx !== undefined && editMode ? `<button class="delete-btn" onclick="event.stopPropagation();removeFeat(${idx})">×</button>` : ''}
    </div>`;
  }

  let html = `<div class="section-title">Class Features</div>`;
  for (let l = 1; l <= level; l++) {
    const feats = featuresByLevel[String(l)] || [];
    if (feats.length) {
      html += feats.map(f => {
        if (typeof f === 'string') return featHtml(f, '', l);
        return featHtml(f.name || '', f.description || '', l);
      }).join('');
    }
  }
  if (subclass) {
    html += `<div class="section-title">${escHtml(subclass.name)}</div>`;
    html += `<div class="feat-card" onclick="this.classList.toggle('expanded')">
      <div class="feat-name-row"><span class="feat-name">${escHtml(subclass.description || '')}</span></div>
    </div>`;
    for (let l = 1; l <= level; l++) {
      const feats = subFeatures[String(l)] || [];
      if (feats.length) {
        html += feats.map(f => {
          if (typeof f === 'string') return featHtml(f, '', l);
          return featHtml(f.name || '', f.description || '', l);
        }).join('');
      }
    }
  }

  const clsChoices = classData?.feature_choices || {};
  const subChoices = subclass?.feature_choices || {};
  const allChoices = { ...clsChoices, ...subChoices };
  html += renderChoiceSection(allChoices);

  if (manualFeats.length) {
    html += `<div class="section-title">Additional Features</div>`;
    html += manualFeats.map((f, i) => {
      const name = typeof f === 'string' ? f : (f.name || '');
      const desc = typeof f === 'string' ? '' : (f.description || '');
      return featHtml(name, desc, null, i);
    }).join('');
  }
  if (!Object.keys(allChoices).length) {
    html += `
      <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
        <span>Add Feature</span>
        <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
      </div>`;
  } else {
    html += `
      <div class="section-title" style="margin-top:8px">Add Feature</div>`;
  }
  if (editMode) {
    html += `
    <div class="add-row" style="flex-wrap:wrap;gap:6px">
      <input class="input-field" id="feat-name" placeholder="Feature name" style="flex:2;min-width:120px">
      <input class="input-field" id="feat-desc" placeholder="Description" style="flex:3;min-width:160px">
      <button class="btn btn-primary btn-sm" onclick="addFeat()">+</button>
    </div>`;
  }
  el.innerHTML = html;
}

function renderWorld(el) {
  const notes = char.notes || [];
  el.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <button class="btn btn-outline btn-sm" onclick="openWorldAdd('npc')">+ NPC</button>
      <button class="btn btn-outline btn-sm" onclick="openWorldAdd('location')">+ Location</button>
      <button class="btn btn-outline btn-sm" onclick="openWorldAdd('settlement')">+ Settlement</button>
    </div>
    <div id="world-add-form" style="display:none;margin-bottom:12px;padding:10px 12px;background:var(--gray-bg);border-radius:6px;border:1px solid var(--gray-light)">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--gray-dark);margin-bottom:6px" id="world-add-label">Add</div>
      <textarea id="world-paste" class="input-field" rows="6" placeholder="Paste from Lodestar…" style="width:100%;resize:vertical;font-size:12px;line-height:1.5;font-family:var(--font-body)"></textarea>
      <div style="font-size:10px;color:var(--gray-mid);margin:5px 0 3px">Or just a name:</div>
      <input type="text" id="world-title-input" class="input-field" placeholder="Entity name…" style="width:100%">
      <div class="add-row" style="margin-top:8px;padding:0;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="cancelWorldAdd()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="submitWorldEntry()">Add</button>
      </div>
    </div>
    ${notes.map((n, i) => `
      <div class="note-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <span class="note-tag">${escHtml(n.type)}</span>
          <button class="delete-btn" onclick="removeNote(${i})">×</button>
        </div>
        <div class="note-title" contenteditable="true" onblur="updateNote(${i},'title',this.textContent)">${escHtml(n.title)}</div>
        <div class="note-body" contenteditable="true" onblur="updateNote(${i},'body',this.textContent)">${escHtml(n.body)}</div>
      </div>`).join('')}
    ${!notes.length ? '<div style="padding:24px;text-align:center;color:#888;font-size:13px">No world entries yet</div>' : ''}
  `;
}

// ── Global handlers ────────────────────────────────────────

window.toggleLevel = (lvl) => { expandedLevels[lvl] = expandedLevels[lvl] === false ? true : false; renderActiveTab(); };
window.switchTab = (i) => { activeTab = i; _expandedItems = {}; render(); };
window.toggleEdit = () => { editMode = !editMode; renderActiveTab(); };

window.openHpEditor = () => {
  const val = prompt(`Current HP (max ${char.hp_max}):`, char.hp_current);
  if (val !== null && !isNaN(+val)) {
    save({ hp_current: Math.min(char.hp_max, Math.max(0, +val)) }).then(render);
  }
};
window.deleteCurrentChar = async (id, name) => {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api.deleteCharacter(id);
    window.location = '/';
  } catch (e) {
    alert('Failed to delete character');
  }
};

window.adjustHp = (delta) => {
  const newHp = Math.min(char.hp_max, Math.max(0, char.hp_current + delta));
  save({ hp_current: newHp }).then(() => { render(); log('hp', `HP ${delta > 0 ? '+' : ''}${delta} → ${newHp}`); });
};

window.toggleSlot = (level, index) => {
  const slots = JSON.parse(JSON.stringify(char.spell_slots));
  const s = slots[level];
  const used = s.used;
  if (index < used) { s.used = index; }
  else if (index === used && used < s.max) { s.used = used + 1; }
  else { s.used = used > 0 ? used - 1 : 0; }
  save({ spell_slots: slots }).then(() => renderActiveTab());
  log('spell-slot', `Level ${level} slots: ${s.used}/${s.max}`);
};

window.restoreSlots = (level) => {
  const slots = JSON.parse(JSON.stringify(char.spell_slots));
  slots[level].used = 0;
  save({ spell_slots: slots }).then(() => renderActiveTab());
  log('spell-slot', `Restored level ${level} slots`);
};

window.useSlot = (level) => {
  const slots = JSON.parse(JSON.stringify(char.spell_slots));
  if (!slots[level] || slots[level].used >= slots[level].max) return;
  slots[level].used++;
  save({ spell_slots: slots }).then(() => renderActiveTab());
  log('spell-slot', `Level ${level} slot used: ${slots[level].used}/${slots[level].max}`);
};

window.freeSlot = (level) => {
  const slots = JSON.parse(JSON.stringify(char.spell_slots));
  if (!slots[level] || slots[level].used <= 0) return;
  slots[level].used--;
  save({ spell_slots: slots }).then(() => renderActiveTab());
  log('spell-slot', `Level ${level} slot freed: ${slots[level].used}/${slots[level].max}`);
};

window.removeSpell = (key) => {
  if (!editMode) return;
  const known = (char.spells_known || []).filter(k => k !== key);
  save({ spells_known: known }).then(() => renderActiveTab());
};

window.toggleSkillProf = (skillKey) => {
  if (!editMode) return;
  const profs = [...(char.skill_proficiencies || [])];
  const exp = [...(char.expertise || [])];
  const pIdx = profs.indexOf(skillKey);
  const eIdx = exp.indexOf(skillKey);
  if (eIdx >= 0) {
    exp.splice(eIdx, 1);
    profs.splice(profs.indexOf(skillKey), 1);
  } else if (pIdx >= 0) {
    exp.push(skillKey);
  } else {
    profs.push(skillKey);
  }
  save({ skill_proficiencies: profs, expertise: exp }).then(() => renderActiveTab());
};

window.editCoin = (coin) => {
  const val = prompt(`${coin.toUpperCase()}:`, char.coins[coin]);
  if (val !== null && !isNaN(+val)) {
    const coins = { ...char.coins, [coin]: Math.max(0, +val) };
    save({ coins }).then(() => renderActiveTab());
  }
};

window.onWeaponNameInput = () => {
  const q = document.getElementById('w-name')?.value.toLowerCase().trim();
  const box = document.getElementById('w-suggestions');
  const status = document.getElementById('w-link-status');
  if (!q || !box) { if (box) box.style.display = 'none'; if (status) status.textContent = ''; return; }
  const invItems = (char.inventory || []).filter(it => it.name.toLowerCase().includes(q));
  if (!invItems.length) { box.style.display = 'none'; if (status) status.textContent = ''; return; }
  box.style.display = 'block';
  box.innerHTML = invItems.map(it => {
    const lib = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
    const label = lib?.weapon_bonus ? `+${lib.weapon_bonus} ` : '';
    const eq = it.equipped ? '● ' : '○ ';
    const baseTag = it.base_weapon && BASE_WEAPONS[it.base_weapon] ? ` (${BASE_WEAPONS[it.base_weapon].die} ${BASE_WEAPONS[it.base_weapon].type})` : '';
    return `<div style="padding:4px 8px;cursor:pointer;font-size:11px" onmouseover="this.style.background='var(--gray-bg)'" onmouseout="this.style.background=''" onclick="selectWeaponSuggestion('${escHtml(it.name)}')">${eq}${label}${escHtml(it.name)}${baseTag}</div>`;
  }).join('');
};

function _dieParts(die) {
  const m = die.match(/^(\d+)(d\d+)$/);
  return m ? { qty: m[1], die: m[2] } : { qty: '1', die: 'd6' };
}

window.selectWeaponSuggestion = (name) => {
  document.getElementById('w-name').value = name;
  document.getElementById('w-suggestions').style.display = 'none';
  const inv = (char.inventory || []).find(it => it.name === name);
  const lib = inv?.slug ? (itemData || {})[inv.slug] : findItemByName(name);
  const status = document.getElementById('w-link-status');
  if (inv) {
    status.textContent = inv.equipped ? '✓ Found in inventory (equipped)' : '⚠ Found in inventory (not equipped)';
    status.style.color = inv.equipped ? '#4a4' : '#a84';
    if (inv.base_weapon && BASE_WEAPONS[inv.base_weapon]) {
      const bw = BASE_WEAPONS[inv.base_weapon];
      const p = _dieParts(bw.die);
      document.getElementById('w-die-qty').value = p.qty;
      document.getElementById('w-die').value = p.die;
      document.getElementById('w-type').value = bw.type;
    }
  }
};

window.addWeapon = () => {
  const name = document.getElementById('w-name')?.value.trim();
  if (!name) return;
  let qty = document.getElementById('w-die-qty')?.value || '1';
  let die = document.getElementById('w-die')?.value || 'd6';
  let type = document.getElementById('w-type')?.value.trim() || '';
  const ability = document.getElementById('w-ability')?.value || 'str';
  const proficient = document.getElementById('w-prof')?.checked !== false;
  const invMatch = (char.inventory || []).find(it => it.name.toLowerCase() === name.toLowerCase());
  if (invMatch && invMatch.base_weapon && BASE_WEAPONS[invMatch.base_weapon]) {
    const bw = BASE_WEAPONS[invMatch.base_weapon];
    const p = _dieParts(bw.die);
    qty = p.qty; die = p.die; type = bw.type;
  }
  const weapons = [...(char.weapons || []), { name, damage_die: `${qty}${die}`, type, ability, proficient, linkedInvName: invMatch ? invMatch.name : null }];
  document.getElementById('w-name').value = '';
  save({ weapons }).then(() => renderActiveTab());
};

window.removeWeapon = (i) => {
  const weapons = [...(char.weapons || [])];
  const name = weapons[i]?.name || 'unknown';
  weapons.splice(i, 1);
  save({ weapons }).then(() => renderActiveTab());
  log('weapon', `Removed weapon: ${name}`);
};

window.equipArmor = (key) => {
  const armor = { ...(char.armor || { shield: false }), key };
  save({ armor }).then(() => renderActiveTab());
};

window.toggleShield = () => {
  const armor = { key: 'none', ...(char.armor || {}), shield: !(char.armor?.shield) };
  save({ armor }).then(() => renderActiveTab());
};

window.toggleItemDetail = (i) => {
  const el = document.getElementById(`item-detail-${i}`);
  const arrow = document.getElementById(`item-arrow-${i}`);
  if (el) {
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
    _expandedItems[i] = !isOpen;
  }
};

window.toggleEquip = (i) => {
  const inventory = JSON.parse(JSON.stringify(char.inventory || []));
  inventory[i].equipped = !inventory[i].equipped;
  if (!inventory[i].equipped) inventory[i].attuned = false;
  save({ inventory }).then(() => renderActiveTab());
  log('item', `Toggled equip ${inventory[i].name}: ${inventory[i].equipped}`);
};

window.toggleWeaponProf = (i) => {
  const inventory = JSON.parse(JSON.stringify(char.inventory || []));
  inventory[i].proficient = inventory[i].proficient === false ? true : false;
  save({ inventory }).then(() => renderActiveTab());
  log('weapon', `Toggled proficiency ${inventory[i].name}: ${inventory[i].proficient}`);
};

window.toggleAttune = (i) => {
  const inventory = JSON.parse(JSON.stringify(char.inventory || []));
  const item = inventory[i];
  const lib = item.slug ? (itemData || {})[item.slug] : findItemByName(item.name);
  if (!lib || lib.attunement !== 'Yes') return;
  const newVal = !item.attuned;
  if (newVal) {
    const currentAttuned = inventory.filter((it, idx) => {
      if (idx === i) return false;
      const l = it.slug ? (itemData || {})[it.slug] : findItemByName(it.name);
      return l && l.attunement === 'Yes' && it.attuned;
    }).length;
    if (currentAttuned >= 3) {
      alert('Already attuned to 3 items. Unequip another item first.');
      return;
    }
  }
  item.attuned = newVal;
  if (newVal) item.equipped = true;
  save({ inventory }).then(() => renderActiveTab());
  log('item', `Toggled attune ${item.name}: ${item.attuned}`);
};

window.addItem = () => {
  const name = document.getElementById('item-name')?.value.trim();
  if (!name) return;
  const qty = parseInt(document.getElementById('item-qty')?.value) || 1;
  const lib = findItemByName(name);
  const entry = { name, qty };
  if (lib) {
    const slug = Object.keys(itemData || {}).find(k => itemData[k] === lib);
    if (slug) entry.slug = slug;
    entry.cost_gp = lib.cost_gp;
  }
  const inventory = [...(char.inventory || []), entry];
  save({ inventory }).then(() => renderActiveTab());
  log('item', `Added item: ${name} x${qty}${lib ? ' (linked)' : ''}`);
};

window.removeItem = (i) => {
  const inventory = [...(char.inventory || [])];
  const name = inventory[i]?.name || 'unknown';
  inventory.splice(i, 1);
  save({ inventory }).then(() => renderActiveTab());
  log('item', `Removed item: ${name}`);
};

window.toggleSheetChoice = (featName, optName, limit) => {
  const choices = JSON.parse(JSON.stringify(char.choices || {}));
  if (!choices[featName]) choices[featName] = [];
  const arr = choices[featName];
  const i = arr.indexOf(optName);
  if (i >= 0) arr.splice(i, 1);
  else if (arr.length < limit) arr.push(optName);
  save({ choices }).then(() => renderActiveTab());
};

window.addFeat = () => {
  const name = document.getElementById('feat-name')?.value.trim();
  if (!name) return;
  const desc = document.getElementById('feat-desc')?.value.trim() || '';
  const features = [...(char.features || []), { name, description: desc }];
  save({ features }).then(() => renderActiveTab());
  log('feat', `Added feature: ${name}`);
};

window.removeFeat = (i) => {
  const features = [...(char.features || [])];
  const name = typeof features[i] === 'string' ? features[i] : (features[i]?.name || 'unknown');
  features.splice(i, 1);
  save({ features }).then(() => renderActiveTab());
  log('feat', `Removed feature: ${name}`);
};

window.openWorldAdd = (type) => {
  _worldAddType = type;
  const form = document.getElementById('world-add-form');
  const label = document.getElementById('world-add-label');
  const ta = document.getElementById('world-paste');
  const ti = document.getElementById('world-title-input');
  if (!form) return;
  form.style.display = 'block';
  if (label) label.textContent = `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  if (ta) ta.value = '';
  if (ti) ti.value = '';
  if (ta) ta.focus();
};

window.cancelWorldAdd = () => {
  _worldAddType = null;
  const form = document.getElementById('world-add-form');
  if (form) form.style.display = 'none';
};

window.submitWorldEntry = () => {
  const type = _worldAddType;
  if (!type) return;
  const paste  = document.getElementById('world-paste')?.value.trim();
  const manual = document.getElementById('world-title-input')?.value.trim();
  let title = '', body = '';
  if (paste) {
    const lines = paste.split('\n');
    const first = lines[0] || '';
    const dash = first.indexOf(' — ');
    title = dash >= 0 ? first.slice(dash + 3).trim() : first.trim();
    body  = lines.slice(1).join('\n').trim();
  } else if (manual) {
    title = manual;
  }
  if (!title) return;
  const notes = [...(char.notes || []), { type, title, body }];
  window.cancelWorldAdd();
  save({ notes }).then(() => renderActiveTab());
};

window.removeNote = (i) => {
  const notes = [...(char.notes || [])];
  notes.splice(i, 1);
  save({ notes }).then(() => renderActiveTab());
};

window.updateNote = (i, field, val) => {
  const notes = JSON.parse(JSON.stringify(char.notes || []));
  notes[i][field] = val;
  save({ notes });
};

const RESOURCE_RANGES = { momentum: { min: 0, max: 10 }, supply: { min: 0, max: 5 }, stress: { min: 0, max: 5 }, lucky_points: { min: 0, max: 3 } };
const RESOURCE_DEFAULTS = { momentum: 0, supply: 5, stress: 5, lucky_points: 3 };

window.adjResource = (res, delta) => {
  const range = RESOURCE_RANGES[res];
  const cur = char[res] ?? RESOURCE_DEFAULTS[res];
  const next = Math.min(range.max, Math.max(range.min, cur + delta));
  if (next === cur) return;
  save({ [res]: next }).then(() => {
    const el = document.getElementById(`res-${res}`);
    if (el) el.textContent = next;
    log('resource', `${res}: ${cur} → ${next}`);
  });
};

window.adjBardicInspiration = (delta) => {
  const max = bardicInspirationMax();
  const cur = char.bardic_inspiration ?? max;
  const next = Math.min(max, Math.max(0, cur + delta));
  if (next === cur) return;
  save({ bardic_inspiration: next }).then(() => {
    const el = document.getElementById('res-bardic_inspiration');
    if (el) el.textContent = next;
    log('bardic_inspiration', `${cur} → ${next}`);
  });
};
