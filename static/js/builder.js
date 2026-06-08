import { api } from '/static/js/api.js';

const RACES = [
  { key: 'human',      name: 'Humano',          asi: { str:1, dex:1, con:1, int:1, wis:1, cha:1 } },
  { key: 'elf_high',   name: 'Elfo (Alto)',      asi: { dex:2, int:1 } },
  { key: 'elf_wood',   name: 'Elfo (Bosque)',    asi: { dex:2, wis:1 } },
  { key: 'drow',       name: 'Drow',             asi: { dex:2, cha:1 } },
  { key: 'dwarf_hill', name: 'Enano (Colina)',   asi: { con:2, wis:1 } },
  { key: 'dwarf_mtn',  name: 'Enano (Montaña)',  asi: { str:2, con:2 } },
  { key: 'halfling',   name: 'Mediano',          asi: { dex:2, cha:1 } },
  { key: 'half_elf',   name: 'Semielfo',         asi: { cha:2, dex:1, wis:1 } },
  { key: 'half_orc',   name: 'Semiorco',         asi: { str:2, con:1 } },
  { key: 'gnome',      name: 'Gnomo',            asi: { int:2, con:1 } },
  { key: 'tiefling',   name: 'Tiefling',         asi: { cha:2, int:1 } },
  { key: 'dragonborn', name: 'Draconido',        asi: { str:2, cha:1 } },
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_NAMES = { str: 'FUE', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };
const ABILITY_FULL = { str: 'Fuerza', dex: 'Destreza', con: 'Constitución', int: 'Inteligencia', wis: 'Sabiduría', cha: 'Carisma' };
const LEVEL_RANGE = Array.from({ length: 20 }, (_, i) => i + 1);

let state = {
  step: 1,
  name: '',
  level: 1,
  race: '',
  abilityAssign: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
  background: '',
  classSkills: [],
  subclass: '',
  cantrips: [],
  spells: [],
  classData: null,
  backgroundsData: null,
};

export async function renderList() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="char-list-header">
      <div class="char-list-title">D&amp;D Character</div>
      <div class="char-list-sub">Hoja de personaje</div>
    </div>
    <div id="char-list-body" style="padding:8px 0"></div>
  `;
  try {
    const chars = await api.getCharacters();
    const body = document.getElementById('char-list-body');
    if (!chars.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎵</div>
          <div class="empty-state-text">No hay personajes aún</div>
          <button class="btn btn-primary" onclick="window.location='/?view=new'">Crear personaje</button>
        </div>`;
    } else {
      body.innerHTML = chars.map(c => `
        <a class="char-card" href="/?view=sheet&id=${c.id}">
          <div>
            <div class="char-card-name">${c.name}</div>
            <div class="char-card-meta">${c.class_key.charAt(0).toUpperCase() + c.class_key.slice(1)} · Nivel ${c.level}</div>
          </div>
          <div class="char-card-chevron">›</div>
        </a>`).join('') + `
        <div style="padding:16px">
          <button class="btn btn-outline btn-block" onclick="window.location='/?view=new'">+ Nuevo personaje</button>
        </div>`;
    }
  } catch (e) {
    document.getElementById('char-list-body').innerHTML = `<div style="padding:24px;color:#888">Error cargando personajes</div>`;
  }
}

export async function initBuilder() {
  state = {
    step: 1, name: '', level: 1, race: '',
    abilityAssign: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    background: '', classSkills: [], subclass: '',
    cantrips: [], spells: [], classData: null, backgroundsData: null,
  };
  window.state = state;
  try {
    [state.classData, state.backgroundsData] = await Promise.all([
      api.getClass('bard'), api.getBackgrounds(),
    ]);
  } catch (e) {
    document.getElementById('app').innerHTML = `<div style="padding:24px;color:#888">Error cargando datos</div>`;
    return;
  }
  renderStep();
}

const STEP_LABELS = ['Info', 'Atributos', 'Trasfondo', 'Subclase', 'Conjuros'];

