# Character Sheet Typography Scale-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase font sizes for "content" text on the character sheet (descriptions, names, stat values, small annotations) and lighten dark-mode `--text-dim`, per `docs/superpowers/specs/2026-06-10-typography-scale-up-design.md`.

**Architecture:** Pure CSS value changes in `static/css/app.css` (font-size, line-height, one color token), plus three matching inline-style edits in `static/js/sheet.js`. No structural/markup changes. Verified visually with a Playwright screenshot pass across tabs in light and dark mode.

**Tech Stack:** Flask + vanilla JS/CSS frontend, Playwright (already in `scripts/node_modules`) for visual verification.

---

### Task 1: Color token + Stats/Combat tab text sizes

**Files:**
- Modify: `static/css/app.css`

- [ ] **Step 1: Lighten dark-mode `--text-dim`**

In the `[data-theme="dark"]` block (around line 62), change:

```css
[data-theme="dark"] {
  --bg:            #1c1a17;
  --surface:       #252220;
  --surface2:      #2e2b27;
  --border:        #3a3830;
  --border-subtle: #2e2b27;
  --text:          #e0dbd4;
  --text-dim:      #6a6460;
  --text-faint:    #4a4840;
}
```

to:

```css
[data-theme="dark"] {
  --bg:            #1c1a17;
  --surface:       #252220;
  --surface2:      #2e2b27;
  --border:        #3a3830;
  --border-subtle: #2e2b27;
  --text:          #e0dbd4;
  --text-dim:      #8a847e;
  --text-faint:    #4a4840;
}
```

- [ ] **Step 2: Bump `.section-title` font-size**

Change:

```css
.section-title {
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  margin-bottom: 10px;
  margin-top: 16px;
}
```

to:

```css
.section-title {
  font-family: var(--font-display);
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  margin-bottom: 10px;
  margin-top: 16px;
}
```

- [ ] **Step 3: Bump `.ability-mod`**

Change:

```css
.ability-mod { font-size: 12px; color: var(--text-dim); }
```

to:

```css
.ability-mod { font-size: 14px; color: var(--text-dim); }
```

- [ ] **Step 4: Bump `.skill-row`, `.skill-ability`, `.skill-bonus`**

Change:

```css
.skill-row {
  display: flex;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  gap: 8px;
}
```

to:

```css
.skill-row {
  display: flex;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 14px;
  gap: 8px;
}
```

Then change:

```css
.skill-ability { font-size: 9px; color: var(--text-dim); text-transform: uppercase; }
.skill-bonus { font-size: 12px; font-weight: 700; min-width: 24px; text-align: right; }
```

to:

```css
.skill-ability { font-size: 11px; color: var(--text-dim); text-transform: uppercase; }
.skill-bonus { font-size: 14px; font-weight: 700; min-width: 24px; text-align: right; }
```

- [ ] **Step 5: Bump `.save-row` and `.save-bonus`**

Change:

```css
.save-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--border-subtle);
}
```

to:

```css
.save-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0;
  font-size: 14px;
  border-bottom: 1px solid var(--border-subtle);
}
```

Then change:

```css
.save-bonus { font-size: 12px; font-weight: 700; min-width: 24px; text-align: right; }
```

to:

```css
.save-bonus { font-size: 14px; font-weight: 700; min-width: 24px; text-align: right; }
```

(This is the top-level `.save-bonus`, not `.save-box .save-bonus` — leave the `.save-box .save-bonus { font-size: 16px; ... }` rule unchanged.)

- [ ] **Step 6: Bump `.prof-info`**

Change:

```css
.prof-info {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; background: var(--surface2);
  border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 12px;
}
```

to:

```css
.prof-info {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; background: var(--surface2);
  border-radius: var(--radius-sm); margin-bottom: 12px; font-size: 14px;
}
```

- [ ] **Step 7: Commit**

```bash
git add static/css/app.css
git commit -m "style: enlarge stats/combat tab text and lighten dark-mode dim color"
```

---

### Task 2: Spells tab text sizes

**Files:**
- Modify: `static/css/app.css`

- [ ] **Step 1: Bump `.spell-name` and `.spell-school`**

Change:

```css
.spell-name { font-size: 13px; font-weight: 700; flex: 1; }
.spell-school { font-size: 10px; color: var(--text-dim); }
```

to:

```css
.spell-name { font-size: 15px; font-weight: 700; flex: 1; }
.spell-school { font-size: 12px; color: var(--text-dim); }
```

- [ ] **Step 2: Bump `.spell-desc`**

Change:

```css
.spell-desc { font-size: 11px; color: var(--text-dim); margin-top: 6px; line-height: 1.5; display: none; }
```

to:

```css
.spell-desc { font-size: 15px; color: var(--text-dim); margin-top: 6px; line-height: 1.6; display: none; }
```

- [ ] **Step 3: Bump `.spell-meta` and `.spell-higher`**

Change:

```css
.spell-meta { font-size: 10px; color: var(--text-dim); margin-top: 6px; gap: 4px 12px; flex-wrap: wrap; display: none; line-height: 1.6; }
.spell-tag { display: inline-block; font-size: 8px; background: var(--text-dim); color: var(--surface); padding: 1px 4px; border-radius: 3px; vertical-align: middle; margin-left: 2px; }
.spell-higher { font-size: 11px; color: var(--text-dim); margin-top: 6px; line-height: 1.5; display: none; font-style: italic; }
```

to:

```css
.spell-meta { font-size: 12px; color: var(--text-dim); margin-top: 6px; gap: 4px 12px; flex-wrap: wrap; display: none; line-height: 1.6; }
.spell-tag { display: inline-block; font-size: 8px; background: var(--text-dim); color: var(--surface); padding: 1px 4px; border-radius: 3px; vertical-align: middle; margin-left: 2px; }
.spell-higher { font-size: 15px; color: var(--text-dim); margin-top: 6px; line-height: 1.6; display: none; font-style: italic; }
```

(`.spell-tag` is an intentionally tiny badge — left unchanged.)

- [ ] **Step 4: Bump `.spell-level-title` and `.spell-level-count`**

Change:

```css
.spell-level-arrow { font-size: 12px; color: var(--text-dim); width: 14px; }
.spell-level-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; flex: 1; }
.spell-level-count {
  font-size: 10px; color: var(--text-dim); background: var(--surface);
  padding: 1px 7px; border-radius: 10px;
}
```

to:

```css
.spell-level-arrow { font-size: 12px; color: var(--text-dim); width: 14px; }
.spell-level-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; flex: 1; }
.spell-level-count {
  font-size: 11px; color: var(--text-dim); background: var(--surface);
  padding: 1px 7px; border-radius: 10px;
}
```

- [ ] **Step 5: Bump `.spell-progress`**

Change:

```css
.spell-progress {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 10px;
}
```

to:

```css
.spell-progress {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: var(--text-dim);
  margin-bottom: 10px;
}
```

- [ ] **Step 6: Bump `.spell-row-level`, `.spell-row-name`, `.spell-row-school`**

Change:

```css
.spell-row-level {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-dim);
  width: 20px;
  flex-shrink: 0;
  text-align: center;
}
.spell-row-name {
  flex: 1;
  font-size: 14px;
}
.spell-row-school {
  font-size: 10px;
  color: var(--text-faint);
  flex-shrink: 0;
}
```

to:

```css
.spell-row-level {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
  width: 20px;
  flex-shrink: 0;
  text-align: center;
}
.spell-row-name {
  flex: 1;
  font-size: 15px;
}
.spell-row-school {
  font-size: 12px;
  color: var(--text-faint);
  flex-shrink: 0;
}
```

- [ ] **Step 7: Commit**

```bash
git add static/css/app.css
git commit -m "style: enlarge spells tab text"
```

---

### Task 3: Inventory, Feats, and Notes text sizes

**Files:**
- Modify: `static/css/app.css`

- [ ] **Step 1: Bump weapon row text**

Change:

```css
.weapon-name { flex: 1; font-size: 13px; font-weight: 700; }
.weapon-atk { font-size: 12px; color: var(--text-dim); }
.weapon-dmg { font-size: 12px; font-weight: 700; }
.weapon-col { display: flex; flex-direction: column; align-items: center; min-width: 46px; }
.weapon-breakdown { font-size: 9px; color: var(--text-dim); white-space: nowrap; }
```

