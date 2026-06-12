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