function renderStep() {
  const app = document.getElementById('app');
  const step = state.step;
  app.innerHTML = `
    <div class="builder-header">
      <button class="back-btn" onclick="${step === 1 ? "window.location='/'" : 'prevStep()'}">‹ ${step === 1 ? 'Atrás' : 'Anterior'}</button>
      <div class="builder-title">Nuevo personaje</div>
      <div class="step-dots">${STEP_LABELS.map((_, i) => `<div class="step-dot ${i + 1 < step ? 'done' : i + 1 === step ? 'active' : ''}"></div>`).join('')}</div>
      <div class="step-label">Paso ${step} de 5 — ${STEP_LABELS[step - 1]}</div>
    </div>
    <div class="builder-body" id="builder-body"></div>
    <div class="builder-nav" id="builder-nav"></div>
  `;
  const body = document.getElementById('builder-body');
  const nav = document.getElementById('builder-nav');
  const steps = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];
  steps[step - 1](body);
  renderNav(nav);
}

function renderNav(nav) {
  const isLast = state.step === 5;
  nav.innerHTML = `
    ${state.step > 1 ? '<button class="btn btn-outline" onclick="prevStep()">Anterior</button>' : '<div></div>'}
    <button class="btn btn-primary" style="flex:1;margin-left:8px" onclick="${isLast ? 'finishBuilder()' : 'nextStep()'}">${isLast ? 'Crear personaje' : 'Siguiente'}</button>
  `;
}

function renderStep1(body) {
  body.innerHTML = `
    <div class="step-title">Información básica</div>
    <div class="step-sub">El nombre y nivel de tu personaje.</div>
    <div class="field-label">Nombre</div>
    <input class="input-field" style="width:100%;margin-bottom:12px" placeholder="Nombre del personaje" value="${escHtml(state.name)}" oninput="state.name=this.value" id="name-input">
    <div class="field-label">Nivel</div>
    <div class="pills">${LEVEL_RANGE.map(l => `<div class="pill${state.level === l ? ' selected' : ''}" onclick="selectLevel(${l})">${l}</div>`).join('')}</div>
    <div class="field-label" style="margin-top:14px">Raza</div>
    <div class="pills">${RACES.map(r => `<div class="pill${state.race === r.key ? ' selected' : ''}" onclick="selectRace('${r.key}')">${r.name}</div>`).join('')}</div>
  `;
}

function renderStep2(body) {
  const race = RACES.find(r => r.key === state.race);
  const asi = race ? race.asi : {};
  const usedValues = Object.values(state.abilityAssign).filter(v => v !== null);
  body.innerHTML = `
    <div class="step-title">Puntuaciones</div>
    <div class="step-sub">Asigna el array estándar: ${STANDARD_ARRAY.join(', ')}. Los bonos raciales se suman automáticamente.</div>
    <div class="ability-assign-grid">
      ${ABILITIES.map(ab => {
        const racialBonus = asi[ab] || 0;
        const currentVal = state.abilityAssign[ab];
        const options = STANDARD_ARRAY.map(v => {
          const isUsedByOther = usedValues.includes(v) && currentVal !== v;
          return `<option value="${v}" ${currentVal === v ? 'selected' : ''} ${isUsedByOther ? 'disabled' : ''}>${v}</option>`;
        }).join('');
        return `
          <div class="ability-assign-row">
            <div class="ability-assign-label">${ABILITY_NAMES[ab]}</div>
            <select class="ability-assign-select" onchange="assignAbility('${ab}', +this.value)">
              <option value="">—</option>
              ${options}
            </select>
            ${racialBonus ? `<span class="racial-bonus">+${racialBonus}</span>` : ''}
          </div>`;
      }).join('')}
    </div>
    ${Object.values(state.abilityAssign).every(v => v !== null) ? `
      <div style="padding:10px;background:#f5f5f5;border-radius:4px;font-size:11px;color:#555;margin-top:8px">
        Valores finales: ${ABILITIES.map(ab => `${ABILITY_NAMES[ab]} ${(state.abilityAssign[ab] || 0) + (asi[ab] || 0)}`).join(' · ')}
      </div>` : ''}
  `;
}