to:

```css
.weapon-name { flex: 1; font-size: 15px; font-weight: 700; }
.weapon-atk { font-size: 14px; color: var(--text-dim); }
.weapon-dmg { font-size: 14px; font-weight: 700; }
.weapon-col { display: flex; flex-direction: column; align-items: center; min-width: 46px; }
.weapon-breakdown { font-size: 11px; color: var(--text-dim); white-space: nowrap; }
```

- [ ] **Step 2: Bump `.item-name`, `.item-qty`, `.eq-btn`**

Change:

```css
.item-name { flex: 1; font-size: 14px; }
.item-qty { font-size: 12px; color: var(--text-dim); }
```

to:

```css
.item-name { flex: 1; font-size: 15px; }
.item-qty { font-size: 14px; color: var(--text-dim); }
```

Then change:

```css
.eq-btn {
  display: inline-block;
  font-size: 10px; padding: 3px 10px; border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer; user-select: none; color: var(--text-dim);
  transition: all .1s;
}
```

to:

```css
.eq-btn {
  display: inline-block;
  font-size: 11px; padding: 3px 10px; border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer; user-select: none; color: var(--text-dim);
  transition: all .1s;
}
```

- [ ] **Step 3: Bump `.feat-name`, `.feat-level`, `.feat-desc`**

Change:

```css
.feat-card .feat-arrow { font-size: 10px; color: var(--text-dim); transition: transform .15s; }
.feat-card.expanded .feat-arrow { transform: rotate(90deg); }
.feat-name { font-size: 13px; font-weight: 700; flex: 1; }
.feat-level { font-size: 10px; color: var(--text-dim); margin-bottom: 2px; }
.feat-desc { font-size: 11px; color: var(--text-dim); margin-top: 6px; line-height: 1.5; display: none; }
```

to:

```css
.feat-card .feat-arrow { font-size: 10px; color: var(--text-dim); transition: transform .15s; }
.feat-card.expanded .feat-arrow { transform: rotate(90deg); }
.feat-name { font-size: 15px; font-weight: 700; flex: 1; }
.feat-level { font-size: 12px; color: var(--text-dim); margin-bottom: 2px; }
.feat-desc { font-size: 15px; color: var(--text-dim); margin-top: 6px; line-height: 1.6; display: none; }
```

(`.feat-card .feat-arrow` is the small expand-arrow glyph — left unchanged.)

- [ ] **Step 4: Bump `.note-title` and `.note-body`**

Change:

```css
.note-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.note-body { font-size: 12px; color: var(--text-dim); line-height: 1.5; white-space: pre-wrap; word-break: break-word; min-height: 1.5em; }
```

to:

```css
.note-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
.note-body { font-size: 15px; color: var(--text-dim); line-height: 1.6; white-space: pre-wrap; word-break: break-word; min-height: 1.5em; }
```

- [ ] **Step 5: Commit**

```bash
git add static/css/app.css
git commit -m "style: enlarge inventory, feats, and notes text"
```

---

### Task 4: Inline-style description blocks and weapon type-line in sheet.js

**Files:**
- Modify: `static/js/sheet.js`

- [ ] **Step 1: Bump the subclass description block (around line 988)**

Change:

```js
      html += `<div style="padding:10px 12px;background:var(--gray-bg);border-radius:6px;font-size:13px;line-height:1.65;margin-bottom:8px">${escHtml(subclass.description)}</div>`;
```

to:

```js
      html += `<div style="padding:10px 12px;background:var(--gray-bg);border-radius:6px;font-size:15px;line-height:1.6;margin-bottom:8px">${escHtml(subclass.description)}</div>`;
```

- [ ] **Step 2: Bump the background description block (around line 360)**

Change:

```js
      ${bg.description ? `<div style="font-size:13px;line-height:1.65;margin-bottom:6px">${escHtml(bg.description)}</div>` : ''}
```

to:

```js
      ${bg.description ? `<div style="font-size:15px;line-height:1.6;margin-bottom:6px">${escHtml(bg.description)}</div>` : ''}
```

- [ ] **Step 3: Bump the weapon type-line and fix its color (lines ~401 and ~442)**

