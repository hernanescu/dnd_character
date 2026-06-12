import { api } from '/static/js/api.js';
import { themeIcon } from '/static/js/icons.js';
import {
  ABILITY_NAMES, ABILITY_FULL, SPELLCASTING_ABILITY, RARITY_COLORS,
  abilityMod, fmtBonus, escHtml, ordinalLabel, log,
} from '/static/js/utils.js';
import { maxPreparedSpells, cantripsKnown, maxSpellLevel } from '/static/js/spell-rules.js';

const CLASSES = [
  { key: 'artificer', name: 'Artificer' },
  { key: 'barbarian', name: 'Barbarian' },
  { key: 'bard',      name: 'Bard' },
  { key: 'cleric',    name: 'Cleric' },
  { key: 'druid',     name: 'Druid' },
  { key: 'fighter',   name: 'Fighter' },
  { key: 'monk',      name: 'Monk' },
  { key: 'paladin',   name: 'Paladin' },
  { key: 'ranger',    name: 'Ranger' },
  { key: 'rogue',     name: 'Rogue' },
  { key: 'sorcerer',  name: 'Sorcerer' },
  { key: 'warlock',   name: 'Warlock' },
  { key: 'wizard',    name: 'Wizard' },
];

// Loaded from /api/races (scraped from dnd5e.wikidot.com lineage pages).
// Entries: { key, name, category, desc, size, speed, asi, flexAsi,
//            flexible_asi, traits:[{name,desc}], skills, bonusSkills }
let RACES = [];

// Loaded from /api/feats (scraped from dnd5e.wikidot.com feat pages).
// Entries: { key, name, category, desc, benefits, prerequisite,
//            asi: { choices: ['str',...] | 'any', points } }
let FEATS = [];

// Background source categories
const BG_SOURCES = {
  'PHB': ['acolyte','charlatan','criminal','entertainer','folk-hero','guild-artisan','hermit','noble','outlander','sage','sailor','soldier','urchin'],
  'SCAG': ['city-watch','clan-crafter','cloistered-scholar','courtier','faction-agent','far-traveler','inheritor','knight-of-the-order','mercenary-veteran','uthgardt-tribe-member','waterdhavian-noble'],
  'Ravnica': ['azorius-functionary','boros-legionnaire','dimir-operative','golgari-agent','gruul-anarch','izzet-engineer','orzhov-representative','rakdos-cultist','selesnya-initiate','simic-scientist'],
  'Strixhaven': ['lorehold-student','prismari-student','quandrix-student','silverquill-student','witherbloom-student'],
  'Spelljammer': ['astral-drifter','giant-foundling','wildspacer'],
  'Witchlight': ['feylost','witchlight-hand'],
  'Dragonlance': ['knight-of-solamnia','mage-of-high-sorcery'],
  'Planescape': ['planar-philosopher','rewarded','rival-intern','ruined'],
  'Acq. Inc.': ['celebrity-adventurers-scion','failed-merchant','grinner','house-agent'],
};

const ALL_SKILLS = ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const LEVEL_RANGE = Array.from({ length: 20 }, (_, i) => i + 1);

let state = {
  step: 1,
  name: '',
  classKey: 'bard',
  level: 1,
  hpMethod: 'average',
  race: '',
  abilityAssign: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
  abilityMode: 'array',
  background: '',
  bgFilter: 'all',
  classSkills: [],
  racialSkills: [],
  expertise: [],
  subclass: '',
  choices: {},
  flexAsiChoices: [],
  cantrips: [],
  spells: [],
  classData: null,
  backgroundsData: null,
  spellData: null,
  spellFilter: '',
};

function hasSpells() {
  const d = state.classData;
  return d && d.spells && d.spells.length > 0;
}

function maxSteps() {
  return hasSpells() ? 5 : 4;
}

function stepLabels() {
  const labels = ['Info', 'Abilities', 'Background', 'Subclass'];
  if (hasSpells()) labels.push('Spells');
  return labels;
}

function className(key) {
  const c = CLASSES.find(c => c.key === key);
  return c ? c.name : key.charAt(0).toUpperCase() + key.slice(1);
}

