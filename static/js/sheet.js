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
const ABILITY_FULL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const SPELLCASTING_ABILITY = { artificer: 'int', bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int' };
function getTabs() {
  const hasSpells = spellData && Object.keys(spellData).length > 0;
  return hasSpells ? ['Stats', 'Combat', 'Spells', 'Inventory', 'Feats', 'Notes'] : ['Stats', 'Combat', 'Inventory', 'Feats', 'Notes'];
}

let char = null;
let classData = null;
let spellData = null;
let activeTab = 0;
let editMode = false;

function abilityMod(score) { return Math.floor((score - 10) / 2); }
function profBonus(level) { return Math.floor((level - 1) / 4) + 2; }
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
    [char, classData, spellData] = await Promise.all([
      charData, api.getClass(charData.class_key), api.getSpells(charData.class_key),
    ]);
  } catch (e) {
    app.innerHTML = `<div style="padding:24px;color:#888">Error loading character</div>`;
    return;
  }
  render();
}

function render() {
  const app = document.getElementById('app');
  const hpPct = char.hp_current / char.hp_max;
  const tabs = getTabs();
  const clsName = char.class_key.charAt(0).toUpperCase() + char.class_key.slice(1);
  app.innerHTML = `
    <div class="app-header">
      <div>
        <button class="back-btn" style="padding:0 0 6px;color:#888" onclick="window.location='/'">‹ Characters</button>
        <div class="char-name">${escHtml(char.name)}</div>
        <div class="char-meta">${clsName} · ${char.subclass_key ? escHtml(char.subclass_key) : 'No Subclass'} · Level ${char.level}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <div class="hp-badge" onclick="openHpEditor()">
          <div class="hp-num${hpPct <= 0.3 ? ' hurt' : ''}">${char.hp_current}</div>
          <div class="hp-label">/ ${char.hp_max} HP</div>
        </div>
        <button class="icon-btn" onclick="event.stopPropagation();toggleTheme()" title="Toggle theme">🌓</button>
        <button class="icon-btn icon-btn-danger" onclick="event.stopPropagation();deleteCurrentChar(${char.id},'${escHtml(char.name)}')" title="Delete character">✕</button>
      </div>
    </div>
    <div class="resource-bar">
      ${[['momentum','Momentum',0,10],['supply','Supplies',0,5],['stress','Stress',0,5]].map(([key,label]) => {
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
  const renderers = { Stats: renderStats, Combat: renderCombat, Spells: renderSpells, Inventory: renderInventory, Feats: renderFeats, Notes: renderNotes };
  const fn = renderers[tabs[activeTab]];
  if (fn) fn(document.getElementById(`tab-${activeTab}`));
}

function renderStats(el) {
  const scores = char.ability_scores;
  const pb = profBonus(char.level);
  el.innerHTML = `
    <div class="prof-info">
      <span style="font-size:11px;color:#888">Proficiency Bonus: <b>${fmtBonus(pb)}</b></span>
      <button class="btn btn-sm btn-outline edit-mode-toggle" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
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
    ${['str','dex','con','int','wis','cha'].map(ab => {
      const isProf = classData?.saving_throws?.includes(ab);
      const bonus = abilityMod(scores[ab]) + (isProf ? pb : 0);
      return `<div class="save-row">
        <div class="save-dot${isProf ? ' prof' : ''}"></div>
        <div class="save-name">${ABILITY_FULL[ab]}</div>
        <div class="save-bonus">${fmtBonus(bonus)}</div>
      </div>`;
    }).join('')}
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
  `;
}

function renderCombat(el) {
  const scores = char.ability_scores;
  const pb = profBonus(char.level);
  const dexMod = abilityMod(scores.dex);
  const conMod = abilityMod(scores.con);
  const weapons = char.weapons || [];
  const subclassName = char.subclass_key && classData?.subclasses?.[char.subclass_key]?.name || '—';
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
      <div class="stat-box"><div class="stat-val">${char.ac}</div><div class="stat-label">AC</div></div>
      <div class="stat-box"><div class="stat-val">${fmtBonus(dexMod)}</div><div class="stat-label">Initiative</div></div>
      <div class="stat-box"><div class="stat-val">30 ft</div><div class="stat-label">Speed</div></div>
      <div class="stat-box"><div class="stat-val">${fmtBonus(pb)}</div><div class="stat-label">Prof Bonus</div></div>
      <div class="stat-box"><div class="stat-val">${char.hp_max}</div><div class="stat-label">Max HP</div></div>
      <div class="stat-box"><div class="stat-val">${fmtBonus(conMod)}</div><div class="stat-label">Con Mod</div></div>
    </div>
    <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>Weapons</span>
      <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
    </div>
    ${weapons.length ? weapons.map((w, i) => {
      const mod = abilityMod(scores[w.ability] || 10);
      const atk = fmtBonus(mod + (w.proficient ? pb : 0));
      const dmg = `${w.damage_die || '1d6'}${mod >= 0 ? '+' : ''}${mod}`;
      return `<div class="weapon-row">
        <div>
          <div class="weapon-name">${escHtml(w.name)}</div>
          <div style="font-size:10px;color:#888">${escHtml(w.type || '')}</div>
        </div>
        <div class="weapon-atk">${atk}</div>
        <div class="weapon-dmg">${dmg}</div>
        ${editMode ? `<button class="delete-btn" onclick="removeWeapon(${i})">×</button>` : ''}
      </div>`;
    }).join('') : '<div style="padding:8px;color:#888;font-size:12px">No weapons. Add one below.</div>'}
    ${editMode ? `
    <div class="add-row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
      <input class="input-field" id="w-name" placeholder="Weapon name" style="flex:2;min-width:120px">
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
    </div>` : ''}
    ${char.class_key === 'bard' ? `
    <div class="section-title">Bardic Inspiration</div>
    <div style="display:flex;align-items:center;padding:8px 0">
      <div class="inspiration-die">${inspirationDieByLevel(char.level)}</div>
      <div style="font-size:12px;color:#555">Inspiration Die · ${subclassName}</div>
    </div>` : ''}
    <div class="section-title">Saving Throws</div>
    <div class="saves-grid">
    ${['str','dex','con','int','wis','cha'].map(ab => {
      const isProf = classData?.saving_throws?.includes(ab);
      const bonus = abilityMod(scores[ab]) + (isProf ? pb : 0);
      return `<div class="save-box">
        <div class="save-bonus">${fmtBonus(bonus)}</div>
        <div class="save-name">${ABILITY_FULL[ab]}${isProf ? ' •' : ''}</div>
      </div>`;
    }).join('')}
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
  const knownSpells = known.map(k => allSpells[k]).filter(Boolean);

  const grouped = {};
  for (const s of knownSpells) {
    const key = s.level === 0 ? 0 : s.level;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  const levels = Object.keys(grouped).sort((a, b) => +a - +b);

  el.innerHTML = `
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
        <div class="slot-pips">
          ${Array.from({length: s.max}, (_, i) => `
            <div class="slot-pip${i < s.used ? ' used' : ''}" onclick="toggleSlot('${lvl}',${i})"></div>`).join('')}
        </div>
        <button class="btn-icon" onclick="restoreSlots('${lvl}')" title="Restore">↺</button>
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
  return `<div class="spell-card" onclick="this.classList.toggle('expanded')">
    <div class="spell-header">
      <span class="spell-level-badge">${levelLabel}</span>
      <span class="spell-name">${escHtml(s.name)}${ritual}${conc}</span>
      <span class="spell-school">${escHtml(s.school)}</span>
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

function renderInventory(el) {
  const coins = char.coins || { pp:0, gp:0, ep:0, sp:0, cp:0 };
  const inventory = char.inventory || [];
  el.innerHTML = `
    <div class="section-title">Coins</div>
    <div class="coin-grid">
      ${['pp','gp','ep','sp','cp'].map(c => `
        <div class="coin-box">
          <div class="coin-val" onclick="editCoin('${c}')">${coins[c] ?? 0}</div>
          <div class="coin-label">${c.toUpperCase()}</div>
        </div>`).join('')}
    </div>
    <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>Items</span>
      <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
    </div>
    ${inventory.map((item, i) => `
      <div class="item-row">
        <div class="item-name">${escHtml(item.name)}</div>
        <div class="item-qty">x${item.qty}</div>
        ${editMode ? `<button class="delete-btn" onclick="removeItem(${i})">×</button>` : ''}
      </div>`).join('')}
    ${editMode ? `
    <div class="add-row">
      <input class="input-field" id="item-name" placeholder="Item">
      <input class="input-field input-sm" id="item-qty" placeholder="1" type="number" min="1" value="1">
      <button class="btn btn-primary btn-sm" onclick="addItem()">+</button>
    </div>` : ''}
  `;
}

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
        return `<div class="pill${sel ? ' selected' : ''}${dis ? ' disabled' : ''}" style="font-size:10px" onclick="toggleSheetChoice(${JSON.stringify(featName)},${JSON.stringify(opt.name)},${limit})" title="${escHtml(opt.desc)}">${escHtml(opt.name)}</div>`;
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

function renderNotes(el) {
  const notes = char.notes || [];
  el.innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn btn-outline btn-sm" onclick="addNote('npc')">+ NPC</button>
      <button class="btn btn-outline btn-sm" style="margin-left:6px" onclick="addNote('location')">+ Location</button>
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
    ${!notes.length ? '<div style="padding:24px;text-align:center;color:#888;font-size:13px">No notes yet</div>' : ''}
  `;
}

