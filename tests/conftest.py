import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.app import app as flask_app, init_db, create_user


@pytest.fixture
def app(tmp_path):
    db_path = tmp_path / 'test.db'
    data_dir = tmp_path / 'data'
    (data_dir / 'classes').mkdir(parents=True)
    (data_dir / 'classes' / 'bard.json').write_text('{"key": "bard"}')
    (data_dir / 'spells.json').write_text(
        '{"cure-wounds": {"name": "Cure Wounds", "classes": ["cleric"]}}')
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
