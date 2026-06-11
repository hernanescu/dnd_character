import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// login
await page.goto(`${BASE}/login`);
await page.fill('#username', 'hernan');
await page.fill('#password', 'hernan@2026!');
await page.click('button[type=submit]');
await page.waitForURL(`${BASE}/`);

// open builder
await page.goto(`${BASE}/?view=new`);
await page.waitForSelector('#builder-body');
await page.fill('#name-input', 'Smoke Goliath');

// race pills grouped: check counts
const pillCount = await page.evaluate(() => window.state && document.querySelectorAll('.pill').length);
const raceCount = await page.evaluate(() => window.state ? undefined : null);
console.log('total pills on step1:', pillCount);

// pick barbarian + goliath (exotic, MPMM flexible ASI)
await page.evaluate(() => selectClass('barbarian'));
await page.waitForTimeout(300);
await page.evaluate(() => selectRace('goliath'));
await page.waitForTimeout(100);
const detail = await page.evaluate(() => document.querySelector('#builder-body').innerText);
if (!detail.includes('Stone') && !detail.includes('Athletics')) console.log('WARN: goliath card missing traits:', detail.slice(0, 400));
console.log('goliath card shows grant:', detail.includes('Grants proficiency: Athletics'));

// step 2: flexible ASI, +2 STR +1 CON
await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
await page.evaluate(() => setFlexPlus2('str'));
await page.evaluate(() => setFlexPlus1('con'));
// assign standard array
await page.evaluate(() => {
  const vals = { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 };
  for (const [ab, v] of Object.entries(vals)) assignAbility(ab, v);
});
await page.waitForTimeout(100);
const finalLine = await page.evaluate(() => document.querySelector('#builder-body').innerText.split('\n').find(l => l.startsWith('Final')));
console.log('final scores line:', finalLine);
if (!finalLine.includes('STR 17') || !finalLine.includes('CON 15')) { console.log('FAIL: flexible ASI not applied'); process.exit(1); }

// step 3: background + skills (goliath grants Athletics → should not be selectable twice)
await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
await page.evaluate(() => selectBackground(Object.keys(state.backgroundsData)[0]));
await page.waitForTimeout(100);
const step3text = await page.evaluate(() => document.querySelector('#builder-body').innerText);
console.log('step3 mentions grant:', step3text.includes('grants Athletics'));
// choose class skills (2 for barbarian)
await page.evaluate(() => {
  const need = state.classData.skill_count;
  const bg = state.backgroundsData[state.background].skill_proficiencies;
  const pool = state.classData.skill_choices.filter(s => !bg.includes(s) && s !== 'Athletics');
  for (let i = 0; i < need; i++) toggleClassSkill(pool[i]);
});
// step 4 (subclass) then finish
await page.evaluate(() => nextStep());
await page.waitForTimeout(200);
page.on('dialog', d => { console.log('DIALOG:', d.message()); d.accept(); });
await page.evaluate(() => finishBuilder());
await page.waitForURL(/view=sheet/, { timeout: 5000 });
await page.waitForTimeout(800);

// sheet checks
const sheetText = await page.evaluate(() => document.body.innerText);
console.log('sheet shows race in header:', /goliath barbarian/i.test(sheetText));
const charJson = await page.evaluate(async () => {
  const id = new URLSearchParams(location.search).get('id');
  return (await (await fetch(`/api/characters/${id}`)).json());
});
console.log('stored scores:', JSON.stringify(charJson.ability_scores), 'skills:', JSON.stringify(charJson.skill_proficiencies));
// feats tab racial traits
const tabs = await page.evaluate(() => [...document.querySelectorAll('.tab')].map(t => t.innerText));
const featsIdx = tabs.findIndex(t => /Feats/i.test(t));
await page.evaluate(i => document.querySelectorAll('.tab')[i].click(), featsIdx);
await page.waitForTimeout(300);
const featsText = await page.evaluate(() => document.body.innerText);
console.log('feats tab has Goliath Traits:', /goliath traits/i.test(featsText), '| Stone\'s Endurance:', featsText.includes("Stone's Endurance"));

// cleanup: delete the smoke character
await page.evaluate(async (id) => { await fetch(`/api/characters/${id}`, { method: 'DELETE' }); }, charJson.id);
console.log('JS errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
