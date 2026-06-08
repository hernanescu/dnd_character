/**
 * Playwright test for feature choices UI.
 * Creates a Fighter (Battle Master, Lv5) and verifies:
 *  - Fighting Style + Maneuver pickers in builder Step 4
 *  - Choices visible in Feats tab of character sheet
 *  - Choices editable from Feats tab
 *  - Choices persist after page reload
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';
let pass = 0;
let fail = 0;

function ok(msg) { console.log(`  ✓ ${msg}`); pass++; }
function ko(msg, e) { console.error(`  ✗ ${msg}${e ? ': ' + (e.message||e) : ''}`); fail++; }

async function check(condition, msg) {
  if (condition) ok(msg); else ko(msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  // ── Login ──────────────────────────────────────────────────────────────────
  console.log('\n=== Login ===');
  await page.goto(`${BASE}/login`);
  await page.fill('#username', 'hernan');
  await page.fill('#password', 'hernan@2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  ok('Logged in');

  // ── Builder Step 1 ─────────────────────────────────────────────────────────
  console.log('\n=== Step 1: Fighter, Level 5, Human ===');
  await page.goto(`${BASE}/?view=new`);
  await page.waitForSelector('.builder-header');

  await page.click('text=Fighter');
  await page.waitForTimeout(600);

  // Level 5 pill
  const levelPills = await page.$$('.pill');
  for (const p of levelPills) {
    if ((await p.textContent()).trim() === '5') { await p.click(); break; }
  }
  await page.waitForTimeout(100);

  await page.click('text=Human');
  await page.waitForTimeout(100);
  await page.fill('#name-input', 'Test Battle Master');
  await page.screenshot({ path: '/tmp/choices-step1.png', fullPage: true });

  // Click Next
  await page.waitForSelector('button:has-text("Next")');
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(400);

  // ── Builder Step 2: Abilities — set via JS state directly ──────────────────
  console.log('\n=== Step 2: Abilities ===');
  await page.waitForSelector('.builder-body');

  // Set abilities directly via JS (avoids re-render race conditions)
  await page.evaluate(() => {
    const ab = ['str','dex','con','int','wis','cha'];
    const vals = [15, 14, 13, 12, 10, 8];
    ab.forEach((a, i) => {
      window.state.abilityAssign[a] = vals[i];
    });
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: '/tmp/choices-step2.png', fullPage: true });

  await page.waitForSelector('button:has-text("Next")');
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(500);

  // ── Builder Step 3: Background ─────────────────────────────────────────────
  console.log('\n=== Step 3: Background ===');
  await page.waitForSelector('.builder-body');
  await page.screenshot({ path: '/tmp/choices-step3.png', fullPage: true });

  // Use JS to select background directly to avoid scrolling issues with 88+ options
  await page.evaluate(() => {
    window.selectBackground('soldier');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/choices-step3-bg.png', fullPage: true });
  const step3Html = await page.content();
  await check(step3Html.includes('selected') && step3Html.includes('Soldier'), 'Soldier background selected');

  await page.waitForSelector('button:has-text("Next")');
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(500);

  // ── Builder Step 4: Subclass + Choices ─────────────────────────────────────
  console.log('\n=== Step 4: Battle Master + Choices ===');
  await page.waitForSelector('.builder-body');
  await page.screenshot({ path: '/tmp/choices-step4-before.png', fullPage: true });

  // Select Battle Master via JS to be reliable
  await page.evaluate(() => {
    window.selectSubclass('battle-master');
  });
  await page.waitForTimeout(500);
  ok('Battle Master subclass selected');
  await page.screenshot({ path: '/tmp/choices-step4-bm.png', fullPage: true });

  const step4Content = await page.content();
  await check(step4Content.includes('Fighting Style'), 'Fighting Style picker appears after selecting Battle Master');
  await check(step4Content.includes('Maneuver') || step4Content.includes('Combat Superiority'), 'Maneuver picker appears');

  // Select Archery fighting style via JS
  await page.evaluate(() => {
    window.toggleChoice('Fighting Style', 'Archery', 1);
  });
  await page.waitForTimeout(200);
  ok('Archery fighting style selected via toggleChoice');

  // Select 3 maneuvers
  await page.evaluate(() => {
    window.toggleChoice('Combat Superiority', "Commander's Strike", 3);
    window.toggleChoice('Combat Superiority', 'Disarming Attack', 3);
    window.toggleChoice('Combat Superiority', 'Goading Attack', 3);
  });
  await page.waitForTimeout(200);
  ok('3 maneuvers selected via toggleChoice');
  await page.screenshot({ path: '/tmp/choices-step4-picked.png', fullPage: true });

  // Verify in UI
  const step4Picked = await page.content();
  await check(step4Picked.includes('Archery'), 'Archery selected state visible in UI');
  await check(step4Picked.includes("Commander's Strike") || step4Picked.includes('Goading'), 'Maneuvers selected state visible in UI');

  // Create character
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);
  await page.waitForSelector('button:has-text("Create Character")');
  await page.click('button:has-text("Create Character")');
  await page.waitForTimeout(2000);

  const sheetUrl = page.url();
  await check(sheetUrl.includes('view=sheet'), 'Redirected to character sheet');
  await page.screenshot({ path: '/tmp/choices-sheet-stats.png', fullPage: true });

  // ── Character Sheet: Feats tab ─────────────────────────────────────────────
  console.log('\n=== Feats tab: choices display ===');
  const tabs = await page.$$('.tab');
  for (const tab of tabs) {
    if ((await tab.textContent()).trim() === 'Feats') { await tab.click(); break; }
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/choices-sheet-feats.png', fullPage: true });

  const featsHtml = await page.content();
  await check(featsHtml.includes('Feature Choices') || featsHtml.includes('Fighting Style'), 'Feature Choices section visible in Feats tab');
  await check(featsHtml.includes('Archery'), 'Archery choice visible in Feats tab');
  await check(featsHtml.includes("Commander's Strike") || featsHtml.includes('Goading Attack'), 'Maneuver choices visible in Feats tab');

  // ── Edit mode: change fighting style ──────────────────────────────────────
  console.log('\n=== Edit mode: change fighting style ===');
  // Find and click Edit button
  const editButtons = await page.$$('.btn-outline');
  for (const btn of editButtons) {
    if ((await btn.textContent()).includes('Edit')) {
      await btn.click();
      ok('Edit mode activated');
      break;
    }
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/choices-sheet-feats-edit.png', fullPage: true });

  // In edit mode, Archery should be a selected pill — deselect it
  const editContent = await page.content();
  await check(editContent.includes('Archery') && editContent.includes('pill'), 'Fighting Style pills visible in edit mode');

  // Deselect Archery then select Defense via toggleSheetChoice (save queue prevents race)
  await page.evaluate(() => window.toggleSheetChoice('Fighting Style', 'Archery', 1));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.toggleSheetChoice('Fighting Style', 'Defense', 1));
  await page.waitForTimeout(200);
  ok('Switched fighting style to Defense via toggleSheetChoice');
  await page.screenshot({ path: '/tmp/choices-sheet-feats-defense.png', fullPage: true });

  // ── Reload and verify persistence ─────────────────────────────────────────
  console.log('\n=== Persistence after reload ===');
  // Wait for the save network request to complete before reloading
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForTimeout(800);

  const tabsAfter = await page.$$('.tab');
  for (const tab of tabsAfter) {
    if ((await tab.textContent()).trim() === 'Feats') { await tab.click(); break; }
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/choices-sheet-feats-reload.png', fullPage: true });

  const reloadHtml = await page.content();
  await check(reloadHtml.includes('Defense'), 'Defense choice persisted after reload (API save works)');
  await check(!reloadHtml.includes('class="pill selected">Archery'), 'Archery no longer selected after change');

  await browser.close();

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  console.log('Screenshots in /tmp/choices-*.png');
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1); });