export async function renderSpellLibrary() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-header">
      <div>
        <button class="back-btn" style="padding:0 0 6px;color:#888" onclick="window.location='/'">‹ Characters</button>
        <div class="char-name" style="font-size:18px">Spell Library</div>
      </div>
      <button class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">${themeIcon(document.documentElement.getAttribute('data-theme'))}</button>
    </div>
    <div style="padding:10px 12px 0">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <select id="lib-class" class="input-field input-sm" style="flex:1;min-width:100px" onchange="filterLibrary()">
          <option value="">All classes</option>
          ${CLASSES.map(c => `<option value="${c.key}">${c.name}</option>`).join('')}
        </select>
        <select id="lib-level" class="input-field input-sm" style="width:80px" onchange="filterLibrary()">
          <option value="">All levels</option>
          <option value="0">Cantrip</option>
          ${[1,2,3,4,5,6,7,8,9].map(n=>`<option value="${n}">${n}</option>`).join('')}
        </select>
        <input id="lib-search" class="input-field input-sm" style="flex:2;min-width:120px" placeholder="Search spells…" oninput="filterLibrary()">
      </div>
      <div id="lib-count" style="font-size:11px;color:#888;margin-bottom:6px"></div>
    </div>
    <div id="lib-body" style="padding:0 12px 24px"></div>
  `;

  let allSpells = {};
  try {
    allSpells = await api.getSpells();
  } catch (e) {
    document.getElementById('lib-body').innerHTML = `<div style="padding:24px;color:#888">Error loading spells</div>`;
    return;
  }
  app._spells = allSpells;

  window.filterLibrary = () => {
    const cls = document.getElementById('lib-class')?.value || '';
    const lvl = document.getElementById('lib-level')?.value;
    const q = (document.getElementById('lib-search')?.value || '').toLowerCase();
    const spells = Object.entries(allSpells).filter(([, s]) => {
      if (cls && !s.classes?.includes(cls)) return false;
      if (lvl !== '' && lvl !== undefined && String(s.level) !== lvl) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.school?.toLowerCase().includes(q) && !s.description?.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b) => a[1].level - b[1].level || a[1].name.localeCompare(b[1].name));

    document.getElementById('lib-count').textContent = `${spells.length} spells`;
    document.getElementById('lib-body').innerHTML = spells.map(([, s]) => {
      const lvlLabel = s.level === 0 ? 'Cantrip' : `Level ${s.level}`;
      const ritual = s.ritual ? ' <span style="font-size:9px;background:#888;color:#fff;padding:1px 4px;border-radius:3px">R</span>' : '';
      const conc = s.concentration ? ' <span style="font-size:9px;background:#888;color:#fff;padding:1px 4px;border-radius:3px">C</span>' : '';
      const clsBadges = (s.classes || []).map(c => `<span style="font-size:8px;background:var(--gray-bg);border:1px solid var(--gray-light);padding:1px 5px;border-radius:8px;margin-right:2px">${className(c)}</span>`).join('');
      return `<div class="spell-card" onclick="this.classList.toggle('expanded')" style="margin-bottom:6px">
        <div class="spell-header">
          <span class="spell-level-badge">${lvlLabel}</span>
          <span class="spell-name">${escHtml(s.name)}${ritual}${conc}</span>
          <span class="spell-school">${escHtml(s.school)}</span>
        </div>
        <div style="margin-top:4px">${clsBadges}</div>
        <div class="spell-desc">${escHtml(s.description)}</div>
        <div class="spell-meta">
          <span><b>Casting:</b> ${escHtml(s.casting_time||'')}</span>
          <span><b>Range:</b> ${escHtml(s.range||'')}</span>
          <span><b>Components:</b> ${escHtml(s.components||'')}${s.material?' ('+escHtml(s.material)+')':''}</span>
          <span><b>Duration:</b> ${escHtml(s.duration||'')}</span>
        </div>
        ${s.higher_levels ? `<div class="spell-higher">${escHtml(s.higher_levels)}</div>` : ''}
      </div>`;
    }).join('');
  };
  window.filterLibrary();
}

export async function renderItemLibrary() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-header">
      <div>
        <button class="back-btn" style="padding:0 0 6px;color:#888" onclick="window.location='/'">‹ Characters</button>
        <div class="char-name" style="font-size:18px">Item Library</div>
      </div>
      <button class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">${themeIcon(document.documentElement.getAttribute('data-theme'))}</button>
    </div>
    <div style="padding:10px 12px 0">
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <select id="il-source" class="input-field input-sm" style="flex:1;min-width:90px" onchange="filterItems()">
          <option value="">All sources</option>
          <option value="dmg 2024">DMG 2024</option>
          <option value="dmg 2014">DMG 2014</option>
          <option value="xgte">XGTE</option>
          <option value="tcoe">TCoE</option>
        </select>
        <select id="il-rarity" class="input-field input-sm" style="width:90px" onchange="filterItems()">
          <option value="">All rarities</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="very rare">Very Rare</option>
          <option value="legendary">Legendary</option>
          <option value="artifact">Artifact</option>
        </select>
        <input id="il-min-gp" class="input-field input-sm" type="number" min="0" placeholder="Min gp" style="width:70px" oninput="filterItems()">
        <input id="il-max-gp" class="input-field input-sm" type="number" min="0" placeholder="Max gp" style="width:75px" oninput="filterItems()">
        <input id="il-search" class="input-field input-sm" style="flex:2;min-width:100px" placeholder="Search items…" oninput="filterItems()">
      </div>
      <div id="il-count" style="font-size:11px;color:#888;margin-bottom:6px"></div>
    </div>
    <div id="il-body" style="padding:0 12px 24px"></div>
  `;

  let allItems = {};
  try {
    allItems = await api.getItems();
  } catch (e) {
    document.getElementById('il-body').innerHTML = `<div style="padding:24px;color:#888">Error loading items</div>`;
    return;
  }
  app._items = allItems;

  window.filterItems = () => {
    const src = document.getElementById('il-source')?.value || '';
    const rar = document.getElementById('il-rarity')?.value || '';
    const minGp = parseFloat(document.getElementById('il-min-gp')?.value) || 0;
    const maxGp = parseFloat(document.getElementById('il-max-gp')?.value) || 0;
    const q = (document.getElementById('il-search')?.value || '').toLowerCase();
    const items = Object.entries(allItems).filter(([, it]) => {
      if (src && (it.source || '').toLowerCase() !== src) return false;
      if (rar && (it.rarity || '').toLowerCase() !== rar) return false;
      if (minGp > 0 && (it.cost_gp == null || it.cost_gp < minGp)) return false;
      if (maxGp > 0 && (it.cost_gp == null || it.cost_gp > maxGp)) return false;
      if (q && !it.name.toLowerCase().includes(q) && !(it.note || '').toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a[1].name.localeCompare(b[1].name));

    document.getElementById('il-count').textContent = `${items.length} items`;
    document.getElementById('il-body').innerHTML = items.map(([, it]) => {
      const color = RARITY_COLORS[(it.rarity || '').toLowerCase()] || '#888';
      const attune = it.attunement === 'Yes' ? ' <span style="font-size:9px;background:#555;color:#fff;padding:1px 4px;border-radius:3px">A</span>' : '';
      const cost = it.cost_gp != null ? `${it.cost_gp.toLocaleString()} gp` : '—';
      const props = [];
      if (it.armor_cost) props.push(`Armor: ${it.armor_cost} gp`);
      if (it.ac_bonus) props.push(`AC +${it.ac_bonus}`);
      if (it.weapon_bonus) props.push(`Atk/Dmg +${it.weapon_bonus}`);
      if (it.save_bonus) props.push(`Save +${it.save_bonus}`);
      if (it.rare_material) props.push(it.rare_material);
      if (it.set_score != null) props.push(`Set ${it.set_score}`);
      if (it.spell_level != null) props.push(`Spell Lv ${it.spell_level}`);
      if (it.unlimited_charges === 'Y') props.push('∞ Charges');
      else if (it.charges_per_day) props.push(`${it.charges_per_day}/day`);
      const propsHtml = props.length ? `<div style="margin-top:3px;font-size:10px;color:#888">${props.join(' · ')}</div>` : '';
      const extraProps = [];
      if (it.condition) extraProps.push(`Condition: ${it.condition}`);
      if (it.consumable_damage) extraProps.push(`Dmg: ${it.consumable_damage} avg`);
      if (it.perm_damage) extraProps.push(`Perm Dmg: ${it.perm_damage} avg`);
      if (it.semi_perm_damage) extraProps.push(`Semi-perm Dmg: ${it.semi_perm_damage} avg`);
      if (it.restore_hp) extraProps.push(`Heal: ${it.restore_hp} avg`);
      if (it.duration_minutes != null) extraProps.push(`Duration: ${it.duration_minutes} min`);
      const extraHtml = extraProps.length ? `<div style="margin-top:2px;font-size:10px;color:#888">${extraProps.join(' · ')}</div>` : '';
      return `<div class="spell-card" onclick="this.classList.toggle('expanded')" style="margin-bottom:6px">
        <div class="spell-header">
          <span style="background:${color};color:#fff;padding:1px 6px;border-radius:4px;font-size:9px;white-space:nowrap">${escHtml(it.rarity || '')}</span>
          <span class="spell-name">${escHtml(it.name)}${attune}</span>
          <span class="spell-school">${cost}</span>
        </div>
        <div style="margin-top:2px;font-size:10px;color:#888">${escHtml(it.source || '')}</div>
        ${propsHtml}
        ${extraHtml}
        ${it.note ? `<div style="margin-top:4px;font-size:10px;color:#888;border-top:1px solid var(--gray-light);padding-top:3px"><span style="color:#aaa">Pricing:</span> ${escHtml(it.note)}</div>` : ''}
      </div>`;
    }).join('');
  };
  window.filterItems();
}

export async function renderList() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="char-list-header">
      <div class="char-list-title">D&amp;D Character</div>
      <div class="char-list-sub">Companion App</div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="btn btn-sm btn-outline" onclick="window.location='/?view=spells'" style="flex:1"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:3px"><rect x="1.5" y="2" width="11" height="9.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/><line x1="3.5" y1="4.5" x2="10.5" y2="4.5" stroke="currentColor" stroke-width="1.2"/><line x1="3.5" y1="6.8" x2="10.5" y2="6.8" stroke="currentColor" stroke-width="1.2"/><line x1="3.5" y1="9.1" x2="7.5" y2="9.1" stroke="currentColor" stroke-width="1.2"/></svg>Spells</button>
        <button class="btn btn-sm btn-outline" onclick="window.location='/?view=items'" style="flex:1"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle;margin-right:3px"><rect x="2" y="3" width="10" height="8.5" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M4.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>Items</button>
        <button class="theme-toggle-btn" onclick="toggleTheme()" title="Toggle theme">${themeIcon(document.documentElement.getAttribute('data-theme'))}</button>
      </div>
    </div>
    <div id="char-list-body" style="padding:8px 0"></div>
  `;
  try {
    const chars = await api.getCharacters();
    const body = document.getElementById('char-list-body');
    if (!chars.length) {
      body.innerHTML = `
        <div class="empty-state">
          <div style="max-width:340px;margin:0 auto 16px;padding:14px 16px;background:var(--gray-bg);border:1px solid var(--gray-light);border-radius:8px;text-align:left;font-size:13px;line-height:1.6">
            <div style="font-weight:700;margin-bottom:6px">Welcome! 👋</div>
            <div style="color:var(--text-dim)">
              This is your D&amp;D companion. Build a character with the step-by-step
              wizard, then use its sheet during sessions to track HP, spell slots,
              inventory, and world notes. The <b>Spells</b> and <b>Items</b> buttons
              above open the full reference libraries.
            </div>
          </div>
          <div class="empty-state-text">No characters yet</div>
          <button class="btn btn-primary" onclick="window.location='/?view=new'">Create Character</button>
        </div>`;
    } else {
      body.innerHTML = chars.map(c => `
        <div class="char-card-wrap">
          <a class="char-card" href="/?view=sheet&id=${c.id}">
            <div>
              <div class="char-card-name">${escHtml(c.name)}</div>
              <div class="char-card-meta">${className(c.class_key)} · Level ${c.level}</div>
            </div>
            <div class="char-card-chevron">›</div>
          </a>
          <button class="char-card-delete" data-name="${escHtml(c.name)}" onclick="event.preventDefault();event.stopPropagation();deleteChar(${c.id}, this.dataset.name)" title="Delete character">✕</button>
        </div>`).join('') + `
        <div style="padding:16px">
          <button class="btn btn-outline btn-block" onclick="window.location='/?view=new'">+ New Character</button>
        </div>`;
    }
  } catch (e) {
    document.getElementById('char-list-body').innerHTML = `<div style="padding:24px;color:#888">Error loading characters</div>`;
  }
}

window.deleteChar = async (id, name) => {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await api.deleteCharacter(id);
    renderList();
  } catch (e) {
    alert('Failed to delete character');
  }
};

export async function initBuilder() {
  state = {
    step: 1, name: '', classKey: 'bard', level: 1, race: '',
    abilityAssign: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
    abilityMode: 'array',
    background: '', bgFilter: 'all', classSkills: [], racialSkills: [], expertise: [], subclass: '', choices: {}, flexAsiChoices: [],
    flexMode: '21', flexPlus2: null, flexPlus1: null,
    bonusFeatKey: null, bonusFeatAbility: null,
    cantrips: [], spells: [], classData: null, backgroundsData: null, spellData: null, spellFilter: '',
  };
  window.state = state;
  try {
    let racesData, featsData;
    [state.classData, state.backgroundsData, state.spellData, racesData, featsData] = await Promise.all([
      api.getClass(state.classKey), api.getBackgrounds(), api.getSpells(state.classKey), api.getRaces(), api.getFeats(),
    ]);
    RACES = Object.entries(racesData).map(([key, r]) => ({ key, ...r }));
    FEATS = Object.entries(featsData).map(([key, f]) => ({ key, ...f }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    document.getElementById('app').innerHTML = `<div style="padding:24px;color:#888">Error loading data</div>`;
    return;
  }
  renderStep();
}

function renderNav(el) {
  const step = state.step;
  const total = maxSteps();
  const isLast = step === total;
  el.innerHTML = `
    ${step > 1 ? `<button class="btn btn-outline" onclick="prevStep()">‹ Previous</button>` : ''}
    ${isLast
      ? `<button class="btn btn-primary" onclick="finishBuilder()">Create Character</button>`
      : `<button class="btn btn-primary" onclick="nextStep()">Next ›</button>`}
  `;
}

function renderStep() {
  try {
    _renderStep();
  } catch(e) {
    document.getElementById('app').innerHTML = `<div style="padding:24px;font-size:12px;color:#c44"><b>Render error (step ${state.step}):</b><br><pre style="white-space:pre-wrap;word-break:break-all">${e?.stack || e?.message || String(e)}</pre></div>`;
    console.error('renderStep crash:', e);
  }
}

function _renderStep() {
  const app = document.getElementById('app');
  const step = state.step;
  const labels = stepLabels();
  const total = labels.length;
  app.innerHTML = `
    <div class="builder-header">
      <div class="builder-header-top">
        <button class="back-btn" onclick="${step === 1 ? "window.location='/'" : 'prevStep()'}" style="padding:0">‹ ${step === 1 ? 'Back' : 'Previous'}</button>
        <div class="builder-title">New Character</div>
        <button class="theme-toggle-btn" onclick="event.stopPropagation();toggleTheme()" title="Toggle theme" style="margin-left:auto">${themeIcon(document.documentElement.getAttribute('data-theme'))}</button>
      </div>
      <div class="step-dots">${labels.map((_, i) => `<div class="step-dot ${i + 1 < step ? 'done' : i + 1 === step ? 'active' : ''}"></div>`).join('')}</div>
      <div class="step-label">Step ${step} of ${total} — ${labels[step - 1]}</div>
    </div>
    <div class="builder-body" id="builder-body"></div>
    <div class="builder-nav" id="builder-nav"></div>
  `;
  const body = document.getElementById('builder-body');
  const nav = document.getElementById('builder-nav');
  const steps = [renderStep1, renderStep2, renderStep3, renderStep4, hasSpells() ? renderStep5 : null].filter(Boolean);
  steps[step - 1](body);
  renderNav(nav);
}

function currentRace() {
  return RACES.find(r => r.key === state.race);
}

// Total racial ability bonus for one ability, combining fixed ASI, the
// half-elf-style flexAsi picks, and the MPMM "+2/+1 or +1/+1/+1" choice.
function racialBonusFor(ab) {
  const race = currentRace();
  if (!race) return 0;
  let b = race.asi?.[ab] || 0;
  if (race.flexAsi && state.flexAsiChoices.includes(ab)) b += race.flexAsi.points;
  if (race.flexible_asi) {
    if (state.flexMode === '111') b += state.flexAsiChoices.includes(ab) ? 1 : 0;
    else b += (state.flexPlus2 === ab ? 2 : 0) + (state.flexPlus1 === ab ? 1 : 0);
  }
  return b;
}

function currentBonusFeat() {
  return FEATS.find(f => f.key === state.bonusFeatKey);
}

// +1 from a half-feat picked as the variant human bonus feat.
function featBonusFor(ab) {
  const feat = currentBonusFeat();
  return feat?.asi && state.bonusFeatAbility === ab ? feat.asi.points : 0;
}

// All ability bonuses applied at creation time: racial ASI + bonus feat.
function creationBonusFor(ab) {
  return racialBonusFor(ab) + featBonusFor(ab);
}

function raceAsiSummary(race) {
  if (race.flexible_asi) return '+2 and +1 (or +1/+1/+1) to abilities of your choice (Step 2)';
  const fixed = Object.entries(race.asi || {}).map(([a, v]) => `${ABILITY_NAMES[a]} +${v}`).join(', ');
  const flexNote = race.flexAsi ? ` + pick ${race.flexAsi.count}×+${race.flexAsi.points} (Step 2)` : '';
  return fixed + flexNote;
}

function racePills(list) {
  return `<div class="pills">${list.map(r => `<div class="pill${state.race === r.key ? ' selected' : ''}" onclick="selectRace('${r.key}')">${escHtml(r.name)}</div>`).join('')}</div>`;
}

function renderStep1(body) {
  const selRace = currentRace();
  const common = RACES.filter(r => r.category === 'common');
  const exotic = RACES.filter(r => r.category === 'exotic');
  body.innerHTML = `
    <div class="step-title">Basic Info</div>
    <div class="step-sub">Your character's name, class, level, and race.</div>
    <div class="field-label">Name</div>
    <input class="input-field" style="width:100%;margin-bottom:12px" placeholder="Character name" value="${escHtml(state.name)}" oninput="state.name=this.value" id="name-input">
    <div class="field-label">Class</div>
    <div class="pills">${CLASSES.map(c => `<div class="pill${state.classKey === c.key ? ' selected' : ''}" onclick="selectClass('${c.key}')">${c.name}</div>`).join('')}</div>
    <div class="field-label" style="margin-top:12px">Level</div>
    <div class="pills">${LEVEL_RANGE.map(l => `<div class="pill${state.level === l ? ' selected' : ''}" onclick="selectLevel(${l})">${l}</div>`).join('')}</div>
    <div class="field-label" style="margin-top:12px">Race</div>
    ${racePills(common)}
    <div class="field-label" style="margin-top:8px;color:var(--text-dim)">Exotic</div>
    ${racePills(exotic)}
    ${selRace ? `
    <div style="margin-top:10px;padding:10px 12px;background:var(--gray-bg);border-radius:6px;font-size:12px">
      <div style="font-weight:700;margin-bottom:4px">${escHtml(selRace.name)} <span style="font-weight:400;color:var(--text-dim)">· ${escHtml(selRace.size)} · Speed ${selRace.speed}ft · ${escHtml(selRace.source || '')}</span></div>
      <div style="color:var(--accent,#b48a40);margin-bottom:6px;font-size:11px">${escHtml(raceAsiSummary(selRace))}</div>
      ${selRace.skills?.length ? `<div style="color:var(--accent,#b48a40);margin-bottom:6px;font-size:11px">Grants proficiency: ${escHtml(selRace.skills.join(', '))}</div>` : ''}
      <div style="color:var(--text-dim);margin-bottom:6px;font-size:11px">${escHtml(selRace.desc)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${selRace.traits.map(t => `<span style="font-size:10px;background:var(--card-bg);border:1px solid var(--gray-light);border-radius:8px;padding:2px 8px" title="${escHtml(t.desc)}">${escHtml(t.name)}</span>`).join('')}
      </div>
    </div>` : ''}
  `;
}

function renderStep2(body) {
  const mode = state.abilityMode;
  const race = currentRace();
  const flex = race?.flexAsi;
  const allAssigned = Object.values(state.abilityAssign).every(v => v !== null);

  const excludeNote = flex?.exclude?.length
    ? ` (not ${flex.exclude.map(a => ABILITY_NAMES[a]).join('/')})` : '';
  let flexPicker = flex ? `
    <div style="margin-bottom:12px;padding:10px;background:var(--gray-bg);border-radius:6px">
      <div class="field-label" style="margin-bottom:6px">Racial bonus: +${flex.points} to ${flex.count} abilities of choice${excludeNote}</div>
      <div class="pills">
        ${ABILITIES.filter(ab => !(flex.exclude || []).includes(ab)).map(ab => {
          const picked = state.flexAsiChoices.includes(ab);
          const dis = !picked && state.flexAsiChoices.length >= flex.count;
          return `<div class="pill${picked ? ' selected' : ''}${dis ? ' disabled' : ''}" onclick="toggleFlexAsi('${ab}')">${ABILITY_NAMES[ab]}</div>`;
        }).join('')}
      </div>
      <div style="font-size:10px;color:var(--text-dim);margin-top:4px">${state.flexAsiChoices.length}/${flex.count} chosen</div>
    </div>` : '';

  if (race?.flexible_asi) {
    const is21 = state.flexMode !== '111';
    flexPicker = `
    <div style="margin-bottom:12px;padding:10px;background:var(--gray-bg);border-radius:6px">
      <div class="field-label" style="margin-bottom:6px">${escHtml(race.name)} bonus: +2 and +1, or +1 to three abilities</div>
      <div class="pills" style="margin-bottom:6px">
        <div class="pill${is21 ? ' selected' : ''}" onclick="setFlexMode('21')">+2 and +1</div>
        <div class="pill${!is21 ? ' selected' : ''}" onclick="setFlexMode('111')">+1 / +1 / +1</div>
      </div>
      ${is21 ? `
      <div class="field-label">+2 to</div>
      <div class="pills">${ABILITIES.map(ab => `<div class="pill${state.flexPlus2 === ab ? ' selected' : ''}" onclick="setFlexPlus2('${ab}')">${ABILITY_NAMES[ab]}</div>`).join('')}</div>
      <div class="field-label" style="margin-top:6px">+1 to</div>
      <div class="pills">${ABILITIES.map(ab => {
        const dis = state.flexPlus2 === ab;
        return `<div class="pill${state.flexPlus1 === ab ? ' selected' : ''}${dis ? ' disabled' : ''}" onclick="${dis ? '' : `setFlexPlus1('${ab}')`}">${ABILITY_NAMES[ab]}</div>`;
      }).join('')}</div>` : `
      <div class="pills">${ABILITIES.map(ab => {
        const sel = state.flexAsiChoices.includes(ab);
        const dis = !sel && state.flexAsiChoices.length >= 3;
        return `<div class="pill${sel ? ' selected' : ''}${dis ? ' disabled' : ''}" onclick="toggleFlexAsi('${ab}')">${ABILITY_NAMES[ab]}</div>`;
      }).join('')}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-top:4px">${state.flexAsiChoices.length}/3 chosen</div>`}
    </div>`;
  }

  let featPicker = '';
  if (race?.bonusFeat) {
    const feat = currentBonusFeat();
    const abilityChoices = feat?.asi
      ? (feat.asi.choices === 'any' ? ABILITIES : feat.asi.choices) : [];
    featPicker = `
    <div style="margin-bottom:12px;padding:10px;background:var(--gray-bg);border-radius:6px">
      <div class="field-label" style="margin-bottom:6px">${escHtml(race.name)} bonus feat</div>
      <select class="input-field input-sm" style="width:100%" onchange="selectBonusFeat(this.value)">
        <option value="">— choose a feat —</option>
        ${FEATS.map(f => `<option value="${f.key}" ${state.bonusFeatKey === f.key ? 'selected' : ''}>${escHtml(f.name)}${f.asi ? ` (+${f.asi.points} ability)` : ''}</option>`).join('')}
      </select>
      ${feat ? `
      ${feat.prerequisite ? `<div style="font-size:10px;color:var(--text-dim);font-style:italic;margin-top:6px">Prerequisite: ${escHtml(feat.prerequisite)}</div>` : ''}
      <div style="font-size:11px;color:var(--text-dim);margin-top:6px">${escHtml(feat.desc || feat.benefits?.[0] || '')}</div>
      ${feat.asi ? `
      <div class="field-label" style="margin-top:8px">+${feat.asi.points} to</div>
      <div class="pills">${abilityChoices.map(ab => `<div class="pill${state.bonusFeatAbility === ab ? ' selected' : ''}" onclick="setBonusFeatAbility('${ab}')">${ABILITY_NAMES[ab]}</div>`).join('')}</div>` : ''}` : ''}
    </div>`;
  }

  body.innerHTML = `
    <div class="step-title">Ability Scores</div>
    <div class="pills" style="margin-bottom:12px">
      <div class="pill${mode === 'array' ? ' selected' : ''}" onclick="setAbilityMode('array')">Standard Array</div>
      <div class="pill${mode === 'manual' ? ' selected' : ''}" onclick="setAbilityMode('manual')">Manual</div>
      <div class="pill${mode === 'roll' ? ' selected' : ''}" onclick="setAbilityMode('roll')">Roll</div>
    </div>
    ${flexPicker}
    ${featPicker}
    ${mode === 'array' ? `
    <div class="step-sub">Assign standard array (${STANDARD_ARRAY.join(', ')}). Racial bonuses apply automatically.</div>
    <div class="ability-assign-grid">
      ${ABILITIES.map(ab => {
        const rb = creationBonusFor(ab);
        const currentVal = state.abilityAssign[ab];
        const usedValues = Object.values(state.abilityAssign).filter(v => v !== null);
        const options = STANDARD_ARRAY.map(v => {
          const isUsedByOther = usedValues.includes(v) && currentVal !== v;
          return `<option value="${v}" ${currentVal === v ? 'selected' : ''} ${isUsedByOther ? 'disabled' : ''}>${v}</option>`;
        }).join('');
        return `<div class="ability-assign-row">
          <div class="ability-assign-label">${ABILITY_NAMES[ab]}</div>
          <select class="ability-assign-select" onchange="assignAbility('${ab}', +this.value)">
            <option value="">—</option>${options}
          </select>
          ${rb ? `<span class="racial-bonus">+${rb}</span>` : ''}
        </div>`;
      }).join('')}
    </div>` : mode === 'manual' ? `
    <div class="step-sub">Enter scores directly (3–20). Racial bonuses apply automatically.</div>
    <div class="ability-assign-grid">
      ${ABILITIES.map(ab => {
        const rb = creationBonusFor(ab);
        const v = state.abilityAssign[ab];
        return `<div class="ability-assign-row">
          <div class="ability-assign-label">${ABILITY_NAMES[ab]}</div>
          <input class="input-field" type="number" min="3" max="20" value="${v !== null ? v : ''}" placeholder="8" oninput="assignAbility('${ab}', +this.value || null)" style="width:60px;text-align:center">
          ${rb ? `<span class="racial-bonus">+${rb}</span>` : ''}
        </div>`;
      }).join('')}
    </div>` : `
    <div class="step-sub">Click <strong>Roll All</strong> to generate scores (4d6 drop lowest). Reroll individually with ↺.</div>
    <div class="ability-assign-grid">
      ${ABILITIES.map(ab => {
        const rb = creationBonusFor(ab);
        const v = state.abilityAssign[ab];
        return `<div class="ability-assign-row">
          <div class="ability-assign-label">${ABILITY_NAMES[ab]}</div>
          <div style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 6px">
            <span style="font-size:18px;font-weight:700;min-width:28px;text-align:center">${v !== null ? v : '—'}</span>
            <button class="btn btn-sm btn-outline" onclick="rollAbility('${ab}')">↺</button>
          </div>
          ${rb ? `<span class="racial-bonus">+${rb}</span>` : ''}
        </div>`;
      }).join('')}
    </div>
      <button class="btn btn-primary" onclick="rollAll()" style="margin-top:8px;width:100%">Roll All</button>`}
    ${allAssigned ? `
      <div style="padding:10px;background:var(--gray-bg);border-radius:4px;font-size:11px;margin-top:8px">
        Final: ${ABILITIES.map(ab => `<b>${ABILITY_NAMES[ab]}</b> ${(state.abilityAssign[ab]||0)+creationBonusFor(ab)}`).join(' · ')}
      </div>` : ''}
  `;
}

function bgSourceFor(key) {
  for (const [src, keys] of Object.entries(BG_SOURCES)) {
    if (keys.includes(key)) return src;
  }
  return 'Other';
}

function _hasExpertise() {
  const cls = state.classData;
  if (!cls || !cls.features_by_level) return false;
  for (const [lvl, feats] of Object.entries(cls.features_by_level)) {
    if (parseInt(lvl) <= state.level && feats.includes('Expertise')) return true;
  }
  return false;
}

function renderStep3(body) {
  const allBgKeys = Object.keys(state.backgroundsData);
  const filter = state.bgFilter || 'all';
  const allSources = ['all', ...Object.keys(BG_SOURCES), 'Other'];
  const filteredKeys = filter === 'all' ? allBgKeys : allBgKeys.filter(k => bgSourceFor(k) === filter);
  const selectedBg = state.backgroundsData[state.background];
  const bgSkills = selectedBg ? selectedBg.skill_proficiencies : [];
  const bgTools = selectedBg ? (selectedBg.tool_proficiencies || []) : [];
  const bgLangs = selectedBg ? selectedBg.languages : 0;
  const bgFeature = selectedBg ? selectedBg.feature : '';
  const raceData = currentRace();
  const bonusSkills = raceData?.bonusSkills;
  const grantedSkills = raceData?.skills || [];
  const takenSkills = [...bgSkills, ...grantedSkills, ...state.racialSkills];
  const available = state.classData.skill_choices.filter(s => !takenSkills.includes(s));
  const max = state.classData.skill_count;
  const clsName = className(state.classKey);

  const classSkillPills = available.map(s => {
    const sel = state.classSkills.includes(s);
    const dis = !sel && state.classSkills.length >= max;
    if (dis) return `<div class="pill disabled">${escHtml(s)}</div>`;
    return `<div class="pill${sel ? ' selected' : ''}" onclick="toggleClassSkill('${s}')">${escHtml(s)}</div>`;
  }).join('');

  const racialSkillPills = bonusSkills ? (() => {
    const alreadyTaken = [...bgSkills, ...grantedSkills, ...state.classSkills];
    return ALL_SKILLS.filter(s => !alreadyTaken.includes(s)).map(s => {
      const sel = state.racialSkills.includes(s);
      const dis = !sel && state.racialSkills.length >= bonusSkills.count;
      if (dis) return `<div class="pill disabled" style="font-size:11px">${escHtml(s)}</div>`;
      return `<div class="pill${sel ? ' selected' : ''}" style="font-size:11px" onclick="toggleRacialSkill('${s}')">${escHtml(s)}</div>`;
    }).join('');
  })() : '';

  const bonusSkillNote = (bonusSkills ? ` · ${raceData.name}: +${bonusSkills.count} from any list` : '')
    + (grantedSkills.length ? ` · ${raceData.name} grants ${grantedSkills.join(', ')}` : '');

  body.innerHTML = `
    <div class="step-title">Background & Skills</div>
    <div class="step-sub">Background grants 2 skills automatically. Then choose ${max} ${clsName} skills${bonusSkillNote}.</div>
    <div class="field-label">Source</div>
    <div class="pills" style="margin-bottom:8px">
      ${allSources.map(s => `<div class="pill${filter===s?' selected':''}" style="font-size:11px" onclick="setBgFilter('${s}')">${s==='all'?'All':escHtml(s)}</div>`).join('')}
    </div>
    <div class="field-label">Background <span style="font-weight:400;color:#888">(${filteredKeys.length})</span></div>
    <div class="pills">${filteredKeys.map(k => `<div class="pill${state.background===k?' selected':''}" onclick="selectBackground('${k}')">${escHtml(state.backgroundsData[k].name)}</div>`).join('')}</div>
    ${selectedBg ? renderBgDetailCard(selectedBg, state.background) : ''}
    ${bonusSkills ? `
    <div class="field-label" style="margin-top:12px">${escHtml(raceData.name)} bonus skills (choose ${bonusSkills.count})</div>
    <div class="pills">${racialSkillPills}</div>
    <div style="font-size:10px;color:#888;margin-top:2px;margin-bottom:4px">${state.racialSkills.length}/${bonusSkills.count} chosen</div>` : ''}
    <div class="field-label" style="margin-top:12px">${clsName} skills (choose ${max})</div>
    <div class="pills">${classSkillPills}</div>
    ${_hasExpertise() ? (() => {
      const profSkills = [...new Set([...bgSkills, ...grantedSkills, ...state.racialSkills, ...state.classSkills])];
      const expertMax = 2;
      return `
      <div class="field-label" style="margin-top:12px">Expertise (choose ${expertMax})</div>
      <div class="step-sub">Double your proficiency bonus for the chosen skills.</div>
      <div class="pills">${profSkills.filter(s => ALL_SKILLS.includes(s)).map(s => {
        const sel = state.expertise.includes(s);
        const dis = !sel && state.expertise.length >= expertMax;
        return `<div class="pill${sel ? ' selected' : ''}${dis ? ' disabled' : ''}" onclick="toggleExpertise('${s}')">${escHtml(s)}</div>`;
      }).join('')}</div>
      <div style="font-size:10px;color:#888;margin-top:2px">${state.expertise.length}/${expertMax} chosen</div>`;
    })() : ''}
  `;
}

function renderBgDetailCard(bg, key) {
  const skills = bg.skill_proficiencies || [];
  const tools = bg.tool_proficiencies || [];
  const langs = bg.languages || 0;
  const features = bg.features || [];
  const sc = bg.suggested_characteristics || {};

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

  const scHtml = Object.entries(sc).map(([section, cfg]) => {
    const label = section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let html = `<div style="margin-top:8px"><b>${escHtml(label)}</b> <span style="color:#888;font-size:10px">(d${cfg.die?.replace('d','')||'6'})</span>`;
    if (cfg.entries?.length) {
      html += `<div style="margin-top:2px;font-size:10px;max-height:90px;overflow-y:auto">`;
      for (const [die, text] of cfg.entries) {
        html += `<div style="padding:1px 0"><span style="color:#888">${escHtml(die)}</span> ${escHtml(text)}</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }).join('');

  return `
    <div style="margin-top:10px;padding:10px 12px;background:var(--gray-bg);border-radius:6px;font-size:12px">
      <div style="font-weight:700;margin-bottom:4px">${escHtml(bg.name)} <span class="source-badge">${escHtml(bgSourceFor(key))}</span></div>
      ${bg.description ? `<div style="font-size:11px;color:var(--text);margin-bottom:6px">${escHtml(bg.description)}</div>` : ''}
      ${skills.length ? `<div style="margin-bottom:2px"><span style="color:#888">Skills:</span> <b>${escHtml(skills.join(', '))}</b></div>` : ''}
      ${tools.length ? `<div style="margin-bottom:2px"><span style="color:#888">Tools:</span> ${escHtml(tools.join(', '))}</div>` : ''}
      ${langs ? `<div style="margin-bottom:2px"><span style="color:#888">Languages:</span> +${langs} of choice</div>` : ''}
      ${bg.equipment ? `<div style="margin-bottom:2px"><span style="color:#888">Equipment:</span> ${escHtml(bg.equipment)}</div>` : ''}
      ${featureHtml}
      ${scHtml}
    </div>`;
}

