import { api } from '/static/js/api.js';

const SKILLS = [
  { key: 'Acrobatics',      ability: 'dex', label: 'Acrobacias' },
  { key: 'Animal Handling', ability: 'wis', label: 'Trato con animales' },
  { key: 'Arcana',          ability: 'int', label: 'Arcanos' },
  { key: 'Athletics',       ability: 'str', label: 'Atletismo' },
  { key: 'Deception',       ability: 'cha', label: 'Engaño' },
  { key: 'History',         ability: 'int', label: 'Historia' },
  { key: 'Insight',         ability: 'wis', label: 'Perspicacia' },
  { key: 'Intimidation',    ability: 'cha', label: 'Intimidación' },
  { key: 'Investigation',   ability: 'int', label: 'Investigación' },
  { key: 'Medicine',        ability: 'wis', label: 'Medicina' },
  { key: 'Nature',          ability: 'int', label: 'Naturaleza' },
  { key: 'Perception',      ability: 'wis', label: 'Percepción' },
  { key: 'Performance',     ability: 'cha', label: 'Interpretación' },
  { key: 'Persuasion',      ability: 'cha', label: 'Persuasión' },
  { key: 'Religion',        ability: 'int', label: 'Religión' },
  { key: 'Sleight of Hand', ability: 'dex', label: 'Juego de manos' },
  { key: 'Stealth',         ability: 'dex', label: 'Sigilo' },
  { key: 'Survival',        ability: 'wis', label: 'Supervivencia' },
];

const ABILITY_NAMES = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };
const ABILITY_FULL = { str: 'Fuerza', dex: 'Destreza', con: 'Constitución', int: 'Inteligencia', wis: 'Sabiduría', cha: 'Carisma' };
const TABS = ['Stats', 'Combate', 'Magia', 'Inventario', 'Feats', 'Notas'];

let char = null;
let classData = null;
let activeTab = 0;
let editMode = false;

function abilityMod(score) { return Math.floor((score - 10) / 2); }
function profBonus(level) { return Math.floor((level - 1) / 4) + 2; }
function fmtBonus(n) { return (n >= 0 ? '+' : '') + n; }
function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

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

async function save(patch) {
  Object.assign(char, patch);
  try { await api.updateCharacter(char.id, patch); } catch (e) { console.error('Save error', e); }
}

export async function initSheet(id) {
  const app = document.getElementById('app');
  app.innerHTML = `<div style="padding:24px;text-align:center;color:#888">Cargando...</div>`;
  try {
    [char, classData] = await Promise.all([api.getCharacter(id), api.getClass('bard')]);
  } catch (e) {
    app.innerHTML = `<div style="padding:24px;color:#888">Error cargando personaje</div>`;
    return;
  }
  render();
}

function render() {
  const app = document.getElementById('app');
  const hpPct = char.hp_current / char.hp_max;
  app.innerHTML = `
    <div class="app-header">
      <div>
        <button class="back-btn" style="padding:0 0 6px;color:#888" onclick="window.location='/'">‹ Personajes</button>
        <div class="char-name">${escHtml(char.name)}</div>
        <div class="char-meta">${char.class_key} · ${char.subclass_key || 'Sin colegio'} · Nivel ${char.level}</div>
      </div>
      <div class="hp-badge" onclick="openHpEditor()">
        <div class="hp-num${hpPct <= 0.3 ? ' hurt' : ''}">${char.hp_current}</div>
        <div class="hp-label">/ ${char.hp_max} PG</div>
      </div>
    </div>
    <div class="tabs">
      ${TABS.map((t, i) => `<div class="tab${activeTab === i ? ' active' : ''}" onclick="switchTab(${i})">${t}</div>`).join('')}
    </div>
    ${TABS.map((_, i) => `<div class="tab-content${activeTab === i ? ' active' : ''}" id="tab-${i}"></div>`).join('')}
  `;
  renderActiveTab();
}

function renderActiveTab() {
  const renderers = [renderStats, renderCombate, renderMagia, renderInventario, renderFeats, renderNotas];
  renderers[activeTab](document.getElementById(`tab-${activeTab}`));
}

