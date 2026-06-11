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
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.innerHTML = themeIcon(next);
  });
};