function renderChoicePickers(allChoices) {
  if (!allChoices || !Object.keys(allChoices).length) return '';
  return Object.entries(allChoices).map(([featName, cfg]) => {
    const limit = cfg.pick_by_level
      ? (cfg.pick_by_level[String(state.level)] || cfg.pick_by_level[Object.keys(cfg.pick_by_level).sort((a,b)=>+a-+b).filter(k=>+k<=state.level).pop()] || 0)
      : (cfg.pick || 1);
    if (!limit || !cfg.options?.length) return '';
    const selected = state.choices[featName] || [];
    const label = cfg.label || featName;
    const pills = cfg.options.map(opt => {
      const sel = selected.includes(opt.name);
      const dis = !sel && selected.length >= limit;
      return `<div class="pill${sel ? ' selected' : ''}${dis ? ' disabled' : ''}" style="font-size:11px" onclick="toggleChoice(${escHtml(JSON.stringify(featName))},${escHtml(JSON.stringify(opt.name))},${limit})" title="${escHtml(opt.desc)}">${escHtml(opt.name)}</div>`;
    }).join('');
    const selDesc = selected.map(n => {
      const opt = cfg.options.find(o => o.name === n);
      return opt ? `<div style="margin-top:4px;padding:4px 8px;background:var(--gray-bg);border-radius:4px;font-size:10px"><b>${escHtml(n)}</b> — ${escHtml(opt.desc)}</div>` : '';
    }).join('');
    return `
      <div style="margin-top:14px">
        <div class="field-label">${escHtml(label)} <span style="font-weight:400;color:#888">(pick ${limit})</span></div>
        <div class="pills" style="margin-bottom:4px">${pills}</div>
        ${selDesc}
      </div>`;
  }).join('');
}

