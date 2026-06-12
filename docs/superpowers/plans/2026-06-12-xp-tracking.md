# XP Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track each character's accumulated XP and show progress toward the next level as a bar in the sheet header, with a tap-to-edit popup for adding XP or setting a new total.

**Architecture:** New `xp` column on `characters` (default 0, via the existing `ALTER TABLE ADD COLUMN` migration pattern). A shared `XP_THRESHOLDS` table (5e PHB levels 1-20) in `static/js/utils.js`, used by `builder.js` to set a new character's starting XP to the minimum for its level, and by `sheet.js` to compute the progress bar's label/percentage/"ready to level up" state. The bar lives in the sheet header below the character meta line; tapping it opens a small popup with "Add XP" / "Set Total" buttons that use `prompt()`, mirroring the existing HP editor.

**Tech Stack:** Flask + SQLite (no ORM), vanilla JS ES modules, Playwright for browser smoke tests (`scripts/*.mjs`), pytest for backend tests.

---

### Task 1: Backend — `xp` column, scalar field, create-time default

**Files:**
- Modify: `src/app.py:49-53` (`_SCALAR_FIELDS`)
- Modify: `src/app.py:135-139` (migration column list)
- Modify: `src/app.py:317-331` (`create_character` values dict)
- Test: `tests/test_app.py`

- [ ] **Step 1: Write failing tests in `tests/test_app.py`**

Add at the end of the file:

```python
def test_new_character_has_zero_xp(client):
    login(client)
    cid = _mk(client)
    assert client.get(f'/api/characters/{cid}').get_json()['xp'] == 0


def test_xp_persists(client):
    login(client)
    cid = _mk(client)
    r = client.put(f'/api/characters/{cid}', json={'xp': 6500})
    assert r.status_code == 200
    assert client.get(f'/api/characters/{cid}').get_json()['xp'] == 6500
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /home/hernan/dnd_character && python3 -m pytest tests/test_app.py -k xp -v
```

Expected: both tests FAIL — `test_new_character_has_zero_xp` with `KeyError: 'xp'`, `test_xp_persists` with `400` (unknown field).

- [ ] **Step 3: Add `xp` to `_SCALAR_FIELDS`**

In `src/app.py`, find:

```python
_SCALAR_FIELDS = {
    'name', 'class_key', 'subclass_key', 'level', 'race', 'background',
    'hp_max', 'hp_current', 'ac', 'momentum', 'supply', 'stress',
    'lucky_points', 'bardic_inspiration',
}
```

Replace with:

```python
_SCALAR_FIELDS = {
    'name', 'class_key', 'subclass_key', 'level', 'race', 'background',
    'hp_max', 'hp_current', 'ac', 'momentum', 'supply', 'stress',
    'lucky_points', 'bardic_inspiration', 'xp',
}
```

- [ ] **Step 4: Add the `xp` column to the migration list**

Find:

```python
    for col in ('momentum INTEGER', 'supply INTEGER', 'stress INTEGER',
                "choices TEXT NOT NULL DEFAULT '{}'", 'armor TEXT DEFAULT NULL',
                'user_id INTEGER REFERENCES users(id)',
                'lucky_points INTEGER', 'bardic_inspiration INTEGER',
                "feats TEXT NOT NULL DEFAULT '[]'"):
```

Replace with:

```python
    for col in ('momentum INTEGER', 'supply INTEGER', 'stress INTEGER',
                "choices TEXT NOT NULL DEFAULT '{}'", 'armor TEXT DEFAULT NULL',
                'user_id INTEGER REFERENCES users(id)',
                'lucky_points INTEGER', 'bardic_inspiration INTEGER',
                "feats TEXT NOT NULL DEFAULT '[]'",
                'xp INTEGER NOT NULL DEFAULT 0'):
```

- [ ] **Step 5: Default `xp` to 0 in `create_character`**

Find:

```python
    values = {
        'name': data['name'],
        'class_key': data.get('class_key', 'bard'),
        'subclass_key': data.get('subclass_key'),
        'level': data.get('level', 1),
        'race': data.get('race'),
        'background': data.get('background'),
        'hp_max': data.get('hp_max', 8),
        'hp_current': data.get('hp_current', 8),
        'ac': data.get('ac', 10),
        'momentum': data.get('momentum', 0),
        'supply': data.get('supply', 5),
        'stress': data.get('stress', 5),
        'user_id': session['uid'],
    }
```

Replace with:

```python
    values = {
        'name': data['name'],
        'class_key': data.get('class_key', 'bard'),
        'subclass_key': data.get('subclass_key'),
        'level': data.get('level', 1),
        'race': data.get('race'),
        'background': data.get('background'),
        'hp_max': data.get('hp_max', 8),
        'hp_current': data.get('hp_current', 8),
        'ac': data.get('ac', 10),
        'momentum': data.get('momentum', 0),
        'supply': data.get('supply', 5),
        'stress': data.get('stress', 5),
        'xp': data.get('xp', 0),
        'user_id': session['uid'],
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd /home/hernan/dnd_character && python3 -m pytest tests/test_app.py -k xp -v
```

Expected: both PASS.

- [ ] **Step 7: Run the full backend suite to check for regressions**

```bash
cd /home/hernan/dnd_character && python3 -m pytest tests/ -q
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app.py tests/test_app.py
git commit -m "feat: add xp column to characters"
```

---

### Task 2: Shared XP thresholds + builder starting XP

**Files:**
- Modify: `static/js/utils.js:6` (add `XP_THRESHOLDS`)
- Modify: `static/js/builder.js:3-6` (import) and `static/js/builder.js:1066-1071` (`finishBuilder` payload)

- [ ] **Step 1: Add `XP_THRESHOLDS` to `static/js/utils.js`**

Find:

```js
export const RARITY_COLORS = { common: '#888', uncommon: '#2d7d46', rare: '#2a5a9e', 'very rare': '#8b3a9e', legendary: '#c97d2e', artifact: '#c93232' };
```

Add immediately after it:

```js
export const RARITY_COLORS = { common: '#888', uncommon: '#2d7d46', rare: '#2a5a9e', 'very rare': '#8b3a9e', legendary: '#c97d2e', artifact: '#c93232' };
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
```

(Index 0 = Level 1 threshold, index 19 = Level 20 threshold — the standard 5e PHB XP-to-level table.)

- [ ] **Step 2: Import `XP_THRESHOLDS` in `static/js/builder.js`**

Find:

```js
import {
  ABILITY_NAMES, ABILITY_FULL, SPELLCASTING_ABILITY, RARITY_COLORS,
  abilityMod, fmtBonus, escHtml, ordinalLabel, log,
} from '/static/js/utils.js';
```

Replace with:

```js
import {
  ABILITY_NAMES, ABILITY_FULL, SPELLCASTING_ABILITY, RARITY_COLORS,
  abilityMod, fmtBonus, escHtml, ordinalLabel, log, XP_THRESHOLDS,
} from '/static/js/utils.js';
```

- [ ] **Step 3: Set starting `xp` in the `finishBuilder` payload**

Find:

```js
  const payload = {
    name: state.name,
    class_key: state.classKey,
    subclass_key: state.subclass || null,
    level,
    race: state.race,
    background: state.background,
```

Replace with:

```js
  const payload = {
    name: state.name,
    class_key: state.classKey,
    subclass_key: state.subclass || null,
    level,
    xp: XP_THRESHOLDS[level - 1],
    race: state.race,
    background: state.background,
```

- [ ] **Step 4: Commit**

```bash
git add static/js/utils.js static/js/builder.js
git commit -m "feat: set starting xp from XP_THRESHOLDS in builder"
```

---

### Task 3: Sheet header — XP progress bar with tap-to-edit

**Files:**
- Modify: `static/js/sheet.js:3-6` (import), `:165-167` (state vars), `:243-265` (`render`), and near `:563-568` (`xpBarInfo` helper + global handlers)
- Modify: `static/css/app.css` (new classes near `.stat-pill`, line ~119)

- [ ] **Step 1: Import `XP_THRESHOLDS` in `static/js/sheet.js`**

Find:

```js
import {
  ABILITY_NAMES, ABILITY_FULL, SPELLCASTING_ABILITY, RARITY_COLORS,
  abilityMod, profBonus, fmtBonus, escHtml, ordinalLabel, log,
} from '/static/js/utils.js';
```

Replace with:

```js
import {
  ABILITY_NAMES, ABILITY_FULL, SPELLCASTING_ABILITY, RARITY_COLORS,
  abilityMod, profBonus, fmtBonus, escHtml, ordinalLabel, log, XP_THRESHOLDS,
} from '/static/js/utils.js';
```

- [ ] **Step 2: Add the `xpEditorOpen` state flag**

Find:

```js
let activeTab = 0;
let editMode = false;
```

Replace with:

```js
let activeTab = 0;
let editMode = false;
let xpEditorOpen = false;
```

- [ ] **Step 3: Add the `xpBarInfo` helper**

Find:

```js
function inspirationDieByLevel(level) {
  if (level >= 15) return 'd12';
  if (level >= 10) return 'd10';
  if (level >= 5) return 'd8';
  return 'd6';
}
```

