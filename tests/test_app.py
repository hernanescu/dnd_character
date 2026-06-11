from tests.conftest import login


def test_login_with_db_user(client):
    r = login(client)
    assert r.status_code == 200 and r.get_json()['ok']


def test_login_bad_password(client):
    r = client.post('/api/login', json={'username': 'alice', 'password': 'nope'})
    assert r.status_code == 401


def test_characters_require_login(client):
    assert client.get('/api/characters').status_code == 401
