async function apiFetch(path, opts = {}) {
  const options = { headers: { 'Content-Type': 'application/json' }, ...opts };
  if (opts.body) options.body = JSON.stringify(opts.body);
  const res = await fetch(path, options);
  if (res.status === 401) {
    window.location = '/login';
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getClass: (key) => apiFetch(`/api/classes/${key}`),
  getBackgrounds: () => apiFetch('/api/backgrounds'),
  getRaces: () => apiFetch('/api/races'),
  getFeats: () => apiFetch('/api/feats'),
  getSpells: (classKey) => apiFetch(classKey ? `/api/spells?class=${classKey}` : '/api/spells'),
  getItems: () => apiFetch('/api/items'),
  getCharacters: () => apiFetch('/api/characters'),
  getCharacter: (id) => apiFetch(`/api/characters/${id}`),
  createCharacter: (data) => apiFetch('/api/characters', { method: 'POST', body: data }),
  updateCharacter: (id, data) => apiFetch(`/api/characters/${id}`, { method: 'PUT', body: data }),
  deleteCharacter: (id) => apiFetch(`/api/characters/${id}`, { method: 'DELETE' }),
};
