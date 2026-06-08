async function apiFetch(path, opts = {}) {
  const options = { headers: { 'Content-Type': 'application/json' }, ...opts };
  if (opts.body) options.body = JSON.stringify(opts.body);
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getClass: (key) => apiFetch(`/api/classes/${key}`),
  getBackgrounds: () => apiFetch('/api/backgrounds'),
  getSpells: (classKey) => apiFetch(`/api/spells?class=${classKey}`),
  getItems: (params) => {
    const p = new URLSearchParams();
    if (params?.source) p.set('source', params.source);
    if (params?.rarity) p.set('rarity', params.rarity);
    if (params?.q) p.set('q', params.q);
    const qs = p.toString();
    return apiFetch(`/api/items${qs ? '?' + qs : ''}`);
  },
  getCharacters: () => apiFetch('/api/characters'),
  getCharacter: (id) => apiFetch(`/api/characters/${id}`),
  createCharacter: (data) => apiFetch('/api/characters', { method: 'POST', body: data }),
  updateCharacter: (id, data) => apiFetch(`/api/characters/${id}`, { method: 'PUT', body: data }),
  deleteCharacter: (id) => apiFetch(`/api/characters/${id}`, { method: 'DELETE' }),
};