function renderStep4(body) {
  const subclasses = state.classData.subclasses;
  const isAvailable = state.level >= 3;
  const clsName = className(state.classKey);
  const clsChoices = state.classData.feature_choices || {};
  const subclassData = state.subclass ? subclasses[state.subclass] : null;
  const subChoices = subclassData?.feature_choices || {};
  const allChoices = { ...clsChoices, ...subChoices };
  body.innerHTML = `
    <div class="step-title">${clsName} ${Object.keys(subclasses).length ? 'Subclass' : 'Features'}</div>
    <div class="step-sub">${isAvailable ? 'Choose your specialization.' : 'Subclasses are available at level 3. You can pick one now for when you level up.'}</div>
    ${Object.keys(subclasses).length ? Object.entries(subclasses).map(([key, sc]) => {
      const sel = state.subclass === key;
      const featureList = Object.entries(sc.features_by_level || {}).map(([lvl, feats]) => `Level ${lvl}: ${feats.join(', ')}`).join(' · ');
      return `
        <div class="subclass-card${sel ? ' selected' : ''}" onclick="selectSubclass('${key}')">
          <div class="subclass-name">${sc.name}</div>
          <div class="subclass-desc">${sc.description}</div>
          ${featureList ? `<div class="subclass-features">${featureList}</div>` : ''}
        </div>`;
    }).join('') : '<div style="padding:12px;color:#888;font-size:12px">Subclass details will be added manually.</div>'}
    ${renderChoicePickers(allChoices)}
  `;
}

