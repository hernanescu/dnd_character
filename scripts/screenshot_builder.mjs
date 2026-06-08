import { chromium } from 'playwright';

const BASE = 'http://localhost:5000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('#username', 'hernan');
  await page.fill('#password', 'hernan@2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  // Create new character
  await page.goto(`${BASE}/?view=new`);
  await page.waitForSelector('.builder-header');

  // Step 1: Select Wizard class
  await page.click('text=Wizard');
  await page.waitForTimeout(300);

  // Select level 5
  await page.click('text=5');
  await page.waitForTimeout(100);

  // Select Human race
  await page.click('text=Human');
  await page.waitForTimeout(100);

  // Fill name
  await page.fill('#name-input', 'Test Wizard');

  // Click Next
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(300);

  // Step 2: assign abilities
  await page.waitForSelector('.builder-body');
  const values = ['15', '14', '13', '12', '10', '8'];
  const selects = await page.$$('select');
  for (let i = 0; i < selects.length && i < values.length; i++) {
    // Each select needs to be re-queried after re-renders
    try {
      await selects[i].selectOption(values[i]);
    } catch (e) {
      // Re-query
      const freshSelects = await page.$$('select');
      if (freshSelects[i]) await freshSelects[i].selectOption(values[i]);
    }
  }
  await page.waitForTimeout(100);
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(200);

  // Step 3: pick background
  await page.waitForSelector('.builder-body');
  await page.click('text=Sage');
  await page.waitForTimeout(100);
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(200);

  // Step 4: subclass (click the first one if available)
  await page.waitForSelector('.builder-body');
  const subBtn = await page.$('.subclass-card');
  if (subBtn) await subBtn.click();
  await page.waitForTimeout(100);
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(300);

  // Step 5: spell selection - take screenshot!
  await page.waitForSelector('.builder-body');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/builder-spells.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/builder-spells.png');

  // Create character
  // Select a few cantrips first
  const pillCantrips = await page.$$('.pills:first-of-type .pill:not(.disabled)');
  for (let i = 0; i < Math.min(3, pillCantrips.length); i++) {
    try { await pillCantrips[i].click(); } catch {}
  }
  // Select a few spells
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const pillSpells = await page.$$('.pills:last-of-type .pill:not(.disabled)');
  for (let i = 0; i < Math.min(3, pillSpells.length); i++) {
    try { await pillSpells[i].click(); } catch {}
  }
  await page.click('button:has-text("Create Character")');
  await page.waitForTimeout(1000);

  // Sheet screenshots
  await page.screenshot({ path: '/tmp/sheet-stats.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/sheet-stats.png');

  // Feats tab
  const tabs = await page.$$('.tab');
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text.trim() === 'Feats') { await tab.click(); break; }
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/sheet-feats.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/sheet-feats.png');

  // Spells tab
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text.trim() === 'Spells') { await tab.click(); break; }
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/sheet-spells.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/sheet-spells.png');

  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