Add immediately after it:

```js
function inspirationDieByLevel(level) {
  if (level >= 15) return 'd12';
  if (level >= 10) return 'd10';
  if (level >= 5) return 'd8';
  return 'd6';
}

function xpBarInfo(level, xp) {
  if (level >= 20) {
    return { label: `${xp.toLocaleString('en-US')} XP`, pct: 100, ready: false };
  }
  const cur = XP_THRESHOLDS[level - 1];
  const next = XP_THRESHOLDS[level];
  const pct = Math.min(100, Math.max(0, ((xp - cur) / (next - cur)) * 100));
  const ready = xp >= next;
  const label = `${xp.toLocaleString('en-US')} / ${next.toLocaleString('en-US')} XP${ready ? ' — Ready to level up!' : ''}`;
  return { label, pct, ready };
}
```

- [ ] **Step 4: Compute `xpInfo` and render the bar in `render()`**

Find:

```js
function render() {
  const app = document.getElementById('app');
  const tabs = getTabs();
  const clsName = char.class_key.charAt(0).toUpperCase() + char.class_key.slice(1);
  const acVal = computeAC();
  const ppVal = 10 + skillBonus('Perception', 'wis');
  const hpPct = char.hp_current / char.hp_max;
```

Replace with:

```js
function render() {
  const app = document.getElementById('app');
  const tabs = getTabs();
  const clsName = char.class_key.charAt(0).toUpperCase() + char.class_key.slice(1);
  const acVal = computeAC();
  const ppVal = 10 + skillBonus('Perception', 'wis');
  const hpPct = char.hp_current / char.hp_max;
  const xpInfo = xpBarInfo(char.level, char.xp ?? 0);
```

Then find:

```js
        <div class="char-meta">${raceData ? `${escHtml(raceData.name)} ` : ''}${clsName}${char.subclass_key ? ` · ${escHtml(char.subclass_key)}` : ''} · Level ${char.level} · ${escHtml(char.background_name)}</div>
      </div>
    </div>
    <div class="resource-bar">
```

Replace with:

```js
        <div class="char-meta">${raceData ? `${escHtml(raceData.name)} ` : ''}${clsName}${char.subclass_key ? ` · ${escHtml(char.subclass_key)}` : ''} · Level ${char.level} · ${escHtml(char.background_name)}</div>
        <div class="xp-bar-wrap" onclick="toggleXpEditor()">
          <div class="xp-bar-label">${xpInfo.label}</div>
          <div class="xp-bar"><div class="xp-bar-fill${xpInfo.ready ? ' ready' : ''}" style="width:${xpInfo.pct}%"></div></div>
          ${xpEditorOpen ? `
          <div class="xp-editor-popup" onclick="event.stopPropagation()">
            <div class="xp-editor-btn" onclick="addXp()"><span class="xp-editor-icon">+</span>Add XP</div>
            <div class="xp-editor-btn" onclick="setXpTotal()"><span class="xp-editor-icon">=</span>Set Total</div>
          </div>` : ''}
        </div>
      </div>
    </div>
    <div class="resource-bar">
```

- [ ] **Step 5: Add the `toggleXpEditor`/`addXp`/`setXpTotal` global handlers**

Find:

```js
window.openHpEditor = () => {
  const val = prompt(`Current HP (max ${char.hp_max}):`, char.hp_current);
  if (val !== null && !isNaN(+val)) {
    save({ hp_current: Math.min(char.hp_max, Math.max(0, +val)) }).then(render);
  }
};
```

Add immediately after it:

```js
window.openHpEditor = () => {
  const val = prompt(`Current HP (max ${char.hp_max}):`, char.hp_current);
  if (val !== null && !isNaN(+val)) {
    save({ hp_current: Math.min(char.hp_max, Math.max(0, +val)) }).then(render);
  }
};

window.toggleXpEditor = () => { xpEditorOpen = !xpEditorOpen; render(); };

window.addXp = () => {
  const val = prompt('Add XP:');
  xpEditorOpen = false;
  if (val !== null && !isNaN(+val) && +val !== 0) {
    const newXp = Math.max(0, (char.xp ?? 0) + Math.trunc(+val));
    save({ xp: newXp }).then(() => { render(); log('xp', `XP +${Math.trunc(+val)} → ${newXp}`); });
  } else render();
};

window.setXpTotal = () => {
  const val = prompt('Set total XP:', char.xp ?? 0);
  xpEditorOpen = false;
  if (val !== null && !isNaN(+val)) {
    const newXp = Math.max(0, Math.trunc(+val));
    save({ xp: newXp }).then(() => { render(); log('xp', `XP set → ${newXp}`); });
  } else render();
};
```

