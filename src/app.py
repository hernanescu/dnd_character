import os
import json
import sqlite3
import secrets
from functools import wraps

import click
from flask import Flask, g, jsonify, request, render_template, session, redirect
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_DB = os.path.join(BASE_DIR, 'data', 'dnd.db')
_DEFAULT_DATA = os.path.join(BASE_DIR, 'data')

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, 'static'),
    template_folder=os.path.join(BASE_DIR, 'templates'),
)
_KEY_FILE = os.path.join(BASE_DIR, 'data', '.secret_key')
try:
    app.secret_key = open(_KEY_FILE).read().strip()
except FileNotFoundError:
    _k = secrets.token_hex(32)
    os.makedirs(os.path.dirname(_KEY_FILE), exist_ok=True)
    open(_KEY_FILE, 'w').write(_k)
    app.secret_key = _k

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'uid' not in session:
            return jsonify({'error': 'unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

_JSON_FIELDS = {
    'ability_scores', 'skill_proficiencies', 'expertise',
    'spells_known', 'spell_slots', 'features', 'weapons',
    'inventory', 'coins', 'notes', 'choices', 'armor',
}


def _db_path():
    return app.config.get('DB_PATH', _DEFAULT_DB)


def _data_dir():
    return app.config.get('DATA_DIR', _DEFAULT_DATA)


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(_db_path())
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(e=None):
    db = g.pop('db', None)
    if db:
        db.close()


def init_db():
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            class_key TEXT NOT NULL DEFAULT 'bard',
            subclass_key TEXT,
            level INTEGER NOT NULL DEFAULT 1,
            race TEXT,
            background TEXT,
            ability_scores TEXT NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
            skill_proficiencies TEXT NOT NULL DEFAULT '[]',
            expertise TEXT NOT NULL DEFAULT '[]',
            spells_known TEXT NOT NULL DEFAULT '[]',
            spell_slots TEXT NOT NULL DEFAULT '{}',
            hp_max INTEGER NOT NULL DEFAULT 8,
            hp_current INTEGER NOT NULL DEFAULT 8,
            ac INTEGER NOT NULL DEFAULT 10,
            features TEXT NOT NULL DEFAULT '[]',
            weapons TEXT NOT NULL DEFAULT '[]',
            inventory TEXT NOT NULL DEFAULT '[]',
            coins TEXT NOT NULL DEFAULT '{"pp":0,"gp":0,"ep":0,"sp":0,"cp":0}',
            notes TEXT NOT NULL DEFAULT '[]',
            momentum INTEGER NOT NULL DEFAULT 0,
            supply INTEGER NOT NULL DEFAULT 5,
            stress INTEGER NOT NULL DEFAULT 5,
            choices TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    db.commit()
    for col in ('momentum', 'supply', 'stress'):
        try:
            db.execute(f'ALTER TABLE characters ADD COLUMN {col} INTEGER')
        except Exception:
            pass
    try:
        db.execute("ALTER TABLE characters ADD COLUMN choices TEXT NOT NULL DEFAULT '{}'")
    except Exception:
        pass
    try:
        db.execute("ALTER TABLE characters ADD COLUMN armor TEXT DEFAULT NULL")
    except Exception:
        pass
    db.commit()


def _row_to_character(row):
    d = dict(row)
    for field in _JSON_FIELDS:
        if d.get(field) is not None:
            d[field] = json.loads(d[field])
    return d


@app.route('/')
def index():
    if 'user' not in session:
        return redirect('/login')
    return render_template('index.html')


@app.route('/login')
def login_page():
    return render_template('login.html')


def create_user(username, password):
    db = get_db()
    db.execute(
        'INSERT INTO users (username, password_hash) VALUES (?, ?) '
        'ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash',
        (username, generate_password_hash(password)))
    db.commit()


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


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    db = get_db()
    row = db.execute('SELECT id, password_hash FROM users WHERE username = ?',
                     (username,)).fetchone()
    if row and check_password_hash(row['password_hash'], password):
        session['user'] = username
        session['uid'] = row['id']
        return jsonify({'ok': True})
    return jsonify({'ok': False, 'error': 'Invalid credentials'}), 401


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.pop('user', None)
    session.pop('uid', None)
    return jsonify({'ok': True})


@app.route('/api/me')
def api_me():
    if 'user' not in session:
        return jsonify({'authenticated': False}), 401
    return jsonify({'authenticated': True, 'user': session['user']})


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/api/classes/<key>')
def get_class(key):
    path = os.path.join(_data_dir(), 'classes', f'{key}.json')
    if not os.path.isfile(path):
        return jsonify({'error': 'not found'}), 404
    with open(path) as f:
        return jsonify(json.load(f))


@app.route('/api/spells')
def get_spells():
    class_filter = request.args.get('class', '').strip().lower()
    path = os.path.join(_data_dir(), 'spells.json')
    if not os.path.isfile(path):
        return jsonify({}), 200
    with open(path) as f:
        spells = json.load(f)
    if class_filter:
        spells = {k: v for k, v in spells.items() if class_filter in v.get('classes', [])}
    return jsonify(spells)


@app.route('/api/items')
def get_items():
    source = request.args.get('source', '').strip().lower()
    rarity = request.args.get('rarity', '').strip().lower()
    q = request.args.get('q', '').strip().lower()
    path = os.path.join(_data_dir(), 'items.json')
    if not os.path.isfile(path):
        return jsonify({}), 200
    with open(path) as f:
        items = json.load(f)
    if source:
        items = {k: v for k, v in items.items() if v.get('source', '').lower() == source}
    if rarity:
        items = {k: v for k, v in items.items() if v.get('rarity', '').lower() == rarity}
    if q:
        items = {k: v for k, v in items.items() if q in v.get('name', '').lower() or q in (v.get('note', '') or '').lower()}
    return jsonify(items)


@app.route('/api/backgrounds')
def get_backgrounds():
    path = os.path.join(_data_dir(), 'backgrounds.json')
    if not os.path.isfile(path):
        return jsonify({'error': 'not found'}), 404
    with open(path) as f:
        return jsonify(json.load(f))


@app.route('/api/characters', methods=['GET'])
@login_required
def list_characters():
    db = get_db()
    rows = db.execute(
        'SELECT id, name, class_key, level FROM characters ORDER BY created_at DESC'
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/characters', methods=['POST'])
@login_required
def create_character():
    data = request.get_json()
    db = get_db()
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
    }
    for f in _JSON_FIELDS:
        val = data.get(f)
        values[f] = json.dumps(val) if val is not None else None
    cols = ', '.join(k for k, v in values.items() if v is not None)
    vals = [v for v in values.values() if v is not None]
    placeholders = ', '.join('?' for _ in vals)
    cur = db.execute(f'INSERT INTO characters ({cols}) VALUES ({placeholders})', vals)
    db.commit()
    return jsonify({'id': cur.lastrowid}), 201


@app.route('/api/characters/<int:char_id>', methods=['GET'])
@login_required
def get_character(char_id):
    db = get_db()
    row = db.execute('SELECT * FROM characters WHERE id = ?', (char_id,)).fetchone()
    if not row:
        return jsonify({'error': 'not found'}), 404
    return jsonify(_row_to_character(row))


@app.route('/api/characters/<int:char_id>', methods=['PUT'])
@login_required
def update_character(char_id):
    data = request.get_json()
    db = get_db()
    if not db.execute('SELECT id FROM characters WHERE id = ?', (char_id,)).fetchone():
        return jsonify({'error': 'not found'}), 404
    updates = {}
    for key, val in data.items():
        updates[key] = json.dumps(val) if key in _JSON_FIELDS else val
    set_clause = ', '.join(f'{k} = ?' for k in updates)
    db.execute(f'UPDATE characters SET {set_clause} WHERE id = ?',
               list(updates.values()) + [char_id])
    db.commit()
    row = db.execute('SELECT * FROM characters WHERE id = ?', (char_id,)).fetchone()
    return jsonify(_row_to_character(row))


@app.route('/api/characters/<int:char_id>', methods=['DELETE'])
@login_required
def delete_character(char_id):
    db = get_db()
    row = db.execute('SELECT id FROM characters WHERE id = ?', (char_id,)).fetchone()
    if not row:
        return jsonify({'error': 'not found'}), 404
    db.execute('DELETE FROM characters WHERE id = ?', (char_id,))
    db.commit()
    return jsonify({'ok': True})


@app.route('/api/log', methods=['POST'])
def api_log():
    data = request.get_json(silent=True) or {}
    log_path = os.path.join(BASE_DIR, 'data', 'app.log')
    try:
        ts = data.get('t', '')
        cat = data.get('c', '?')
        msg = data.get('m', '')
        extra = json.dumps(data.get('d')) if data.get('d') else ''
        line = f'[{ts}] [{cat}] {msg} {extra}\n'.strip() + '\n'
        with open(log_path, 'a') as f:
            f.write(line)
    except Exception:
        pass
    return '', 204


if __name__ == '__main__':
    os.makedirs(os.path.join(BASE_DIR, 'data', 'classes'), exist_ok=True)
    with app.app_context():
        init_db()
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '1') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug)