function renderStep3(body) {
  const bgKeys = Object.keys(state.backgroundsData);
  const selectedBg = state.backgroundsData[state.background];
  const bgSkills = selectedBg ? selectedBg.skill_proficiencies : [];
  const available = state.classData.skill_choices.filter(s => !bgSkills.includes(s));
  const max = state.classData.skill_count;
  body.innerHTML = `
    <div class="step-title">Trasfondo y habilidades</div>
    <div class="step-sub">El trasfondo otorga 2 habilidades automáticamente. Luego elige ${max} habilidades de bardo.</div>
    <div class="field-label">Trasfondo</div>
    <div class="pills">${bgKeys.map(k => `<div class="pill${state.background === k ? ' selected' : ''}" onclick="selectBackground('${k}')">${state.backgroundsData[k].name}</div>`).join('')}</div>
    ${selectedBg ? `<div style="font-size:11px;color:#555;margin:8px 0 12px">Habilidades: <b>${bgSkills.join(', ')}</b></div>` : ''}
    <div class="field-label">Habilidades de bardo (elige ${max})</div>
    <div class="pills">${available.map(s => {
      const sel = state.classSkills.includes(s);
      const disabled = !sel && state.classSkills.length >= max;
      return `<div class="pill${sel ? ' selected' : ''}${disabled ? ' disabled' : ''}" onclick="${disabled ? '' : `toggleClassSkill('${s}')`}">${s}</div>`;
    }).join('')}</div>
  `;
}

function renderStep4(body) {
  const subclasses = state.classData.subclasses;
  const isAvailable = state.level >= 3;
  body.innerHTML = `
    <div class="step-title">Colegio Bárdico</div>
    <div class="step-sub">${isAvailable ? 'Elige tu colegio.' : 'Disponible a nivel 3. Puedes elegirlo ahora para cuando subas de nivel.'}</div>
    ${Object.entries(subclasses).map(([key, sc]) => {
      const sel = state.subclass === key;
      const featureList = Object.entries(sc.features_by_level || {}).map(([lvl, feats]) => `Nivel ${lvl}: ${feats.join(', ')}`).join(' · ');
      return `
        <div class="subclass-card${sel ? ' selected' : ''}" onclick="selectSubclass('${key}')">
          <div class="subclass-name">${sc.name}</div>
          <div class="subclass-desc">${sc.description}</div>
          ${featureList ? `<div class="subclass-features">${featureList}</div>` : ''}
        </div>`;
    }).join('')}
  `;
}

function renderStep5(body) {
  const allSpells = state.classData.spells;
  const cantripsMax = cantripsAtLevel(state.level);
  const spellsMax = state.classData.spells_known_by_level[String(state.level)] || 0;
  const cantrips = Object.entries(allSpells).filter(([, s]) => s.level === 0);
  const leveled = Object.entries(allSpells).filter(([, s]) => s.level > 0 && s.level <= Math.ceil(state.level / 2));
  const profBonus = Math.floor((state.level - 1) / 4) + 2;
  const race = RACES.find(r => r.key === state.race);
  const asi = race ? race.asi : {};
  const chaMod = abilityMod((state.abilityAssign.cha || 10) + (asi.cha || 0));
  body.innerHTML = `
    <div class="step-title">Conjuros</div>
    <div class="step-sub">Elige ${cantripsMax} trucos y ${spellsMax} conjuros.</div>
    <div style="display:flex;gap:16px;padding:8px 10px;background:#f5f5f5;border-radius:4px;margin-bottom:12px;font-size:11px">
      <div><span style="font-weight:700;font-size:16px">${8 + profBonus + chaMod}</span><br><span style="color:#888;font-size:9px">CD CONJURO</span></div>
      <div><span style="font-weight:700;font-size:16px">${fmtBonus(profBonus + chaMod)}</span><br><span style="color:#888;font-size:9px">BON. ATAQUE</span></div>
    </div>
    <div class="field-label">Trucos (elige ${cantripsMax})</div>
    <div class="pills">${cantrips.map(([k, s]) => {
      const sel = state.cantrips.includes(k);
      const dis = !sel && state.cantrips.length >= cantripsMax;
      return `<div class="pill${sel ? ' selected' : ''}${dis ? ' disabled' : ''}" onclick="${dis ? '' : `toggleSpell('${k}','cantrip')`}">${s.name}</div>`;
    }).join('')}</div>
    <div class="field-label">Conjuros (elige ${spellsMax})</div>
    <div class="pills">${leveled.map(([k, s]) => {
      const sel = state.spells.includes(k);
      const dis = !sel && state.spells.length >= spellsMax;
      return `<div class="pill${sel ? ' selected' : ''}${dis ? ' disabled' : ''}" onclick="${dis ? '' : `toggleSpell('${k}','spell')`}">Nv${s.level} ${s.name}</div>`;
    }).join('')}</div>
  `;
}