- [ ] **Step 6: Add CSS for the XP bar and popup**

In `static/css/app.css`, find:

```css
.stat-pill-val { font-size:14px;font-weight:700;opacity:1; }
.stat-pill-hp { background:rgba(0,0,0,0.18); }
```

Add immediately after it:

```css
.stat-pill-val { font-size:14px;font-weight:700;opacity:1; }
.stat-pill-hp { background:rgba(0,0,0,0.18); }

/* ── XP BAR ─────────────────────────────────────────────── */
.xp-bar-wrap { margin-top: 8px; cursor: pointer; }
.xp-bar-label { font-size: 9px; color: rgba(229,223,211,0.65); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 3px; }
.xp-bar { height: 6px; background: rgba(255,255,255,0.12); border-radius: 3px; overflow: hidden; }
.xp-bar-fill { height: 100%; background: rgba(255,255,255,0.5); border-radius: 3px; }
.xp-bar-fill.ready { background: #c9a44c; }
.xp-editor-popup { margin-top: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px; display: flex; gap: 6px; }
.xp-editor-btn { flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: inherit; border-radius: 5px; padding: 8px 6px; font-size: 11px; text-align: center; font-family: var(--font-body); cursor: pointer; }
.xp-editor-btn:hover { background: rgba(255,255,255,0.16); }
.xp-editor-icon { font-size: 14px; font-weight: 700; display: block; margin-bottom: 2px; }
```

(The header background is dark in both light and dark themes, so the `rgba(255,255,255,...)` overlays work in both without a separate dark-mode override.)

- [ ] **Step 7: Commit**

```bash
git add static/js/sheet.js static/css/app.css
git commit -m "feat: XP progress bar in sheet header with add/set editor"
```

---

### Task 4: Browser test suite

**Files:**
- Create: `scripts/test_xp.mjs`

- [ ] **Step 1: Start the dev server**

Run in the background (skip if already running on `:5000`):

```bash
cd /home/hernan/dnd_character && python3 src/app.py &
```

Wait for it to come up:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/login
```

Expected: `200`

- [ ] **Step 2: Write `scripts/test_xp.mjs`**

```js
import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const failures = [];
let nextPromptValue = null;
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', d => {
  if (d.type() === 'prompt' && nextPromptValue !== null) d.accept(nextPromptValue);
  else d.accept();
  nextPromptValue = null;
});

function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

// login
await page.goto(`${BASE}/login`);
await page.fill('#username', 'hernan');
await page.fill('#password', 'hernan@2026!');
await page.click('button[type=submit]');
await page.waitForURL(`${BASE}/`);

// ── Create a Level 5 Fighter through the builder ────────────────
await page.goto(`${BASE}/?view=new`);
await page.waitForSelector('#builder-body');
await page.fill('#name-input', 'XP Test');
await page.evaluate(() => selectClass('fighter'));
await page.waitForTimeout(300);
await page.evaluate(() => selectLevel(5));
await page.evaluate(() => selectRace('dragonborn'));
await page.waitForTimeout(100);

await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
await page.evaluate(() => {
  assignAbility('str', 15);
  assignAbility('dex', 13);
  assignAbility('con', 14);
  assignAbility('int', 12);
  assignAbility('wis', 10);
  assignAbility('cha', 8);
});

await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
await page.evaluate(() => selectBackground(Object.keys(state.backgroundsData)[0]));
await page.waitForTimeout(100);
await page.evaluate(() => {
  const bg = state.backgroundsData[state.background].skill_proficiencies;
  const pool = state.classData.skill_choices.filter(s => !bg.includes(s));
  for (let i = 0; i < state.classData.skill_count; i++) toggleClassSkill(pool[i]);
});

await page.evaluate(() => nextStep());
await page.waitForTimeout(200);
await page.evaluate(() => finishBuilder());
await page.waitForURL(/view=sheet/, { timeout: 5000 });
await page.waitForTimeout(800);

const char = await page.evaluate(async () => {
  const id = new URLSearchParams(location.search).get('id');
  return (await (await fetch(`/api/characters/${id}`)).json());
});

// ── Starting XP ────────────────────────────────────────────────
check('level 5 character starts at 6500 xp', char.xp === 6500, `xp=${char.xp}`);

// ── XP bar render ─────────────────────────────────────────────
let label = await page.evaluate(() => document.querySelector('.xp-bar-label')?.textContent.trim());
check('bar shows 6,500 / 14,000 XP', label === '6,500 / 14,000 XP', label);
let width = await page.evaluate(() => parseFloat(document.querySelector('.xp-bar-fill').style.width));
check('bar at 0%', width === 0, `width=${width}`);