This exact line appears twice (once for manually-added weapons, once for inventory weapons). Use `replace_all` to update both occurrences:

Change:

```js
        <div style="font-size:10px;color:#888">${typeLine}</div>
```

to:

```js
        <div style="font-size:12px;color:var(--text-dim)">${typeLine}</div>
```

- [ ] **Step 4: Commit**

```bash
git add static/js/sheet.js
git commit -m "style: enlarge description blocks and weapon type-line text"
```

---

### Task 5: Visual verification across tabs (light & dark)

**Files:**
- None (verification only)

- [ ] **Step 1: Start the dev server**

```bash
PORT=5099 .venv/bin/python -m src.app > /tmp/dnd_server.log 2>&1 &
disown
sleep 2 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5099/api/health
```

Expected: `200`

- [ ] **Step 2: Write a Playwright screenshot script**

Create `scripts/verify_typography.mjs`:

```js
import { chromium } from 'playwright';

const BASE = 'http://localhost:5099';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });

  await page.goto(BASE + '/login');
  await page.fill('#username', 'hernan');
  await page.fill('#password', 'hernan@2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');

  // Barbarian (id=14) has weapons, feats, and a subclass description.
  await page.goto(BASE + '/?view=sheet&id=14');
  await page.waitForSelector('.app-header');

  const tabs = ['Stats', 'Combat', 'Spells', 'Inventory', 'Feats'];
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await page.click('.theme-toggle-btn');
      await page.waitForTimeout(200);
    }
    for (const tab of tabs) {
      await page.click(`text=${tab}`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `/tmp/typography-${theme}-${tab.toLowerCase()}.png`, fullPage: true });
    }
  }

  console.log('done');
  await browser.close();
}

main();
```

- [ ] **Step 3: Run the script**

```bash
cd scripts && node verify_typography.mjs
```

Expected: `done`, with 10 screenshots written to `/tmp/typography-*.png`.

- [ ] **Step 4: Review screenshots**

Read each `/tmp/typography-*.png` (use the Read tool — it can display images). For each tab in both themes, confirm:
- Description text (feature descriptions, subclass description, spell descriptions) is noticeably larger and uses the lightened dim color in dark mode.
- Weapon rows (Combat tab) show larger name/attack/damage/breakdown text with no wrapping or overflow into adjacent columns.
- No text is clipped or overlapping in the ability grid, combat grid, or coin grid (these were intentionally left unchanged but verify the larger neighboring text — e.g. `.section-title` — doesn't crowd them).

If anything overflows or wraps awkwardly, fix the specific rule in `static/css/app.css` and re-run Step 3.

- [ ] **Step 5: Clean up**

```bash
rm scripts/verify_typography.mjs
pkill -f "src.app"
```

---

## Spec Coverage Check

- Color token (`--text-dim` dark mode): Task 1, Step 1 ✅
- Tier A (descriptions/prose): `.feat-desc` (Task 3), `.spell-desc`/`.spell-higher` (Task 2), `.note-body` (Task 3), subclass/background description blocks (Task 4) ✅
- Tier B (names/titles): `.feat-name` (Task 3), `.spell-name` (Task 2), `.weapon-name` (Task 3), `.item-name` (Task 3), `.note-title` (Task 3), `.spell-row-name` (Task 2) ✅
- Tier C (secondary values/rows + section titles): `.weapon-atk`/`.weapon-dmg` (Task 3), `.item-qty` (Task 3), `.ability-mod` (Task 1), `.skill-row`/`.skill-bonus` (Task 1), `.save-row`/`.save-bonus` (Task 1), `.spell-level-title` (Task 2), `.spell-progress` (Task 2), `.prof-info` (Task 1), `.section-title` (Task 1) ✅
- Tier D (small annotations): `.feat-level` (Task 3), `.weapon-breakdown` (Task 3), weapon type-line (Task 4), `.spell-school`/`.spell-meta` (Task 2), `.skill-ability` (Task 1), `.spell-level-count` (Task 2), `.eq-btn` (Task 3), `.spell-row-level`/`.spell-row-school` (Task 2) ✅
- Out of scope items (builder screens, tiny micro-labels, layout changes): untouched ✅