function builderCastingMod() {
  const castingAb = state.classData.spellcasting_ability || SPELLCASTING_ABILITY[state.classKey];
  const score = (state.abilityAssign[castingAb] || 10) + creationBonusFor(castingAb);
  return { castingAb, castingMod: abilityMod(score) };
}

function builderSpellLimits() {
  const { castingMod } = builderCastingMod();
  return {
    cantripsMax: cantripsKnown(state.classData, state.level),
    spellsMax: maxPreparedSpells(state.classKey, state.classData, state.level, castingMod),
  };
}

function renderStep5(body) {
  const allSpells = state.spellData || {};
  const nSpells = Object.keys(allSpells).length;
  if (!nSpells) {
    body.innerHTML = `
      <div class="step-title">Spells</div>
      <div class="step-sub">Your class does not have a spell list.</div>
      <div style="padding:24px;text-align:center;color:#888;font-size:13px">No spells available for ${className(state.classKey)}.</div>
    `;
    return;
  }
  const { cantripsMax, spellsMax } = builderSpellLimits();
  const { castingAb, castingMod } = builderCastingMod();
  const profBonus = Math.floor((state.level - 1) / 4) + 2;
  const spellDC = 8 + profBonus + castingMod;
  const spellAtk = profBonus + castingMod;

  body.innerHTML = `
    <div class="step-title">Spells</div>
    <div class="step-sub">Choose <strong>${cantripsMax} cantrips</strong> and <strong>${spellsMax} spells</strong>.</div>
    <div style="display:flex;gap:16px;padding:8px 10px;background:#f5f5f5;border-radius:4px;margin-bottom:12px;font-size:11px">
      <div><span style="font-weight:700;font-size:16px">${spellDC}</span><br><span style="color:#888;font-size:9px">SPELL DC</span></div>
      <div><span style="font-weight:700;font-size:16px">${fmtBonus(spellAtk)}</span><br><span style="color:#888;font-size:9px">SPELL ATK</span></div>
      <div><span style="font-weight:700;font-size:16px">${fmtBonus(castingMod)}</span><br><span style="color:#888;font-size:9px">${ABILITY_NAMES[castingAb]} MOD</span></div>
    </div>
    <input class="input-field" style="width:100%;margin-bottom:10px" placeholder="Search spells..." value="${escHtml(state.spellFilter)}" oninput="filterSpells(this.value)">
    <div id="spell-list-region"></div>
  `;
  renderSpellListRegion();
}