function cantripsAtLevel(lvl) {
  const table = { 1:2, 4:3, 10:4 };
  return table[Math.max(...Object.keys(table).map(Number).filter(k => k <= lvl))] || 2;
}

function abilityMod(score) { return Math.floor((score - 10) / 2); }
function fmtBonus(n) { return (n >= 0 ? '+' : '') + n; }
function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Global handlers (called from onclick)
window.state = state;
window.prevStep = () => { state.step--; renderStep(); };
window.nextStep = () => {
  if (!validateStep()) return;
  state.step++;
  renderStep();
};
window.selectLevel = (l) => { state.level = l; renderStep(); };
window.selectRace = (k) => { state.race = k; renderStep(); };
window.assignAbility = (ab, val) => { state.abilityAssign[ab] = val || null; renderStep(); };
window.selectBackground = (k) => {
  state.background = k;
  const bgSkills = state.backgroundsData[k].skill_proficiencies;
  state.classSkills = state.classSkills.filter(s => !bgSkills.includes(s));
  renderStep();
};
window.toggleClassSkill = (s) => {
  const i = state.classSkills.indexOf(s);
  if (i >= 0) state.classSkills.splice(i, 1);
  else if (state.classSkills.length < state.classData.skill_count) state.classSkills.push(s);
  renderStep();
};
window.selectSubclass = (k) => { state.subclass = k; renderStep(); };
window.toggleSpell = (k, type) => {
  const arr = type === 'cantrip' ? state.cantrips : state.spells;
  const max = type === 'cantrip' ? cantripsAtLevel(state.level) : (state.classData.spells_known_by_level[String(state.level)] || 0);
  const i = arr.indexOf(k);
  if (i >= 0) arr.splice(i, 1);
  else if (arr.length < max) arr.push(k);
  renderStep();
};

window.finishBuilder = async () => {
  if (!validateStep()) return;
  const race = RACES.find(r => r.key === state.race);
  const asi = race ? race.asi : {};
  const scores = {};
  for (const ab of ABILITIES) {
    scores[ab] = (state.abilityAssign[ab] || 10) + (asi[ab] || 0);
  }
  const level = state.level;
  const profBonus = Math.floor((level - 1) / 4) + 2;
  const conMod = abilityMod(scores.con);
  const hitDie = state.classData.hit_die;
  const hpMax = hitDie + conMod + (level > 1 ? (Math.floor(hitDie / 2) + 1 + conMod) * (level - 1) : 0);
  const dexMod = abilityMod(scores.dex);
  const ac = 10 + dexMod;

  const slotsTable = state.classData.spell_slots_by_level[String(level)] || {};
  const spellSlots = {};
  for (const [lvl, max] of Object.entries(slotsTable)) {
    spellSlots[lvl] = { max, used: 0 };
  }

  const bgSkills = state.background ? (state.backgroundsData[state.background]?.skill_proficiencies || []) : [];
  const skillProf = [...new Set([...bgSkills, ...state.classSkills])];

  const payload = {
    name: state.name,
    class_key: 'bard',
    subclass_key: state.subclass || null,
    level,
    race: state.race,
    background: state.background,
    ability_scores: scores,
    skill_proficiencies: skillProf,
    expertise: [],
    spells_known: [...state.cantrips, ...state.spells],
    spell_slots: spellSlots,
    hp_max: Math.max(1, hpMax),
    hp_current: Math.max(1, hpMax),
    ac,
    features: [],
    weapons: [],
    inventory: [],
    coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    notes: [],
  };
  try {
    const res = await api.createCharacter(payload);
    window.location = `/?view=sheet&id=${res.id}`;
  } catch (e) {
    alert('Error creando personaje: ' + e.message);
  }
};

function validateStep() {
  const s = state.step;
  if (s === 1) {
    if (!state.name.trim()) { alert('Ingresa un nombre para el personaje.'); return false; }
    if (!state.race) { alert('Elige una raza.'); return false; }
  }
  if (s === 2) {
    if (Object.values(state.abilityAssign).some(v => v === null)) {
      alert('Asigna todos los atributos.'); return false;
    }
  }
  if (s === 3) {
    if (!state.background) { alert('Elige un trasfondo.'); return false; }
  }
  return true;
}
