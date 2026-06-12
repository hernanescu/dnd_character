import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const failures = [];
const dialogs = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

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

// ── Builder: variant human bonus feat ───────────────────────
await page.goto(`${BASE}/?view=new`);
await page.waitForSelector('#builder-body');
await page.fill('#name-input', 'Smoke Feats');
await page.evaluate(() => selectClass('fighter'));
await page.waitForTimeout(300);
await page.evaluate(() => selectRace('human_variant'));
await page.waitForTimeout(100);

// step 2: feat picker box renders for variant human
await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
let body = await page.evaluate(() => document.querySelector('#builder-body').innerText);
check('builder shows bonus feat box', /bonus feat/i.test(body));
const optionCount = await page.evaluate(() =>
  document.querySelector('#builder-body select[onchange*=selectBonusFeat]').options.length);
check('feat select lists all 90 feats', optionCount === 91, `options=${optionCount}`);

// validation: feat required before advancing
await page.evaluate(() => {
  toggleFlexAsi('str'); toggleFlexAsi('con');
  const vals = { str: 15, con: 14, dex: 13, wis: 12, int: 10, cha: 8 };
  for (const [ab, v] of Object.entries(vals)) assignAbility(ab, v);
});
dialogs.length = 0;
await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
check('blocked without feat', dialogs.some(d => /bonus feat/i.test(d)), dialogs.join(' | '));
check('still on step 2', await page.evaluate(() => state.step) === 2);

// half-feat needs an ability too
await page.evaluate(() => selectBonusFeat('athlete'));
await page.waitForTimeout(100);
body = await page.evaluate(() => document.querySelector('#builder-body').innerText);
check('athlete preview shows desc', /climbing/i.test(body) || /athlete/i.test(body));
const pillAbs = await page.evaluate(() =>
  [...document.querySelectorAll('#builder-body .pill[onclick*=setBonusFeatAbility]')].map(p => p.innerText.trim()));
check('athlete offers only STR/DEX pills', JSON.stringify(pillAbs.map(s => s.toUpperCase())) === '["STR","DEX"]', JSON.stringify(pillAbs));
dialogs.length = 0;
await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
check('blocked without feat ability', dialogs.some(d => /ability/i.test(d)), dialogs.join(' | '));

// switching feat resets the ability choice
await page.evaluate(() => setBonusFeatAbility('str'));
await page.evaluate(() => selectBonusFeat('alert'));
await page.waitForTimeout(100);
check('switching feat clears ability', await page.evaluate(() => state.bonusFeatAbility) === null);
const alertPills = await page.evaluate(() =>
  document.querySelectorAll('#builder-body .pill[onclick*=setBonusFeatAbility]').length);
check('non-half feat shows no ability pills', alertPills === 0);

// settle on Athlete +1 STR and verify the Final line math
await page.evaluate(() => { selectBonusFeat('athlete'); setBonusFeatAbility('str'); });
await page.waitForTimeout(100);
const finalLine = await page.evaluate(() =>
  document.querySelector('#builder-body').innerText.split('\n').find(l => l.startsWith('Final')));
check('final STR 17 (15 +1 race +1 feat)', finalLine.includes('STR 17'), finalLine);
check('final CON 15 (14 +1 race)', finalLine.includes('CON 15'), finalLine);