// ── Global handlers ────────────────────────────────────────

window.toggleLevel = (lvl) => { expandedLevels[lvl] = expandedLevels[lvl] === false ? true : false; renderActiveTab(); };
window.switchTab = (i) => { activeTab = i; render(); };
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

window.addWeapon = () => {
  const name = document.getElementById('w-name')?.value.trim();
  if (!name) return;
  const qty = parseInt(document.getElementById('w-die-qty')?.value) || 1;
  const die = document.getElementById('w-die')?.value || 'd6';
  const weapons = [...(char.weapons || []), {
    name,
    damage_die: `${qty}${die}`,
    ability: document.getElementById('w-ability')?.value || 'str',
    type: document.getElementById('w-type')?.value.trim() || '',
    proficient: document.getElementById('w-prof')?.checked || false,
  }];
  save({ weapons }).then(() => renderActiveTab());
  log('weapon', `Added weapon: ${name} (${qty}${die})`);
};

window.removeWeapon = (i) => {
  const weapons = [...(char.weapons || [])];
  const name = weapons[i]?.name || 'unknown';
  weapons.splice(i, 1);
  save({ weapons }).then(() => renderActiveTab());
  log('weapon', `Removed weapon: ${name}`);
};

window.addItem = () => {
  const name = document.getElementById('item-name')?.value.trim();
  if (!name) return;
  const qty = parseInt(document.getElementById('item-qty')?.value) || 1;
  const inventory = [...(char.inventory || []), { name, qty }];
  save({ inventory }).then(() => renderActiveTab());
  log('item', `Added item: ${name} x${qty}`);
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

window.addNote = (type) => {
  const title = prompt(`Title (${type}):`);
  if (!title) return;
  const notes = [...(char.notes || []), { type, title, body: '' }];
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

const RESOURCE_RANGES = { momentum: { min: 0, max: 10 }, supply: { min: 0, max: 5 }, stress: { min: 0, max: 5 } };
const RESOURCE_DEFAULTS = { momentum: 0, supply: 5, stress: 5 };

window.adjResource = (res, delta) => {
  const range = RESOURCE_RANGES[res];
  const cur = char[res] ?? RESOURCE_DEFAULTS[res];
  const next = Math.min(range.max, Math.max(range.min, cur + delta));
  if (next === cur) return;
  save({ [res]: next }).then(() => {
    document.getElementById(`res-${res}`).textContent = next;
    log('resource', `${res}: ${cur} → ${next}`);
  });
};