function renderSpellListRegion() {
  const region = document.getElementById('spell-list-region');
  if (!region) return;
  const allSpells = state.spellData || {};
  const { cantripsMax, spellsMax } = builderSpellLimits();
  const maxLvl = maxSpellLevel(state.classKey, state.classData, state.level);
  const filter = (state.spellFilter || '').toLowerCase();
  const allEntries = Object.entries(allSpells).filter(([, s]) =>
    s.level <= maxLvl && (!filter || s.name.toLowerCase().includes(filter))
  );

  const grouped = {};
  for (const [k, s] of allEntries) {
    const key = s.level === 0 ? 0 : s.level;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push([k, s]);
  }
  const levels = Object.keys(grouped).sort((a, b) => +a - +b);

  const cantripSel = state.cantrips.length;
  const spellSel = state.spells.length;

  function spellRow(k, s, type, max, selected) {
    const dis = !selected && (type === 'cantrip' ? cantripSel : spellSel) >= max;
    const checked = selected ? '✓' : '';
    const desc = s.description || '';
    const shortDesc = desc ? escHtml(desc.substring(0, 100)) + (desc.length > 100 ? '…' : '') : '';
    return `<div class="spell-row${selected ? ' selected' : ''}${dis ? ' disabled' : ''}" onclick="${dis ? '' : `toggleSpell('${k}','${type}')`}">
      <div class="spell-row-check">${checked}</div>
      <div class="spell-row-level">${s.level === 0 ? 'C' : 'L' + s.level}</div>
      <div class="spell-row-name">${escHtml(s.name)}</div>
      <div class="spell-row-school">${escHtml(s.school || '')}</div>
    </div>
    ${selected && shortDesc ? `<div style="font-size:10px;color:#888;padding:2px 8px 6px 42px;line-height:1.4">${shortDesc}</div>` : ''}`;
  }

  region.innerHTML = `
    <div class="spell-progress">
      <span>Cantrips: ${cantripSel}/${cantripsMax}</span>
      <span>Spells: ${spellSel}/${spellsMax}</span>
    </div>
    ${levels.map(lvl => {
      const spells = grouped[lvl];
      const label = lvl == 0 ? 'Cantrips' : ordinalLabel(lvl);
      const max = lvl == 0 ? cantripsMax : spellsMax;
      return `
      <div class="spell-group">
        <div class="spell-group-header">
          <span class="spell-group-title">${label}</span>
          <span class="spell-group-count">${spells.length}</span>
        </div>
        ${spells.map(([k, s]) => spellRow(k, s, lvl == 0 ? 'cantrip' : 'spell', max, lvl == 0 ? state.cantrips.includes(k) : state.spells.includes(k))).join('')}
      </div>`;
    }).join('')}
  `;
}

