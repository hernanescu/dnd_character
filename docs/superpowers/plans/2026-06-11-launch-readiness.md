# Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the D&D character app safe and correct for a close-friends launch: per-user accounts with character ownership, fix security holes and gameplay bugs, cache/compress data endpoints, deduplicate frontend code, and fix the wikidot scraper for the remaining data fetches.

**Architecture:** Flask + SQLite (no ORM) backend stays single-file (`src/app.py`) with a new `users` table, `user_id` FK on `characters`, and a column whitelist on updates. Frontend stays vanilla ES modules; shared helpers move to `static/js/utils.js`, spell-count rules to a pure, node-testable `static/js/spell-rules.js`. Game data JSON gets an mtime-keyed in-memory cache + optional flask-compress.

**Tech Stack:** Flask 3, sqlite3, werkzeug.security (password hashing), click (CLI), pytest (backend tests), node:test (frontend pure-logic tests), flask-compress (optional).

Findings reference: `docs/code-review-2026-06-11.md` (S1–S8, B1–B9, P1–P2, R1–R4).

---

### Task 1: Repo hygiene (S7, R4)

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Extend .gitignore**

```gitignore
__pycache__/
*.pyc
data/dnd.db
data/.secret_key
data/app.log*
data/*.jpeg
data/*.xlsx
*:Zone.Identifier
scripts/node_modules/
.superpowers/
.pytest_cache/
```

- [ ] **Step 2: Verify nothing sensitive is tracked**

Run: `git ls-files data/ | grep -E 'secret|log|jpeg|xlsx'`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add .gitignore && git commit -m "chore: gitignore secrets, logs, scratch data"
```

---

### Task 2: Backend test scaffolding + users table + hashed auth (S1)

**Files:**
- Create: `tests/test_app.py`, `tests/conftest.py`
- Modify: `src/app.py`

- [ ] **Step 1: Write conftest with isolated app fixture**

```python
# tests/conftest.py
import os, sys, tempfile
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.app import app as flask_app, init_db, create_user

@pytest.fixture
def app(tmp_path):
    db_path = tmp_path / 'test.db'
    data_dir = tmp_path / 'data'
    (data_dir / 'classes').mkdir(parents=True)
    (data_dir / 'spells.json').write_text('{"cure-wounds": {"name": "Cure Wounds", "classes": ["cleric"]}}')
    (data_dir / 'items.json').write_text('{}')
    (data_dir / 'backgrounds.json').write_text('{}')
    flask_app.config.update(DB_PATH=str(db_path), DATA_DIR=str(data_dir), TESTING=True)
    with flask_app.app_context():
        init_db()
        create_user('alice', 'pw-alice')
        create_user('bob', 'pw-bob')
    yield flask_app

@pytest.fixture
def client(app):
    return app.test_client()

def login(client, user='alice', pw='pw-alice'):
    return client.post('/api/login', json={'username': user, 'password': pw})
```

- [ ] **Step 2: Write failing auth tests**

```python
# tests/test_app.py
from tests.conftest import login

def test_login_with_db_user(client):
    r = login(client)
    assert r.status_code == 200 and r.get_json()['ok']

def test_login_bad_password(client):
    r = client.post('/api/login', json={'username': 'alice', 'password': 'nope'})
    assert r.status_code == 401

def test_characters_require_login(client):
    assert client.get('/api/characters').status_code == 401
```

- [ ] **Step 3: Run to verify failure**

Run: `python3 -m pytest tests/ -x -q`
Expected: ImportError (`create_user` not defined).

- [ ] **Step 4: Implement users table + helpers in src/app.py**

Remove `_USERS` and `_PUBLIC_ROUTES` (S6). Add:

```python
from werkzeug.security import generate_password_hash, check_password_hash

