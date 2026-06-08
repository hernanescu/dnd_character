import os
import json
import sqlite3
from flask import Flask, g, jsonify, request, render_template

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_DB = os.path.join(BASE_DIR, 'data', 'dnd.db')
_DEFAULT_DATA = os.path.join(BASE_DIR, 'data')

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, 'static'),
    template_folder=os.path.join(BASE_DIR, 'templates'),
)

_JSON_FIELDS = {
    'ability_scores', 'skill_proficiencies', 'expertise',
    'spells_known', 'spell_slots', 'features', 'weapons',
    'inventory', 'coins', 'notes',
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ''')
    db.commit()


def _row_to_character(row):
    d = dict(row)
    for field in _JSON_FIELDS:
        if d.get(field) is not None:
            d[field] = json.loads(d[field])
    return d


@app.route('/')
def index():
    return render_template('index.html')


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


@app.route('/api/backgrounds')
def get_backgrounds():
    path = os.path.join(_data_dir(), 'backgrounds.json')
    if not os.path.isfile(path):
        return jsonify({'error': 'not found'}), 404
    with open(path) as f:
        return jsonify(json.load(f))


@app.route('/api/characters', methods=['GET'])
def list_characters():
    db = get_db()
    rows = db.execute(
        'SELECT id, name, class_key, level FROM characters ORDER BY created_at DESC'
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route('/api/characters', methods=['POST'])
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
def get_character(char_id):
    db = get_db()
    row = db.execute('SELECT * FROM characters WHERE id = ?', (char_id,)).fetchone()
    if not row:
        return jsonify({'error': 'not found'}), 404
    return jsonify(_row_to_character(row))


@app.route('/api/characters/<int:char_id>', methods=['PUT'])
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


if __name__ == '__main__':
    os.makedirs(os.path.join(BASE_DIR, 'data', 'classes'), exist_ok=True)
    with app.app_context():
        init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)
