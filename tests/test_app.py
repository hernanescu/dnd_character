from tests.conftest import login


def test_login_with_db_user(client):
    r = login(client)
    assert r.status_code == 200 and r.get_json()['ok']


def test_login_bad_password(client):
    r = client.post('/api/login', json={'username': 'alice', 'password': 'nope'})
    assert r.status_code == 401


def test_characters_require_login(client):
    assert client.get('/api/characters').status_code == 401


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