# in init_db(), before the characters table:
db.executescript('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
''')

def create_user(username, password):
    db = get_db()
    db.execute(
        'INSERT INTO users (username, password_hash) VALUES (?, ?) '
        'ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash',
        (username, generate_password_hash(password)))
    db.commit()
```

Rewrite `api_login` to check the DB and store the user id:

```python
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    db = get_db()
    row = db.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,)).fetchone()
    if row and check_password_hash(row['password_hash'], password):
        session['user'] = username
        session['uid'] = row['id']
        return jsonify({'ok': True})
    return jsonify({'ok': False, 'error': 'Invalid credentials'}), 401
```

`login_required` checks `'uid' not in session`. `api_logout` pops both keys.

- [ ] **Step 5: Add CLI commands (run `init_db` inside each)**

```python
import click

@app.cli.command('create-user')
@click.argument('username')
@click.password_option()
def create_user_cmd(username, password):
    init_db()
    create_user(username, password)
    click.echo(f'User {username!r} created/updated.')

@app.cli.command('claim-characters')
@click.argument('username')
def claim_characters_cmd(username):
    """Assign all unowned characters to USERNAME (one-time migration)."""
    init_db()
    db = get_db()
    row = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if not row:
        raise click.ClickException(f'No such user: {username}')
    cur = db.execute('UPDATE characters SET user_id = ? WHERE user_id IS NULL', (row['id'],))
    db.commit()
    click.echo(f'Claimed {cur.rowcount} characters for {username!r}.')
```

- [ ] **Step 6: Run tests** — `python3 -m pytest tests/ -x -q` → 3 passed.

- [ ] **Step 7: Commit** — `git commit -m "feat: users table with hashed passwords, create-user/claim-characters CLI"`

---

### Task 3: Character ownership (S5)

**Files:**
- Modify: `src/app.py` (schema, all `/api/characters*` handlers)
- Test: `tests/test_app.py`

- [ ] **Step 1: Write failing ownership tests**

```python
def _mk(client, name='Pip'):
    return client.post('/api/characters', json={'name': name}).get_json()['id']

def test_characters_are_per_user(client):
    login(client, 'alice', 'pw-alice')
    cid = _mk(client)
    assert [c['id'] for c in client.get('/api/characters').get_json()] == [cid]
    client.post('/api/logout')
    login(client, 'bob', 'pw-bob')
    assert client.get('/api/characters').get_json() == []
    assert client.get(f'/api/characters/{cid}').status_code == 404
    assert client.put(f'/api/characters/{cid}', json={'level': 9}).status_code == 404
    assert client.delete(f'/api/characters/{cid}').status_code == 404
```

- [ ] **Step 2: Run to verify failure** — bob sees alice's character (assert fails).

- [ ] **Step 3: Implement**

In `init_db` CREATE TABLE add `user_id INTEGER REFERENCES users(id)`; add migration `ALTER TABLE characters ADD COLUMN user_id INTEGER` in the existing try/except block. Handlers:

```python
# list
rows = db.execute('SELECT id, name, class_key, level FROM characters '
                  'WHERE user_id = ? ORDER BY created_at DESC', (session['uid'],)).fetchall()
# create: values['user_id'] = session['uid']
# get/update/delete: every SELECT/UPDATE/DELETE gets "AND user_id = ?" with session['uid']
```

- [ ] **Step 4: Run tests** — all pass.

- [ ] **Step 5: Migrate the live DB** (3 existing characters → hernan):

```bash
flask --app src/app.py create-user hernan   # prompts for password
flask --app src/app.py claim-characters hernan
```

- [ ] **Step 6: Commit** — `git commit -m "feat: per-user character ownership"`

---

### Task 4: PUT column whitelist + persist lucky_points / bardic_inspiration (S2, B2)

**Files:**
- Modify: `src/app.py`
- Test: `tests/test_app.py`

- [ ] **Step 1: Write failing tests**

```python
def test_put_rejects_unknown_columns(client):
    login(client)
    cid = _mk(client)
    r = client.put(f'/api/characters/{cid}', json={'evil; DROP TABLE characters--': 1})
    assert r.status_code == 400

def test_lucky_points_and_bardic_inspiration_persist(client):
    login(client)
    cid = _mk(client)
    r = client.put(f'/api/characters/{cid}', json={'lucky_points': 1, 'bardic_inspiration': 2})
    assert r.status_code == 200
    got = client.get(f'/api/characters/{cid}').get_json()
    assert got['lucky_points'] == 1 and got['bardic_inspiration'] == 2
```

- [ ] **Step 2: Run to verify failure** — first test 500s, second 500s (no such column).

- [ ] **Step 3: Implement**

Schema: add `lucky_points INTEGER, bardic_inspiration INTEGER` to CREATE TABLE + ALTER migrations. Whitelist:

```python
_SCALAR_FIELDS = {
    'name', 'class_key', 'subclass_key', 'level', 'race', 'background',
    'hp_max', 'hp_current', 'ac', 'momentum', 'supply', 'stress',
    'lucky_points', 'bardic_inspiration',
}

# in update_character:
updates = {}
for key, val in data.items():
    if key in _JSON_FIELDS:
        updates[key] = json.dumps(val)
    elif key in _SCALAR_FIELDS:
        updates[key] = val
    else:
        return jsonify({'error': f'unknown field: {key}'}), 400
if not updates:
    return jsonify({'error': 'no fields'}), 400
```

`create_character` values dict: also accept the two new fields via `data.get(...)`.

- [ ] **Step 4: Run tests** — pass. **Step 5: Commit** — `git commit -m "fix: whitelist update columns, persist lucky points & bardic inspiration"`

---

### Task 5: Endpoint protection, log hardening, debug default off (S3, S4, S6)

**Files:**
- Modify: `src/app.py`
- Test: `tests/test_app.py`

- [ ] **Step 1: Write failing tests**

```python
def test_data_endpoints_require_login(client):
    for path in ('/api/spells', '/api/items', '/api/backgrounds', '/api/classes/bard', '/api/log'):
        r = client.get(path) if path != '/api/log' else client.post(path, json={})
        assert r.status_code == 401, path

def test_spells_filter_by_class(client):
    login(client)
    assert 'cure-wounds' in client.get('/api/spells?class=cleric').get_json()
    assert client.get('/api/spells?class=wizard').get_json() == {}
```

- [ ] **Step 2: Verify failure** — data endpoints return 200 anonymously.

- [ ] **Step 3: Implement**

Add `@login_required` to `get_class`, `get_spells`, `get_items`, `get_backgrounds`, `api_log`. In `api_log`, rotate at 1 MB before append:

```python
if os.path.exists(log_path) and os.path.getsize(log_path) > 1_000_000:
    os.replace(log_path, log_path + '.1')
```

Flip the debug default: `debug = os.environ.get('FLASK_DEBUG', '0') == '1'`.

- [ ] **Step 4: Run tests** — pass. **Step 5: Commit** — `git commit -m "fix: auth on data/log endpoints, log rotation, debug off by default"`

---

### Task 6: JSON cache + gzip (P1, P2)

**Files:**
- Modify: `src/app.py`, `requirements.txt`
- Test: `tests/test_app.py`

- [ ] **Step 1: Write failing test (cache invalidation by mtime)**

```python
import json as _json, os, time

def test_data_cache_reloads_on_mtime_change(client, app):
    login(client)
    path = os.path.join(app.config['DATA_DIR'], 'items.json')
    assert client.get('/api/items').get_json() == {}
    with open(path, 'w') as f:
        _json.dump({'x': {'name': 'X'}}, f)
    os.utime(path, (time.time() + 2, time.time() + 2))
    assert 'x' in client.get('/api/items').get_json()
```

- [ ] **Step 2: Implement `_load_json` and use it in all four data endpoints**

```python
_json_cache = {}

def _load_json(path):
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    cached = _json_cache.get(path)
    if cached is None or cached[0] != mtime:
        with open(path) as f:
            _json_cache[path] = (mtime, json.load(f))
    return _json_cache[path][1]
```

Each endpoint: `data = _load_json(path)`; `if data is None: return ...404/empty` (preserve current per-endpoint behavior). **Do not mutate cached dicts** — filters already build new dicts.

- [ ] **Step 3: Optional gzip** — `requirements.txt` += `flask-compress>=1.14`; in app.py:

```python
try:
    from flask_compress import Compress
    Compress(app)
except ImportError:
    pass
```

Run `pip install flask-compress` (if offline, it degrades gracefully; install on Jetson at deploy).

- [ ] **Step 4: Run tests** — pass. **Step 5: Commit** — `git commit -m "perf: in-memory JSON cache + gzip responses"`

---

### Task 7: Shared frontend utils module (R1, R2, R3)

**Files:**
- Create: `static/js/utils.js`
- Modify: `static/js/sheet.js`, `static/js/builder.js`, `static/js/api.js`

- [ ] **Step 1: Create utils.js** with the duplicated members, exactly as they exist today (single source):

```js
import { themeIcon } from '/static/js/icons.js';

export const ABILITY_NAMES = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
export const ABILITY_FULL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export const SPELLCASTING_ABILITY = { artificer: 'int', bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha', ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int' };
export const RARITY_COLORS = { common: '#888', uncommon: '#2d7d46', rare: '#2a5a9e', 'very rare': '#8b3a9e', legendary: '#c97d2e', artifact: '#c93232' };

export function abilityMod(score) { return Math.floor((score - 10) / 2); }
export function profBonus(level) { return Math.floor((level - 1) / 4) + 2; }
export function fmtBonus(n) { return (n >= 0 ? '+' : '') + n; }
export function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
export function ordinalLabel(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
export function log(category, msg, data) {
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
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => { btn.innerHTML = themeIcon(next); });
};
```

- [ ] **Step 2: sheet.js** — import from utils, delete local copies of all the above (keep `bardicInspirationMax`, `inspirationDieByLevel`, `skillBonus`). Delete dead code: `wRow()` in `renderCombat`, `window.toggleSlot`.

- [ ] **Step 3: builder.js** — import from utils, delete local copies (`escHtml`, `log`, `toggleTheme`, `abilityMod`, `fmtBonus`, `ordinalLabelBuilder` → use `ordinalLabel`, `ABILITY_NAMES`, `ABILITY_FULL`, `SPELLCASTING_ABILITY`, inline `rarityColors` → `RARITY_COLORS`).

- [ ] **Step 4: api.js** — `getSpells(classKey)` omits the param when falsy; `getItems()` drops the unused params plumbing. Switch `renderSpellLibrary`/`renderItemLibrary` raw `fetch()` calls to `api.getSpells()` / `api.getItems()`.

- [ ] **Step 5: Verify** — `node --check` each modified file; `grep -n "function escHtml\|function log\|toggleTheme = \|ordinalLabelBuilder\|toggleSlot\|function wRow" static/js/sheet.js static/js/builder.js` → only utils.js defines them. Run `node scripts/test_combat_utils.mjs scripts/test_choices.mjs` → pass.

- [ ] **Step 6: Commit** — `git commit -m "refactor: shared utils.js, remove duplicated helpers and dead code"`

---

### Task 8: Sheet bug fixes (B1, B6, B7, S8)

**Files:**
- Modify: `static/js/sheet.js`, `static/js/builder.js`

- [ ] **Step 1: Passive Perception (B1)** — `render()`: `skillBonus('Perception', 'wis')`.

- [ ] **Step 2: Manual weapon damage includes magic bonus (B7)** — in the `weapons.map` row: `const dmgMod = mod + wBonus; const dmg = \`${dmgDie}${dmgMod >= 0 ? '+' : ''}${dmgMod}\`;`

- [ ] **Step 3: Apostrophe-safe handlers via data attributes (B6)**

```js
// sheet header delete button:
`<button class="icon-btn icon-btn-danger" data-name="${escHtml(char.name)}"
   onclick="event.stopPropagation();deleteCurrentChar(${char.id}, this.dataset.name)" …>✕</button>`
// weapon suggestion rows:
`<div … data-name="${escHtml(it.name)}" onclick="selectWeaponSuggestion(this.dataset.name)">…</div>`
// builder.js character list (also fixes S8 — escape the displayed name):
`<div class="char-card-name">${escHtml(c.name)}</div>` …
`<button class="char-card-delete" data-name="${escHtml(c.name)}"
   onclick="event.preventDefault();event.stopPropagation();deleteChar(${c.id}, this.dataset.name)" …>✕</button>`
```

- [ ] **Step 4: Verify** — `node --check static/js/sheet.js static/js/builder.js`; manual spot-check in app (Task 11).

- [ ] **Step 5: Commit** — `git commit -m "fix: passive perception proficiency, magic dmg bonus, quote-safe handlers, escape names"`

---

### Task 9: Builder spell rules for prepared casters (B3, B4, B5, B8)

**Files:**
- Create: `static/js/spell-rules.js`, `scripts/test_spell_rules.mjs`
- Modify: `static/js/builder.js`

- [ ] **Step 1: Write failing tests**

```js
// scripts/test_spell_rules.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { maxPreparedSpells, cantripsKnown, maxSpellLevel } from '../static/js/spell-rules.js';

const known = { spells_known_by_level: { '3': 6 }, spell_slots_by_level: { '3': { '1': 4, '2': 2 } } };
const cleric = { spells_known_by_level: {}, spell_slots_by_level: { '3': { '1': 4, '2': 2 } }, cantrips_known_by_level: { '1': 3 } };
const paladin = { spells_known_by_level: {}, spell_slots_by_level: { '3': { '1': 3 } }, cantrips_known_by_level: {} };
const warlock = { spells_known_by_level: { '3': 4 }, spell_slots_by_level: {}, cantrips_known_by_level: { '1': 2 } };

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
```

- [ ] **Step 2: Run** `node scripts/test_spell_rules.mjs` → fails (module missing).

- [ ] **Step 3: Implement static/js/spell-rules.js**

```js
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
```

- [ ] **Step 4: Run tests** → pass.

- [ ] **Step 5: Wire into builder.js renderStep5 + fix focus loss (B8)**

Replace `cantripsAtLevel(...)` / `spells_known_by_level` / `Math.ceil(state.level / 2)` with the three imports (castingMod is already computed; compute it before `allEntries`). Delete `cantripsAtLevel`. Restructure so search re-renders only the list:

```js
// shell rendered once per step entry; list region re-rendered on input:
body.innerHTML = `…stats bar…
  <input class="input-field" … value="${escHtml(state.spellFilter)}" oninput="filterSpells(this.value)">
  <div id="spell-list-region"></div>`;
renderSpellListRegion();

// progress counts + grouped list HTML move into:
function renderSpellListRegion() {
  const region = document.getElementById('spell-list-region');
  if (!region) return;
  region.innerHTML = `…spell-progress + levels.map(...)…`;
}
window.filterSpells = (val) => { state.spellFilter = val; renderSpellListRegion(); };
window.toggleSpell = (k, type) => { …existing logic…; renderSpellListRegion(); };
```

`toggleSpell` max uses `maxPreparedSpells(state.classKey, state.classData, state.level, castingModNow())` where `castingModNow()` is a small helper reading race ASI + abilityAssign (same math as renderStep5).

- [ ] **Step 6: Verify** — `node --check static/js/builder.js`; manual: builder → Cleric level 3 → step 5 shows "Choose 3 cantrips and 5 spells", typing in search keeps focus.

- [ ] **Step 7: Commit** — `git commit -m "fix: prepared-caster spell selection, data-driven cantrips/spell levels, search focus"`

---

### Task 10: Scraper fixes (B9 + warlock pact magic)

**Files:**
- Modify: `scripts/scrape_class.py`

- [ ] **Step 1: Fix `stat_idx` UnboundLocalError (B9)** — in `parse_spell`, initialize `stat_idx = None` next to `level_para = None`; guard with `if stat_idx is not None and stat_idx < len(paras):`.

- [ ] **Step 2: Parse warlock pact-magic columns in `_parse_class_table`**

Column mapping additions:

```python
elif h == 'spell slots':
    col['pact_slots'] = i
elif h == 'slot level':
    col['pact_level'] = i
```

Row parsing, after the regular `slots` block:

```python
if not slots and 'pact_slots' in col and 'pact_level' in col:
    si, li = col['pact_slots'], col['pact_level']
    if si < len(cells) and li < len(cells) and cells[si].isdigit():
        m2 = re.match(r'(\d+)', cells[li])
        if m2:
            slots = {m2.group(1): int(cells[si])}
if slots:
    cls['spell_slots_by_level'][level] = slots
```

- [ ] **Step 3: Sanity-check with a stub** — `python3 -c` snippet feeding a minimal warlock-style HTML table through `_parse_class_table` and asserting `spell_slots_by_level['3'] == {'2': 2}`.

- [ ] **Step 4 (network, best-effort): Re-scrape warlock; investigate ranger**

```bash
python3 scripts/scrape_class.py warlock
python3 scripts/scrape_class.py ranger   # then inspect subclass link patterns if still 1
```

If the network is unavailable, leave as a documented next step.

- [ ] **Step 5: Commit** — `git commit -m "fix(scraper): unbound stat_idx, warlock pact magic slots"`

---

### Task 11: End-to-end verification + docs refresh

**Files:**
- Modify: `docs/next-session.md`

- [ ] **Step 1: Full test suite** — `python3 -m pytest tests/ -q` and `node scripts/test_spell_rules.mjs scripts/test_combat_utils.mjs scripts/test_choices.mjs` → all pass.

- [ ] **Step 2: Live smoke test** — start `python3 src/app.py`; verify: login with DB user, anonymous `/api/spells` → 401, character list loads, sheet renders, lucky-points + / − persists across reload, builder creates a cleric with spells.

- [ ] **Step 3: Update docs/next-session.md** — remove resolved pending items (subclass gaps mostly fixed, spell descriptions OK, warlock if scrape succeeded); add remaining: ranger subclasses, snapshot/restore tool, friend account creation runbook (`flask --app src/app.py create-user <name>`), deploy note (install flask-compress, set FLASK_DEBUG=0 — now the default).

- [ ] **Step 4: Commit** — `git commit -m "docs: refresh next-session after launch-readiness pass"`

---

## Self-review

- Spec coverage: S1(T2) S2(T4) S3(T5) S4(T5) S5(T3) S6(T2/T5) S7(T1) S8(T8); B1(T8) B2(T4) B3-B5,B8(T9) B6-B7(T8) B9(T10); P1-P2(T6); R1-R3(T7) R4(T1); scraper/data(T10). ✓
- No placeholders; all code inline. ✓
- Type consistency: `create_user(username, password)` used in conftest matches T2; `_SCALAR_FIELDS`/`_JSON_FIELDS` naming consistent; `session['uid']` used across T2/T3. ✓
