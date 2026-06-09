/**
 * Playwright check for the Combat tab "Equipped Weapons" display:
 *  - Plain melee weapon (Warhammer, +1): STR-based, magic bonus applies to
 *    both attack and damage, no ability toggle.
 *  - Finesse weapon (Rapier): defaults to the higher of STR/DEX, shows the
 *    ability toggle, and toggling swaps STR<->DEX in both columns.
 *  - Ranged weapon (Shortbow): always DEX, no ability toggle, "ranged" shown
 *    in the type line.
 * Creates a temporary character (STR 16, DEX 18, level 3 -> prof +2) with
 * these three weapons equipped, then deletes it.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
let pass = 0;
let fail = 0;
function ok(msg) { console.log(`  ✓ ${msg}`); pass++; }
function ko(msg) { console.error(`  ✗ ${msg}`); fail++; }
function check(cond, msg) { if (cond) ok(msg); else ko(msg); }

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  await page.goto(BASE + '/login');
  await page.fill('#username', 'hernan');
  await page.fill('#password', 'hernan@2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  const charId = await page.evaluate(async () => {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Combat Display Test',
        class_key: 'fighter',
        level: 3,
        hp_max: 20,
        hp_current: 20,
        ability_scores: { str: 16, dex: 18, con: 12, int: 10, wis: 10, cha: 10 },
        inventory: [
          { slug: 'weapon-1', name: 'Warhammer, +1', base_weapon: 'warhammer', equipped: true, proficient: true },
          { slug: 'com-weapon-rapier', name: 'Rapier', base_weapon: 'rapier', equipped: true, proficient: true },
          { slug: 'com-weapon-shortbow', name: 'Shortbow', base_weapon: 'shortbow', equipped: true, proficient: true },
        ],
      }),
    });
    const data = await res.json();
    return data.id;
  });

  try {
    await page.goto(`${BASE}/?view=sheet&id=${charId}`);
    await page.waitForTimeout(500);
    const tabs = await page.$$('.tab');
    for (const tab of tabs) {
      if ((await tab.textContent()).trim() === 'Combat') { await tab.click(); break; }
    }
    await page.waitForTimeout(300);

    const rows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.weapon-row')).map(r => ({
        name: r.querySelector('.weapon-name')?.textContent.trim(),
        type: r.querySelector('.weapon-name + div')?.textContent.trim(),
        atk: r.querySelector('.weapon-atk')?.textContent.trim().replace('⇄', ''),
        dmg: r.querySelector('.weapon-dmg')?.textContent.trim(),
        breakdowns: Array.from(r.querySelectorAll('.weapon-breakdown')).map(b => b.textContent.trim()),
        hasToggle: !!r.querySelector('.ability-toggle'),
      }));
    });

    const warhammer = rows.find(r => r.name?.startsWith('Warhammer'));
    check(!!warhammer, 'Warhammer row rendered');
    check(warhammer?.atk === '+6', `Warhammer attack is +6 (STR+3, PROF+2, magic+1) [got ${warhammer?.atk}]`);
    check(warhammer?.dmg === '1d8+4', `Warhammer damage is 1d8+4, magic bonus applied [got ${warhammer?.dmg}]`);
    check(warhammer?.breakdowns[0] === 'STR+3 · PROF+2 · magic+1', `Warhammer attack breakdown [got ${warhammer?.breakdowns[0]}]`);
    check(warhammer?.breakdowns[1] === 'STR+3 · magic+1', `Warhammer damage breakdown [got ${warhammer?.breakdowns[1]}]`);
    check(warhammer?.hasToggle === false, 'Warhammer has no ability toggle');

    const rapier = rows.find(r => r.name?.startsWith('Rapier'));
    check(!!rapier, 'Rapier row rendered');
    check(rapier?.atk === '+6', `Rapier defaults to DEX: attack +6 (DEX+4, PROF+2) [got ${rapier?.atk}]`);
    check(rapier?.dmg === '1d8+4', `Rapier damage 1d8+4 (DEX+4) [got ${rapier?.dmg}]`);
    check(rapier?.breakdowns[0] === 'DEX+4 · PROF+2', `Rapier attack breakdown [got ${rapier?.breakdowns[0]}]`);
    check(rapier?.hasToggle === true, 'Rapier has ability toggle');

    // Toggle Rapier from DEX to STR (index 1 in the inventory array above)
    await page.evaluate(() => window.toggleWeaponAbility(1));
    await page.waitForTimeout(300);
    const rapierAfter = await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('.weapon-row'))
        .find(r => r.querySelector('.weapon-name')?.textContent.trim().startsWith('Rapier'));
      return {
        atk: r.querySelector('.weapon-atk')?.textContent.trim().replace('⇄', ''),
        breakdown: r.querySelector('.weapon-breakdown')?.textContent.trim(),
      };
    });
    check(rapierAfter.atk === '+5', `Rapier toggled to STR: attack +5 (STR+3, PROF+2) [got ${rapierAfter.atk}]`);
    check(rapierAfter.breakdown === 'STR+3 · PROF+2', `Rapier STR breakdown [got ${rapierAfter.breakdown}]`);

    const shortbow = rows.find(r => r.name?.startsWith('Shortbow'));
    check(!!shortbow, 'Shortbow row rendered');
    check(shortbow?.atk === '+6', `Shortbow always DEX: attack +6 (DEX+4, PROF+2) [got ${shortbow?.atk}]`);
    check(shortbow?.dmg === '1d6+4', `Shortbow damage 1d6+4 (DEX+4) [got ${shortbow?.dmg}]`);
    check(shortbow?.type?.includes('ranged'), `Shortbow type line includes "ranged" [got ${shortbow?.type}]`);
    check(shortbow?.hasToggle === false, 'Shortbow has no ability toggle');
  } finally {
    await page.evaluate(async (id) => { await fetch(`/api/characters/${id}`, { method: 'DELETE' }); }, charId);
    await browser.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