function renderStats(el) {
  const pb = profBonus(char.level);
  const scores = char.ability_scores;
  el.innerHTML = `
    <div class="prof-info">
      <span style="font-size:11px;color:#555">Bonificador de proficiencia: <b>${fmtBonus(pb)}</b></span>
      <button class="btn btn-sm btn-outline edit-mode-toggle" onclick="toggleEdit()">${editMode ? '✓ Listo' : '✏ Editar'}</button>
    </div>
    <div class="section-title">Puntuaciones</div>
    <div class="ability-grid">
      ${Object.entries(scores).map(([ab, v]) => `
        <div class="ability-box">
          <div class="ability-label">${ABILITY_FULL[ab]}</div>
          <div class="ability-score">${v}</div>
          <div class="ability-mod">${fmtBonus(abilityMod(v))}</div>
        </div>`).join('')}
    </div>
    <div class="section-title">Tiradas de salvación</div>
    ${['str','dex','con','int','wis','cha'].map(ab => {
      const isProf = classData?.saving_throws?.includes(ab);
      const bonus = abilityMod(scores[ab]) + (isProf ? pb : 0);
      return `<div class="save-row">
        <div class="save-dot${isProf ? ' prof' : ''}"></div>
        <div class="save-name">${ABILITY_FULL[ab]}</div>
        <div class="save-bonus">${fmtBonus(bonus)}</div>
      </div>`;
    }).join('')}
    <div class="section-title">Habilidades</div>
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

function renderCombate(el) {
  const scores = char.ability_scores;
  const pb = profBonus(char.level);
  const dexMod = abilityMod(scores.dex);
  const subclassName = char.subclass_key && classData?.subclasses?.[char.subclass_key]?.name || '—';
  const inspirationDie = inspirationDieByLevel(char.level);
  el.innerHTML = `
    <div class="hp-editor">
      <button class="hp-editor-btn" onclick="adjustHp(-1)">−</button>
      <div style="flex:1;text-align:center">
        <div class="hp-editor-val">${char.hp_current}</div>
        <div class="hp-editor-max">de ${char.hp_max} PG</div>
      </div>
      <button class="hp-editor-btn" onclick="adjustHp(+1)">+</button>
    </div>
    <div class="combat-grid">
      <div class="stat-box"><div class="stat-val">${char.ac}</div><div class="stat-label">CA</div></div>
      <div class="stat-box"><div class="stat-val">${fmtBonus(dexMod)}</div><div class="stat-label">Iniciativa</div></div>
      <div class="stat-box"><div class="stat-val">30 ft</div><div class="stat-label">Velocidad</div></div>
    </div>
    <div class="section-title">Inspiración bárdica</div>
    <div style="display:flex;align-items:center;padding:8px 0">
      <div class="inspiration-die">${inspirationDie}</div>
      <div style="font-size:12px;color:#555">Dado de inspiración · ${subclassName}</div>
    </div>
    <div class="section-title">Tiradas de salvación</div>
    ${['str','dex','con','int','wis','cha'].map(ab => {
      const isProf = classData?.saving_throws?.includes(ab);
      const bonus = abilityMod(scores[ab]) + (isProf ? pb : 0);
      return `<div class="save-row">
        <div class="save-dot${isProf ? ' prof' : ''}"></div>
        <div class="save-name">${ABILITY_FULL[ab]}</div>
        <div class="save-bonus">${fmtBonus(bonus)}</div>
      </div>`;
    }).join('')}
  `;
}

function inspirationDieByLevel(level) {
  if (level >= 15) return 'd12';
  if (level >= 10) return 'd10';
  if (level >= 5) return 'd8';
  return 'd6';
}

function renderMagia(el) {
  const scores = char.ability_scores;
  const pb = profBonus(char.level);
  const chaMod = abilityMod(scores.cha);
  const spellDC = 8 + pb + chaMod;
  const spellAtk = pb + chaMod;
  const slots = char.spell_slots || {};
  const allSpells = classData?.spells || {};
  const known = char.spells_known || [];
  const knownSpells = known.map(k => allSpells[k]).filter(Boolean);
  const cantrips = knownSpells.filter(s => s.level === 0);
  const leveled = knownSpells.filter(s => s.level > 0).sort((a, b) => a.level - b.level);

  el.innerHTML = `
    <div class="spell-dc-bar">
      <div class="spell-dc-item"><div class="spell-dc-val">${spellDC}</div><div class="spell-dc-label">CD Conjuro</div></div>
      <div class="spell-dc-item"><div class="spell-dc-val">${fmtBonus(spellAtk)}</div><div class="spell-dc-label">Bon. Ataque</div></div>
      <div class="spell-dc-item"><div class="spell-dc-val">${fmtBonus(chaMod)}</div><div class="spell-dc-label">Mod. CAR</div></div>
    </div>
    ${Object.keys(slots).length ? `
    <div class="section-title">Espacios de conjuro</div>
    ${Object.entries(slots).sort(([a],[b])=>+a-+b).map(([lvl, s]) => `
      <div class="spell-level-row">
        <div class="spell-level-label">Nv ${lvl}</div>
        <div class="slot-pips">
          ${Array.from({length: s.max}, (_, i) => `
            <div class="slot-pip${i < s.used ? ' used' : ''}" onclick="toggleSlot('${lvl}',${i})"></div>`).join('')}
        </div>
        <button class="btn-icon" onclick="restoreSlots('${lvl}')" title="Restaurar">↺</button>
      </div>`).join('')}` : ''}
    ${cantrips.length ? `
    <div class="section-title">Trucos</div>
    ${cantrips.map(s => spellCard(s)).join('')}` : ''}
    ${leveled.length ? `
    <div class="section-title">Conjuros</div>
    ${leveled.map(s => spellCard(s)).join('')}` : ''}
    ${!known.length ? '<div style="padding:24px;text-align:center;color:#888;font-size:13px">No hay conjuros conocidos</div>' : ''}
  `;
}

function spellCard(s) {
  const levelLabel = s.level === 0 ? 'Truco' : `Nv ${s.level}`;
  return `<div class="spell-card" onclick="this.classList.toggle('expanded')">
    <div class="spell-header">
      <span class="spell-level-badge">${levelLabel}</span>
      <span class="spell-name">${escHtml(s.name)}</span>
      <span class="spell-school">${escHtml(s.school)}</span>
    </div>
    <div class="spell-desc">${escHtml(s.description)}</div>
  </div>`;
}

function renderInventario(el) {
  const coins = char.coins || { pp:0, gp:0, ep:0, sp:0, cp:0 };
  const weapons = char.weapons || [];
  const inventory = char.inventory || [];
  const pb = profBonus(char.level);
  const scores = char.ability_scores;

  el.innerHTML = `
    <div class="section-title">Monedas</div>
    <div class="coin-grid">
      ${['pp','gp','ep','sp','cp'].map(c => `
        <div class="coin-box">
          <div class="coin-val" onclick="editCoin('${c}')">${coins[c] ?? 0}</div>
          <div class="coin-label">${c.toUpperCase()}</div>
        </div>`).join('')}
    </div>
    <div class="section-title">Armas</div>
    ${weapons.map((w, i) => {
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
    }).join('')}
    ${editMode ? `
    <div class="add-row" style="flex-wrap:wrap;gap:6px;margin-top:8px">
      <input class="input-field" id="w-name" placeholder="Nombre arma" style="flex:2;min-width:120px">
      <input class="input-field input-sm" id="w-die" placeholder="1d6">
      <select class="input-field input-sm" id="w-ability">${['str','dex','cha'].map(a=>`<option value="${a}">${ABILITY_NAMES[a]}</option>`).join('')}</select>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px"><input type="checkbox" id="w-prof"> Prof</label>
      <button class="btn btn-primary btn-sm" onclick="addWeapon()">+</button>
    </div>` : ''}
    <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
      <span>Objetos</span>
      <button class="btn btn-sm btn-outline edit-mode-toggle" onclick="toggleEdit()">${editMode ? '✓ Listo' : '✏ Editar'}</button>
    </div>
    ${inventory.map((item, i) => `
      <div class="item-row">
        <div class="item-name">${escHtml(item.name)}</div>
        <div class="item-qty">x${item.qty}</div>
        ${editMode ? `<button class="delete-btn" onclick="removeItem(${i})">×</button>` : ''}
      </div>`).join('')}
    ${editMode ? `
    <div class="add-row">
      <input class="input-field" id="item-name" placeholder="Objeto">
      <input class="input-field input-sm" id="item-qty" placeholder="1" type="number" min="1" value="1">
      <button class="btn btn-primary btn-sm" onclick="addItem()">+</button>
    </div>` : ''}
  `;
}

function renderFeats(el) {
  const level = char.level;
  const featuresByLevel = classData?.features_by_level || {};
  const subclass = char.subclass_key && classData?.subclasses?.[char.subclass_key];
  const subFeatures = subclass?.features_by_level || {};
  const manualFeats = char.features || [];

  let html = `<div class="section-title">Rasgos de clase</div>`;
  for (let l = 1; l <= level; l++) {
    const feats = featuresByLevel[String(l)] || [];
    if (feats.length) {
      html += feats.map(f => `
        <div class="feat-card">
          <div class="feat-level">Nivel ${l}</div>
          <div class="feat-name">${escHtml(f)}</div>
        </div>`).join('');
    }
  }
  if (subclass) {
    html += `<div class="section-title">${escHtml(subclass.name)}</div>`;
    for (let l = 1; l <= level; l++) {
      const feats = subFeatures[String(l)] || [];
      if (feats.length) {
        html += feats.map(f => `
          <div class="feat-card">
            <div class="feat-level">Nivel ${l}</div>
            <div class="feat-name">${escHtml(f)}</div>
          </div>`).join('');
      }
    }
  }
  if (manualFeats.length) {
    html += `<div class="section-title">Rasgos adicionales</div>`;
    html += manualFeats.map((f, i) => `
      <div class="feat-card">
        <div class="feat-name">${escHtml(f)}</div>
        ${editMode ? `<button class="delete-btn" onclick="removeFeat(${i})">×</button>` : ''}
      </div>`).join('');
  }
  html += `
    <div style="margin-top:8px">
      <button class="btn btn-outline btn-sm edit-mode-toggle" onclick="toggleEdit()">${editMode ? '✓ Listo' : '✏ Editar'}</button>
    </div>`;
  if (editMode) {
    html += `
    <div class="add-row" style="margin-top:8px">
      <input class="input-field" id="feat-input" placeholder="Nuevo rasgo o dote">
      <button class="btn btn-primary btn-sm" onclick="addFeat()">+</button>
    </div>`;
  }
  el.innerHTML = html;
}

function renderNotas(el) {
  const notes = char.notes || [];
  el.innerHTML = `
    <div style="margin-bottom:12px">
      <button class="btn btn-outline btn-sm" onclick="addNote('npc')">+ PNJ</button>
      <button class="btn btn-outline btn-sm" style="margin-left:6px" onclick="addNote('lugar')">+ Lugar</button>
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
    ${!notes.length ? '<div style="padding:24px;text-align:center;color:#888;font-size:13px">Sin notas aún</div>' : ''}
  `;
}

// ── Global handlers ────────────────────────────────────────

window.switchTab = (i) => { activeTab = i; render(); };
window.toggleEdit = () => { editMode = !editMode; renderActiveTab(); };

window.openHpEditor = () => {
  const val = prompt(`PG actuales (máx ${char.hp_max}):`, char.hp_current);
  if (val !== null && !isNaN(+val)) {
    save({ hp_current: Math.min(char.hp_max, Math.max(0, +val)) }).then(render);
  }
};

window.adjustHp = (delta) => {
  const newHp = Math.min(char.hp_max, Math.max(0, char.hp_current + delta));
  save({ hp_current: newHp }).then(() => render());
};

window.toggleSlot = (level, index) => {
  const slots = JSON.parse(JSON.stringify(char.spell_slots));
  const s = slots[level];
  const used = s.used;
  if (index < used) { s.used = index; }
  else if (index === used && used < s.max) { s.used = used + 1; }
  else { s.used = used > 0 ? used - 1 : 0; }
  save({ spell_slots: slots }).then(() => renderActiveTab());
};

window.restoreSlots = (level) => {
  const slots = JSON.parse(JSON.stringify(char.spell_slots));
  slots[level].used = 0;
  save({ spell_slots: slots }).then(() => renderActiveTab());
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
  const weapons = [...(char.weapons || []), {
    name,
    damage_die: document.getElementById('w-die')?.value.trim() || '1d6',
    ability: document.getElementById('w-ability')?.value || 'str',
    type: '',
    proficient: document.getElementById('w-prof')?.checked || false,
  }];
  save({ weapons }).then(() => renderActiveTab());
};

window.removeWeapon = (i) => {
  const weapons = [...(char.weapons || [])];
  weapons.splice(i, 1);
  save({ weapons }).then(() => renderActiveTab());
};

window.addItem = () => {
  const name = document.getElementById('item-name')?.value.trim();
  if (!name) return;
  const qty = parseInt(document.getElementById('item-qty')?.value) || 1;
  const inventory = [...(char.inventory || []), { name, qty }];
  save({ inventory }).then(() => renderActiveTab());
};

window.removeItem = (i) => {
  const inventory = [...(char.inventory || [])];
  inventory.splice(i, 1);
  save({ inventory }).then(() => renderActiveTab());
};

window.addFeat = () => {
  const val = document.getElementById('feat-input')?.value.trim();
  if (!val) return;
  const features = [...(char.features || []), val];
  save({ features }).then(() => renderActiveTab());
};

window.removeFeat = (i) => {
  const features = [...(char.features || [])];
  features.splice(i, 1);
  save({ features }).then(() => renderActiveTab());
};

window.addNote = (type) => {
  const title = prompt(`Título (${type}):`);
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