// step 3: background + class/racial skills, then finish
await page.evaluate(() => nextStep());
await page.waitForTimeout(100);
check('advanced to step 3', await page.evaluate(() => state.step) === 3);
await page.evaluate(() => selectBackground(Object.keys(state.backgroundsData)[0]));
await page.waitForTimeout(100);
await page.evaluate(() => {
  const bg = state.backgroundsData[state.background].skill_proficiencies;
  const pool = state.classData.skill_choices.filter(s => !bg.includes(s));
  for (let i = 0; i < state.classData.skill_count; i++) toggleClassSkill(pool[i]);
  toggleRacialSkill(['Perception', 'Stealth'].find(s => !bg.includes(s) && !state.classSkills.includes(s)));
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
check('created STR includes feat bonus', char.ability_scores.str === 17, `str=${char.ability_scores.str}`);
check('feat persisted on character',
  char.feats.length === 1 && char.feats[0].key === 'athlete'
  && char.feats[0].ability === 'str' && char.feats[0].applied === 1,
  JSON.stringify(char.feats));

// ── Sheet: feats tab ────────────────────────────────────────
const featsIdx = await page.evaluate(() =>
  [...document.querySelectorAll('.tab')].findIndex(t => /feats/i.test(t.innerText)));
await page.evaluate(i => document.querySelectorAll('.tab')[i].click(), featsIdx);
await page.waitForTimeout(300);
let sheet = await page.evaluate(() => document.body.innerText);
check('sheet shows Athlete (+1 STR)', /athlete \(\+1 str\)/i.test(sheet), sheet.match(/athlete[^\n]*/i)?.[0]);

// edit mode: picker, search filter, taken feats excluded
await page.evaluate(() => toggleEdit());
await page.waitForTimeout(200);
await page.waitForSelector('#feat-search');
let rows = await page.evaluate(() => document.querySelectorAll('#feat-results .sp-result-row').length);
check('picker capped at 40 rows', rows === 40, `rows=${rows}`);
await page.fill('#feat-search', 'athlete');
await page.waitForTimeout(100);
let resultsText = await page.evaluate(() => document.getElementById('feat-results').innerText);
check('taken feat excluded from picker', /no feats found/i.test(resultsText), resultsText);
await page.fill('#feat-search', 'grappler');
await page.waitForTimeout(100);
resultsText = await page.evaluate(() => document.getElementById('feat-results').innerText);
check('prerequisite shown in picker', /req: strength 13/i.test(resultsText), resultsText);

// add a no-ASI feat: Alert applies immediately, no chooser
await page.fill('#feat-search', 'alert');
await page.waitForTimeout(100);
await page.evaluate(() => pickFeat('alert'));
await page.waitForTimeout(500);
sheet = await page.evaluate(() => document.body.innerText);
check('Alert added without ability prompt', /alert/i.test(sheet) && !/apply \+1 to which/i.test(sheet));

// add a half-feat with 'any' choices: Resilient → CON 15 → 16
await page.waitForSelector('#feat-search');
await page.evaluate(() => pickFeat('resilient'));
await page.waitForTimeout(200);
sheet = await page.evaluate(() => document.body.innerText);
check('half-feat prompts for ability', /apply \+1 to which ability/i.test(sheet));
const chooserPills = await page.evaluate(() =>
  [...document.querySelectorAll('.pill[onclick*=chooseFeatAbility]')].length);
check("'any' feat offers all 6 abilities", chooserPills === 6, `pills=${chooserPills}`);
await page.evaluate(() => chooseFeatAbility('con'));
await page.waitForTimeout(500);
let scores = await page.evaluate(async (id) =>
  (await (await fetch(`/api/characters/${id}`)).json()).ability_scores, char.id);
check('Resilient +1 CON applied (15→16)', scores.con === 16, `con=${scores.con}`);
sheet = await page.evaluate(() => document.body.innerText);
check('sheet shows Resilient (+1 CON)', /resilient \(\+1 con\)/i.test(sheet));

// cancel path leaves nothing behind (durable is a half-feat → opens the chooser)
await page.evaluate(() => pickFeat('durable'));
await page.waitForTimeout(200);
await page.evaluate(() => cancelFeatPick());
await page.waitForTimeout(200);
const featCount = await page.evaluate(async (id) =>
  (await (await fetch(`/api/characters/${id}`)).json()).feats.length, char.id);
check('cancel adds no feat', featCount === 3, `feats=${featCount}`);

// reload: persistence of feats + scores
await page.reload();
await page.waitForTimeout(800);
await page.evaluate(i => document.querySelectorAll('.tab')[i].click(), featsIdx);
await page.waitForTimeout(300);
sheet = await page.evaluate(() => document.body.innerText);
check('feats survive reload', /athlete \(\+1 str\)/i.test(sheet) && /alert/i.test(sheet) && /resilient \(\+1 con\)/i.test(sheet));

// 20-cap: set STR to 20 via API, add Crusher → applied 0, removal keeps 20
await page.evaluate(async (id) => {
  const c = await (await fetch(`/api/characters/${id}`)).json();
  await fetch(`/api/characters/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ability_scores: { ...c.ability_scores, str: 20 } }),
  });
}, char.id);
await page.reload();
await page.waitForTimeout(800);
await page.evaluate(i => document.querySelectorAll('.tab')[i].click(), featsIdx);
await page.waitForTimeout(300);
await page.evaluate(() => toggleEdit());
await page.waitForTimeout(200);
await page.evaluate(() => pickFeat('crusher'));
await page.waitForTimeout(200);
await page.evaluate(() => chooseFeatAbility('str'));
await page.waitForTimeout(500);
let after = await page.evaluate(async (id) =>
  (await (await fetch(`/api/characters/${id}`)).json()), char.id);
check('STR capped at 20', after.ability_scores.str === 20, `str=${after.ability_scores.str}`);
const crusher = after.feats.find(f => f.key === 'crusher');
check('capped feat stores applied: 0', crusher?.applied === 0, JSON.stringify(crusher));

// remove half-feat: score rolls back exactly (Resilient CON 16→15)
const resIdx = after.feats.findIndex(f => f.key === 'resilient');
await page.evaluate(i => removeCharFeat(i), resIdx);
await page.waitForTimeout(500);
after = await page.evaluate(async (id) =>
  (await (await fetch(`/api/characters/${id}`)).json()), char.id);
check('removal restores CON (16→15)', after.ability_scores.con === 15, `con=${after.ability_scores.con}`);
check('resilient gone from feats', !after.feats.some(f => f.key === 'resilient'));
// capped feat removal: STR stays 20 (applied was 0)
const crIdx = after.feats.findIndex(f => f.key === 'crusher');
await page.evaluate(i => removeCharFeat(i), crIdx);
await page.waitForTimeout(500);
after = await page.evaluate(async (id) =>
  (await (await fetch(`/api/characters/${id}`)).json()), char.id);
check('capped removal keeps STR 20', after.ability_scores.str === 20, `str=${after.ability_scores.str}`);

// empty state on a fresh character
const fresh = await page.evaluate(async () =>
  (await (await fetch('/api/characters', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Empty Feats' }),
  })).json()));
await page.goto(`${BASE}/?view=sheet&id=${fresh.id}`);
await page.waitForTimeout(800);
const freshFeatsIdx = await page.evaluate(() =>
  [...document.querySelectorAll('.tab')].findIndex(t => /feats/i.test(t.innerText)));
await page.evaluate(i => document.querySelectorAll('.tab')[i].click(), freshFeatsIdx);
await page.waitForTimeout(300);
sheet = await page.evaluate(() => document.body.innerText);
check('empty state hint shown', /no feats yet/i.test(sheet));

// cleanup
for (const id of [char.id, fresh.id]) {
  await page.evaluate(async (i) => { await fetch(`/api/characters/${i}`, { method: 'DELETE' }); }, id);
}
console.log('JS errors:', errors.length ? errors : 'none');
console.log(failures.length ? `\n${failures.length} FAILURES` : '\nALL CHECKS PASSED');
await browser.close();
process.exit(errors.length || failures.length ? 1 : 0);
