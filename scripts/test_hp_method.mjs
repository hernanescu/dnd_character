import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const failures = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

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

// Drives the builder to creation, returns the created character's hp_max/hp_current.
async function createFighter(name, hpMethod) {
  await page.goto(`${BASE}/?view=new`);
  await page.waitForSelector('#builder-body');
  await page.fill('#name-input', name);
  await page.evaluate(() => selectClass('fighter'));
  await page.waitForTimeout(300);
  await page.evaluate(() => selectLevel(5));
  await page.evaluate(() => selectRace('dragonborn'));
  await page.waitForTimeout(100);

  if (hpMethod !== 'average') {
    await page.evaluate((m) => selectHpMethod(m), hpMethod);
  }

  // step 2: assign abilities (CON=14 -> +2 modifier)
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

  // step 3: background + skills
  await page.evaluate(() => nextStep());
  await page.waitForTimeout(100);
  await page.evaluate(() => selectBackground(Object.keys(state.backgroundsData)[0]));
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const bg = state.backgroundsData[state.background].skill_proficiencies;
    const pool = state.classData.skill_choices.filter(s => !bg.includes(s));
    for (let i = 0; i < state.classData.skill_count; i++) toggleClassSkill(pool[i]);
  });

  // step 4 -> finish
  await page.evaluate(() => nextStep());
  await page.waitForTimeout(200);
  await page.evaluate(() => finishBuilder());
  await page.waitForURL(/view=sheet/, { timeout: 5000 });
  await page.waitForTimeout(800);

  return page.evaluate(async () => {
    const id = new URLSearchParams(location.search).get('id');
    return (await (await fetch(`/api/characters/${id}`)).json());
  });
}

// ── Step 1 pill UI defaults and selection ──────────────────────
await page.goto(`${BASE}/?view=new`);
await page.waitForSelector('#builder-body');
await page.evaluate(() => selectClass('fighter'));
await page.waitForTimeout(300);
check('default hpMethod is average', await page.evaluate(() => state.hpMethod) === 'average');
let pills = await page.evaluate(() =>
  [...document.querySelectorAll('#builder-body .pill[onclick*=selectHpMethod]')].map(p => p.innerText.trim()));
check('shows Average/Max/Random pills', JSON.stringify(pills) === JSON.stringify(['Average', 'Max', 'Random']), JSON.stringify(pills));
let selected = await page.evaluate(() =>
  document.querySelector('#builder-body .pill[onclick*=selectHpMethod].selected')?.innerText.trim());
check('Average pill selected by default', selected === 'Average', selected);

await page.evaluate(() => selectHpMethod('max'));
await page.waitForTimeout(100);
selected = await page.evaluate(() =>
  document.querySelector('#builder-body .pill[onclick*=selectHpMethod].selected')?.innerText.trim());
check('Max pill selected after click', selected === 'Max', selected);
check('state.hpMethod updated to max', await page.evaluate(() => state.hpMethod) === 'max');

// ── Average (default): 12 + (5+1+2)*4 = 44 ─────────────────────
let char = await createFighter('HP Avg', 'average');
check('average hp_max == 44', char.hp_max === 44, `hp_max=${char.hp_max}`);
check('average hp_current == hp_max', char.hp_current === char.hp_max);

// ── Max: (10+2)*5 = 60 ───────────────────────────────────────────
let charMax = await createFighter('HP Max', 'max');
check('max hp_max == 60', charMax.hp_max === 60, `hp_max=${charMax.hp_max}`);
check('max hp_current == hp_max', charMax.hp_current === charMax.hp_max);

// ── Random: between 24 and 60 inclusive ─────────────────────────
let charRand = await createFighter('HP Random', 'random');
check('random hp_max in [24,60]', charRand.hp_max >= 24 && charRand.hp_max <= 60, `hp_max=${charRand.hp_max}`);
check('random hp_current == hp_max', charRand.hp_current === charRand.hp_max);

// cleanup
for (const c of [char, charMax, charRand]) {
  await page.evaluate(async (id) => { await fetch(`/api/characters/${id}`, { method: 'DELETE' }); }, c.id);
}

console.log('JS errors:', errors.length ? errors : 'none');
console.log(failures.length ? `\n${failures.length} FAILURES` : '\nALL CHECKS PASSED');
await browser.close();
process.exit(errors.length || failures.length ? 1 : 0);