// ── Tap to open editor ───────────────────────────────────────────
await page.click('.xp-bar-wrap');
let btns = await page.evaluate(() => [...document.querySelectorAll('.xp-editor-btn')].map(b => b.textContent.trim()));
check('editor shows Add XP / Set Total', btns.length === 2 && /Add XP/.test(btns[0]) && /Set Total/.test(btns[1]), JSON.stringify(btns));

// ── Add XP ─────────────────────────────────────────────────────
nextPromptValue = '1000';
await page.click('.xp-editor-btn:nth-child(1)');
await page.waitForTimeout(300);
label = await page.evaluate(() => document.querySelector('.xp-bar-label')?.textContent.trim());
check('after +1000, bar shows 7,500 / 14,000 XP', label === '7,500 / 14,000 XP', label);
width = await page.evaluate(() => parseFloat(document.querySelector('.xp-bar-fill').style.width));
check('bar near 13.3%', Math.abs(width - 1000 / 7500 * 100) < 0.01, `width=${width}`);

// ── Set Total to the next threshold -> ready state ────────────────
await page.click('.xp-bar-wrap');
nextPromptValue = '14000';
await page.click('.xp-editor-btn:nth-child(2)');
await page.waitForTimeout(300);
label = await page.evaluate(() => document.querySelector('.xp-bar-label')?.textContent.trim());
check('ready label shown', label === '14,000 / 14,000 XP — Ready to level up!', label);
const ready = await page.evaluate(() => document.querySelector('.xp-bar-fill').classList.contains('ready'));
check('bar has ready class', ready);

// ── Persistence ──────────────────────────────────────────────────
const reloaded = await page.evaluate(async (id) => (await (await fetch(`/api/characters/${id}`)).json()), char.id);
check('xp persisted as 14000', reloaded.xp === 14000, `xp=${reloaded.xp}`);

// ── Level 20: full bar, no fraction, not "ready" ──────────────────
const lvl20 = await page.evaluate(async () => {
  const r = await fetch('/api/characters', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'XP Lvl20', level: 20, xp: 355000 }),
  });
  return r.json();
});
await page.goto(`${BASE}/?view=sheet&id=${lvl20.id}`);
await page.waitForTimeout(500);
label = await page.evaluate(() => document.querySelector('.xp-bar-label')?.textContent.trim());
check('level 20 shows total XP only', label === '355,000 XP', label);
width = await page.evaluate(() => parseFloat(document.querySelector('.xp-bar-fill').style.width));
check('level 20 bar full', width === 100, `width=${width}`);
const readyLvl20 = await page.evaluate(() => document.querySelector('.xp-bar-fill').classList.contains('ready'));
check('level 20 bar not marked ready', !readyLvl20);

// cleanup
for (const c of [char, lvl20]) {
  await page.evaluate(async (id) => { await fetch(`/api/characters/${id}`, { method: 'DELETE' }); }, c.id);
}

console.log('JS errors:', errors.length ? errors : 'none');
console.log(failures.length ? `\n${failures.length} FAILURES` : '\nALL CHECKS PASSED');
await browser.close();
process.exit(errors.length || failures.length ? 1 : 0);
```

- [ ] **Step 3: Run the test**

```bash
cd /home/hernan/dnd_character && node scripts/test_xp.mjs
```

Expected: `ALL CHECKS PASSED` and `JS errors: none`.

- [ ] **Step 4: Commit**

```bash
git add scripts/test_xp.mjs
git commit -m "test: XP tracking browser suite (bar, editor, level 20)"
```

---

## Self-Review Notes

- **Spec coverage:** `xp` column + `_SCALAR_FIELDS` (Task 1) ✅, `XP_THRESHOLDS` table + builder starting XP (Task 2) ✅, progress bar with label/pct/ready computation and Level 20 special-case (Task 3, Step 3-4) ✅, tap-to-edit popup with Add/Set handlers (Task 3, Steps 4-5) ✅, CSS for bar and popup including theme considerations (Task 3, Step 6) ✅, browser test covering creation default, render, editor interactions, persistence, and Level 20 (Task 4) ✅.
- **Type consistency:** `xpBarInfo(level, xp)` returns `{label, pct, ready}`, consumed identically in `render()`. `XP_THRESHOLDS` is indexed the same way (`level - 1` for current, `level` for next) in both `builder.js` and `sheet.js`. `addXp`/`setXpTotal` both call `save({xp: ...})`, matching the `xp` field added to `_SCALAR_FIELDS` in Task 1.
- **No placeholders:** every step has complete, runnable code.