function roll4d6() {
  const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
  return rolls.sort((a, b) => a - b).slice(1).reduce((a, b) => a + b, 0);
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}
// Global handlers (called from onclick)
window.state = state;
window.prevStep = () => { state.step--; renderStep(); };
window.nextStep = () => {
  if (!validateStep()) return;
  state.step++;
  renderStep();
};
window.selectClass = async (k) => {
  state.classKey = k;
  state.subclass = '';
  state.cantrips = [];
  state.spells = [];
  state.classSkills = [];
  try {
    [state.classData, state.spellData] = await Promise.all([
      api.getClass(k), api.getSpells(k),
    ]);
  } catch (e) {
    alert('Error loading class data');
    return;
  }
  if (state.step > maxSteps()) state.step = maxSteps();
  renderStep();
};
window.selectLevel = (l) => { state.level = l; renderStep(); };
window.selectHpMethod = (m) => { state.hpMethod = m; renderStep(); };
window.selectRace = (k) => {
  state.race = k; state.flexAsiChoices = []; state.racialSkills = [];
  state.flexMode = '21'; state.flexPlus2 = null; state.flexPlus1 = null;
  state.bonusFeatKey = null; state.bonusFeatAbility = null;
  renderStep();
};
window.selectBonusFeat = (k) => {
  state.bonusFeatKey = k || null; state.bonusFeatAbility = null;
  renderStep();
};
window.setBonusFeatAbility = (ab) => { state.bonusFeatAbility = ab; renderStep(); };
window.toggleFlexAsi = (ab) => {
  const race = currentRace();
  const max = race?.flexAsi ? race.flexAsi.count : (race?.flexible_asi ? 3 : 0);
  if (!max) return;
  const i = state.flexAsiChoices.indexOf(ab);
  if (i >= 0) state.flexAsiChoices.splice(i, 1);
  else if (state.flexAsiChoices.length < max) state.flexAsiChoices.push(ab);
  renderStep();
};
window.setFlexMode = (m) => {
  state.flexMode = m; state.flexPlus2 = null; state.flexPlus1 = null; state.flexAsiChoices = [];
  renderStep();
};
window.setFlexPlus2 = (ab) => {
  state.flexPlus2 = ab;
  if (state.flexPlus1 === ab) state.flexPlus1 = null;
  renderStep();
};
window.setFlexPlus1 = (ab) => { state.flexPlus1 = ab; renderStep(); };
window.setBgFilter = (f) => { state.bgFilter = f; renderStep(); };
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
window.toggleRacialSkill = (s) => {
  const max = RACES.find(r => r.key === state.race)?.bonusSkills?.count || 0;
  const i = state.racialSkills.indexOf(s);
  if (i >= 0) state.racialSkills.splice(i, 1);
  else if (state.racialSkills.length < max) state.racialSkills.push(s);
  renderStep();
};
window.toggleExpertise = (s) => {
  const i = state.expertise.indexOf(s);
  if (i >= 0) state.expertise.splice(i, 1);
  else if (state.expertise.length < 2) state.expertise.push(s);
  renderStep();
};
window.selectSubclass = (k) => { state.subclass = k; renderStep(); };
window.toggleChoice = (featName, optName, limit) => {
  if (!state.choices[featName]) state.choices[featName] = [];
  const arr = state.choices[featName];
  const i = arr.indexOf(optName);
  if (i >= 0) arr.splice(i, 1);
  else if (arr.length < limit) arr.push(optName);
  renderStep();
};
window.setAbilityMode = (mode) => {
  state.abilityMode = mode;
  state.abilityAssign = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
  renderStep();
};
window.assignAbility = (ab, val) => { state.abilityAssign[ab] = val || null; renderStep(); };
window.rollAbility = (ab) => {
  state.abilityAssign[ab] = roll4d6();
  renderStep();
};
window.rollAll = () => {
  for (const ab of ABILITIES) state.abilityAssign[ab] = roll4d6();
  renderStep();
};
window.filterSpells = (val) => { state.spellFilter = val; renderSpellListRegion(); };
window.toggleSpell = (k, type) => {
  const { cantripsMax, spellsMax } = builderSpellLimits();
  const arr = type === 'cantrip' ? state.cantrips : state.spells;
  const max = type === 'cantrip' ? cantripsMax : spellsMax;
  const i = arr.indexOf(k);
  if (i >= 0) arr.splice(i, 1);
  else if (arr.length < max) arr.push(k);
  renderSpellListRegion();
};

window.finishBuilder = async () => {
  if (!validateStep()) return;
  const scores = {};
  for (const ab of ABILITIES) {
    scores[ab] = (state.abilityAssign[ab] || 10) + creationBonusFor(ab);
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
  const raceSkills = currentRace()?.skills || [];
  const skillProf = [...new Set([...bgSkills, ...raceSkills, ...state.racialSkills, ...state.classSkills])];

  const payload = {
    name: state.name,
    class_key: state.classKey,
    subclass_key: state.subclass || null,
    level,
    race: state.race,
    background: state.background,
    ability_scores: scores,
    skill_proficiencies: skillProf,
    expertise: state.expertise,
    spells_known: [...state.cantrips, ...state.spells],
    spell_slots: spellSlots,
    hp_max: Math.max(1, hpMax),
    hp_current: Math.max(1, hpMax),
    ac,
    momentum: 0,
    supply: 5,
    stress: 5,
    choices: state.choices,
    feats: state.bonusFeatKey ? [{
      key: state.bonusFeatKey,
      ...(state.bonusFeatAbility ? {
        ability: state.bonusFeatAbility,
        applied: currentBonusFeat().asi.points,
      } : {}),
    }] : [],
    features: [],
    weapons: [],
    inventory: [],
    coins: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    notes: [],
  };
  try {
    const res = await api.createCharacter(payload);
    log('character', `Created ${state.name} (${state.classKey} lv${state.level})`, payload);
    window.location = `/?view=sheet&id=${res.id}`;
  } catch (e) {
    log('character', `Create error for ${state.name}: ${e.message}`);
    alert('Error creating character: ' + e.message);
  }
};

function validateStep() {
  const s = state.step;
  if (s === 1) {
    if (!state.name.trim()) { alert('Enter a character name.'); return false; }
    if (!state.race) { alert('Choose a race.'); return false; }
  }
  if (s === 2) {
    if (Object.values(state.abilityAssign).some(v => v === null)) {
      alert('Assign all ability scores.'); return false;
    }
    if (state.abilityMode === 'manual') {
      for (const [ab, v] of Object.entries(state.abilityAssign)) {
        if (v < 3 || v > 20) { alert(`${ABILITY_NAMES[ab]} must be between 3 and 20.`); return false; }
      }
    }
    const race = currentRace();
    const flex = race?.flexAsi;
    if (flex && state.flexAsiChoices.length < flex.count) {
      alert(`Choose ${flex.count} abilities for your racial +${flex.points} bonus.`); return false;
    }
    if (race?.flexible_asi) {
      if (state.flexMode === '111' && state.flexAsiChoices.length < 3) {
        alert('Choose three abilities for your racial +1 bonuses.'); return false;
      }
      if (state.flexMode !== '111' && (!state.flexPlus2 || !state.flexPlus1)) {
        alert('Choose which abilities get your racial +2 and +1.'); return false;
      }
    }
    if (race?.bonusFeat) {
      if (!state.bonusFeatKey) {
        alert(`Choose a bonus feat for ${race.name}.`); return false;
      }
      if (currentBonusFeat()?.asi && !state.bonusFeatAbility) {
        alert('Choose which ability gets your feat bonus.'); return false;
      }
    }
  }
  if (s === 3) {
    if (!state.background) { alert('Choose a background.'); return false; }
    const raceBonus = currentRace()?.bonusSkills;
    if (raceBonus && state.racialSkills.length < raceBonus.count) {
      alert(`Choose ${raceBonus.count} bonus skills for ${currentRace().name}.`); return false;
    }
  }
  return true;
}
