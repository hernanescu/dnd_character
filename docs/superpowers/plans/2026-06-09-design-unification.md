# Design Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the visual design tokens, typography, and dark mode architecture across dnd_character and lodestar so both apps look and feel like the same suite.

**Architecture:** Pure CSS changes — no JS or logic. All token changes propagate automatically through `var()` references. The dark mode cleanup converts dnd_character from per-component overrides (~80 rules) to token-only overrides, matching lodestar's already-correct approach.

**Tech Stack:** CSS custom properties, EB Garamond (Google Fonts, served locally as woff2), AlegreyaSC (existing, unchanged)

**Spec:** `docs/superpowers/specs/2026-06-09-design-unification.md`

---

### Task 1: Download EB Garamond font files

**Files:**
- Create: `dnd_character/static/fonts/EBGaramond-Regular.woff2`
- Create: `dnd_character/static/fonts/EBGaramond-Medium.woff2`
- Create: `dnd_character/static/fonts/EBGaramond-Italic.woff2`
- Create: `lodestar/public/fonts/EBGaramond-Regular.woff2`
- Create: `lodestar/public/fonts/EBGaramond-Medium.woff2`
- Create: `lodestar/public/fonts/EBGaramond-Italic.woff2`

- [ ] **Step 1: Fetch font CSS from Google Fonts and extract woff2 URLs**

```bash
cd /home/hernan
FONT_CSS=$(curl -sL \
  "https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" \
  -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
echo "$FONT_CSS" | grep -oP "https://[^)]+"
```

Expected output: 3 URLs ending in `.woff2`. They will appear in request order — Regular (wght 400), Medium (wght 500), Italic (ital 400). Note all three URLs.

- [ ] **Step 2: Download the three files**

Replace `<URL_REGULAR>`, `<URL_MEDIUM>`, `<URL_ITALIC>` with the URLs from Step 1.

```bash
curl -sL "<URL_REGULAR>" -o /tmp/EBGaramond-Regular.woff2
curl -sL "<URL_MEDIUM>"  -o /tmp/EBGaramond-Medium.woff2
curl -sL "<URL_ITALIC>"  -o /tmp/EBGaramond-Italic.woff2
# Verify they're real woff2 files (should show "Web Open Font")
file /tmp/EBGaramond-Regular.woff2
```

- [ ] **Step 3: Copy to both project font directories**

```bash
cp /tmp/EBGaramond-Regular.woff2 /home/hernan/dnd_character/static/fonts/
cp /tmp/EBGaramond-Medium.woff2  /home/hernan/dnd_character/static/fonts/
cp /tmp/EBGaramond-Italic.woff2  /home/hernan/dnd_character/static/fonts/
cp /tmp/EBGaramond-Regular.woff2 /home/hernan/lodestar/public/fonts/
cp /tmp/EBGaramond-Medium.woff2  /home/hernan/lodestar/public/fonts/
cp /tmp/EBGaramond-Italic.woff2  /home/hernan/lodestar/public/fonts/
ls /home/hernan/dnd_character/static/fonts/ | grep EB
ls /home/hernan/lodestar/public/fonts/ | grep EB
```

Expected: `EBGaramond-Italic.woff2`, `EBGaramond-Medium.woff2`, `EBGaramond-Regular.woff2` in each directory.

- [ ] **Step 4: Commit**

```bash
cd /home/hernan/dnd_character
git add static/fonts/EBGaramond-*.woff2
cd /home/hernan/lodestar
git add public/fonts/EBGaramond-*.woff2
cd /home/hernan/dnd_character
git commit -m "feat: add EB Garamond font files to both projects"
```

---

### Task 2: Update dnd_character — font declarations and body token

**Files:**
- Modify: `dnd_character/static/css/app.css` (lines 1–44)

The current file has five `@font-face` blocks for Lato (Regular, Bold, Italic) at lines 13–30, followed by `:root` with `--font-body: system-ui, -apple-system, sans-serif`. We replace the Lato blocks with EB Garamond and update the token.

- [ ] **Step 1: Replace the Lato @font-face blocks with EB Garamond**

In `dnd_character/static/css/app.css`, replace lines 13–30 (the three Lato blocks):

```css
@font-face {
  font-family: 'Lato';
  src: url('/static/fonts/Lato-Regular.woff2') format('woff2'),
       url('/static/fonts/Lato-Regular.ttf') format('truetype');
  font-weight: 400;
}
@font-face {
  font-family: 'Lato';
  src: url('/static/fonts/Lato-Bold.woff2') format('woff2'),
       url('/static/fonts/Lato-Bold.ttf') format('truetype');
  font-weight: 700;
}
@font-face {
  font-family: 'Lato';
  src: url('/static/fonts/Lato-Italic.woff2') format('woff2'),
       url('/static/fonts/Lato-Italic.ttf') format('truetype');
  font-style: italic;
}
```

Replace with:

```css
@font-face {
  font-family: 'EBGaramond';
  src: url('/static/fonts/EBGaramond-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'EBGaramond';
  src: url('/static/fonts/EBGaramond-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'EBGaramond';
  src: url('/static/fonts/EBGaramond-Italic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
```

- [ ] **Step 2: Update --font-body in :root**

In the same file, find:

```css
  --font-body:     system-ui, -apple-system, sans-serif;
```

Replace with:

```css
  --font-body:     'EBGaramond', Georgia, serif;
```

- [ ] **Step 3: Verify font loads — start the app and check**

```bash
cd /home/hernan/dnd_character
python src/app.py &
# Open http://localhost:5000 — body text (skill names, item names) should render in Garamond
# Kill server after check
kill %1
```

- [ ] **Step 4: Commit**

```bash
cd /home/hernan/dnd_character
git add static/css/app.css
git commit -m "feat: replace Lato with EB Garamond in dnd_character"
```

---

### Task 3: Update dnd_character — palette and text color tokens

**Files:**
- Modify: `dnd_character/static/css/app.css` (`:root` block, lines 34–50)

- [ ] **Step 1: Update the :root color tokens**

Find the current `:root` block:

```css
:root {
  --bg:            #f8f6f1;
  --surface:       #ffffff;
  --surface2:      #f0ece4;
  --border:        #d8d0c4;
  --border-subtle: #e8e0d4;
  --text:          #1c1a17;
  --text-dim:      #8a8078;
  --text-faint:    #a09890;
  --font-display:  'AlegreyaSC', Georgia, serif;
  --font-body:     'EBGaramond', Georgia, serif;
  --radius:        8px;
  --radius-sm:     5px;
  --gray-bg:       var(--surface2);
  --gray-light:    var(--border-subtle);
  --card-bg:       var(--surface);
}
```

Replace with:

```css
:root {
  --bg:            #e5dfd3;
  --surface:       #f8f6f1;
  --surface2:      #ece7dd;
  --border:        #b8b0a4;
  --border-subtle: #d0c8bc;
  --text:          #2c2218;
  --text-dim:      #8a8078;
  --text-faint:    #a09890;
  --font-display:  'AlegreyaSC', Georgia, serif;
  --font-body:     'EBGaramond', Georgia, serif;
  --radius:        8px;
  --radius-sm:     5px;
  --gray-bg:       var(--surface2);
  --gray-light:    var(--border-subtle);
  --card-bg:       var(--surface);
}
```

- [ ] **Step 2: Verify visually**

Start the app and check: the background should shift to a warmer parchment tone (`#e5dfd3`), cards should be `#f8f6f1`. Text should feel slightly warmer (ink-brown rather than near-black).

```bash
cd /home/hernan/dnd_character && python src/app.py &
# Check http://localhost:5000 — warm parchment bg, no white cards
kill %1
```

- [ ] **Step 3: Commit**

```bash
cd /home/hernan/dnd_character
git add static/css/app.css
git commit -m "feat: adopt lodestar palette and ink-brown text in dnd_character"
```

---

### Task 4: Update dnd_character — saving throws and header subtitle

**Files:**
- Modify: `dnd_character/static/css/app.css`

Two targeted typography fixes: saving throw labels and the character header subtitle.

- [ ] **Step 1: Fix saving throw labels (.save-box .save-name)**

Find:

```css
.save-box .save-bonus { font-size: 16px; font-weight: 700; }
.save-box .save-name { font-size: 9px; color: var(--text-dim); margin-top: 2px; }
```

Replace with:

```css
.save-box .save-bonus { font-size: 16px; font-weight: 700; }
.save-box .save-name {
  font-family: var(--font-display);
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-top: 2px;
}
```

- [ ] **Step 2: Fix character header subtitle (.char-meta)**

Find:

```css
.char-meta { font-size: 10px; color: var(--text-faint); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 4px; }
```

Replace with:

```css
.char-meta { font-family: var(--font-body); font-size: 12px; color: rgba(229, 223, 211, 0.65); letter-spacing: 0.02em; margin-top: 4px; }
```

- [ ] **Step 3: Verify visually**

Start the app, navigate to a character sheet's Combat tab. Saving throw labels should render in AlegreyaSC small caps. On the character list and sheet header, "Bard · Creation · Level 3" should be 12px mixed-case Garamond, clearly secondary to the name.

```bash
cd /home/hernan/dnd_character && python src/app.py &
# Check http://localhost:5000/?view=sheet&id=<any_id>
kill %1
```

- [ ] **Step 4: Commit**

```bash
cd /home/hernan/dnd_character
git add static/css/app.css
git commit -m "fix: saving throw labels and header subtitle typography"
```

---

### Task 5: Update dnd_character — bump body text sizes for Garamond

**Files:**
- Modify: `dnd_character/static/css/app.css`

EB Garamond has a smaller x-height than Lato at the same point size. These four body text selectors were at 13px and should move to 14px. (Label-only text like `font-size: 9px` or display font uses stay as-is.)

- [ ] **Step 1: Bump font sizes**

Make these four edits in `static/css/app.css`:

```css
/* item-name: 13px → 14px */
.item-name { flex: 1; font-size: 14px; }

/* input-field: 13px → 14px */
.input-field {
  flex: 1; padding: 8px 10px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px;
}

/* spell-row-name: 13px → 14px */
.spell-row-name {
  flex: 1;
  font-size: 14px;
}

/* btn: 13px → 14px */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 9px 18px; border-radius: var(--radius-sm); font-family: var(--font-body);
  font-size: 14px; font-weight: 700; cursor: pointer; border: none;
  letter-spacing: 0.03em; text-decoration: none;
}
```

- [ ] **Step 2: Verify**

```bash
cd /home/hernan/dnd_character && python src/app.py &
# Check item list, spell picker, and action buttons — text should feel slightly larger/more comfortable
kill %1
```

- [ ] **Step 3: Commit**

```bash
cd /home/hernan/dnd_character
git add static/css/app.css
git commit -m "fix: bump body font sizes to compensate for Garamond x-height"
```

---

### Task 6: dnd_character — dark mode architecture cleanup

**Files:**
- Modify: `dnd_character/static/css/app.css` (lines ~719–818, the `DARK MODE OVERRIDES` block)

**The problem:** ~80 rules re-declare properties that already use CSS variables in light mode. When `[data-theme="dark"]` swaps the token values, `var(--border)` already resolves to the dark border — rules like `border-color: var(--border)` are redundant.

**The rule:** Delete a dark mode rule if every property in it uses `var(--X)` AND the corresponding light mode selector uses the same `var(--X)` for the same property. Keep rules that: (a) use a *different* variable than light mode (intentional behavior change), (b) add a property that has no light-mode equivalent, or (c) use a hardcoded value.

- [ ] **Step 1: Delete the redundant rules**

Remove these entire lines/single-line rules from the `DARK MODE OVERRIDES` block. Each entry is the full text of the line to delete:

```
[data-theme="dark"] .tabs { border-color: var(--border); }
[data-theme="dark"] .tab { color: var(--text-dim); }
[data-theme="dark"] .tab.active { color: var(--text); border-color: var(--text); }
[data-theme="dark"] .char-card-name { color: var(--text); }
[data-theme="dark"] .char-card-meta { color: var(--text-dim); }
[data-theme="dark"] .empty-state-text { color: var(--text-dim); }
[data-theme="dark"] .pill.selected { background: var(--text); color: var(--surface); border-color: var(--text); }
[data-theme="dark"] .step-sub { color: var(--text-dim); }
[data-theme="dark"] .ability-score { color: var(--text); }
[data-theme="dark"] .ability-mod { color: var(--text-dim); }
[data-theme="dark"] .save-box { border-color: var(--border); }
[data-theme="dark"] .save-box .save-name { color: var(--text-dim); }
[data-theme="dark"] .stat-box { border-color: var(--border); }
[data-theme="dark"] .stat-label { color: var(--text-dim); }
[data-theme="dark"] .section-title { border-color: var(--border); color: var(--text-dim); }
[data-theme="dark"] .hp-editor { border-color: var(--border); }
[data-theme="dark"] .skill-ability { color: var(--text-dim); }
[data-theme="dark"] .skill-bonus { color: var(--text); }
[data-theme="dark"] .weapon-atk { color: var(--text-dim); }
[data-theme="dark"] .coin-box { border-color: var(--border); }
[data-theme="dark"] .coin-label { color: var(--text-dim); }
[data-theme="dark"] .coin-val { color: var(--text); }
[data-theme="dark"] .feat-card { background: var(--surface2); border-left-color: var(--text); }
[data-theme="dark"] .feat-desc { color: var(--text-dim); }
[data-theme="dark"] .feat-level { color: var(--text-dim); }
[data-theme="dark"] .note-header { color: var(--text-dim); }
[data-theme="dark"] .spell-card { border-color: var(--border); }
[data-theme="dark"] .spell-desc { color: var(--text-dim); }
[data-theme="dark"] .spell-meta { color: var(--text-dim); }
[data-theme="dark"] .spell-higher { color: var(--text-dim); }
[data-theme="dark"] .spell-level-header:hover { background: var(--surface2); }
[data-theme="dark"] .spell-group-title { color: var(--text-dim); }
[data-theme="dark"] .spell-row:hover { background: var(--surface2); }
[data-theme="dark"] .spell-row-level { color: var(--text-dim); }
[data-theme="dark"] .spell-dc-bar { background: var(--surface2); }
[data-theme="dark"] .spell-dc-label { color: var(--text-dim); }
[data-theme="dark"] .subclass-card.selected { border-color: var(--text); }
[data-theme="dark"] .subclass-desc { color: var(--text-dim); }
[data-theme="dark"] .add-row { border-color: var(--border); }
[data-theme="dark"] .resource-bar { background: var(--surface2); border-color: var(--border); }
[data-theme="dark"] .resource-label { color: var(--text-dim); }
[data-theme="dark"] .resource-val { color: var(--text); }
[data-theme="dark"] .slot-pip.used { background: var(--text); }
[data-theme="dark"] .btn { border-color: var(--border); }
[data-theme="dark"] .btn-primary { background: var(--text); color: var(--surface); border-color: var(--text); }
[data-theme="dark"] .btn-outline { color: var(--text); border-color: var(--text); }
[data-theme="dark"] .ability-assign-row { border-color: var(--border); }
[data-theme="dark"] .ability-assign-label { color: var(--text-dim); }
[data-theme="dark"] .racial-bonus { color: var(--text-dim); }
[data-theme="dark"] .hp-num { color: var(--text); }
[data-theme="dark"] .prof-info { color: var(--text-dim); }
[data-theme="dark"] .char-name { color: var(--text); }
[data-theme="dark"] .char-meta { color: var(--text-dim); }
[data-theme="dark"] .step-dot { background: var(--border); }
```

- [ ] **Step 2: Verify the KEEP list is intact**

After deleting, confirm these rules still exist in the file (they are intentional — each changes which variable is used or adds a property not present in light mode):

```bash
grep -n "data-theme=\"dark\"" /home/hernan/dnd_character/static/css/app.css
```

Expected surviving rules (roughly 30, down from ~80):
- Token block at `:root` (lines ~52–55)
- `html` background
- `body` (bg changes from `--surface2` to `--bg`)
- `#app` (bg changes from `--surface` to `--bg`)
- `.input-field` (adds explicit bg)
- `.app-header` (bg changes from `--text` to `--surface2`)
- `.char-card` (adds bg)
- `.char-card:hover` (hover changes from `--surface2` to `--border`)
- `.char-list-sub` (color changes from `--text-faint` to `--text-dim`)
- `.builder-header` (bg changes from `--text` to `--surface2`)
- `.builder-body`, `.builder-nav` (add bg)
- `.pill` (bg changes from `--surface` to `--surface2`)
- `.ability-box` (bg changes from `--surface` to `--surface2`)
- `.hp-editor-btn` (styling change)
- `.skill-row`, `.weapon-row`, `.item-row`, `.spell-row` (border changes from `--border-subtle` to `--border`)
- `.note-card` (adds bg), `.note-body` (color changes from `--text-dim` to `--text`)
- `.spell-level-group`, `.spell-group`, `.spell-group-header`
- `.spell-row.selected` (hardcoded `#1a2e1a`)
- `.spell-row-school` (color changes from `--text-faint` to `--text-dim`)
- `.spell-row-check`, `.spell-progress`
- `.subclass-card`, `.subclass-features`, `.source-notes`
- `.back-btn` (color changes from `--text-faint` to `--text-dim`)
- `.resource-btn` (border changes from `--text` to `--border`)
- `.slot-pip` (adds bg), `.empty-state-icon` (adds color)
- `.dm-screen`
- `.stat-pill`, `.stat-pill-hp` (hardcoded rgba)
- `.hp-badge`, `.hp-label`, `.step-dot.active`, `.step-dot.done`
- `.icon-btn:hover`, `.icon-btn-danger:hover`, `.char-card-delete:hover`

- [ ] **Step 3: Smoke-test dark mode thoroughly**

```bash
cd /home/hernan/dnd_character && python src/app.py &
```

Open `http://localhost:5000`, toggle dark mode. Check each tab (Stats, Combat, Spells, Inventory, Feats, World). Every component should adapt correctly. If anything looks wrong (broken contrast, invisible text, wrong background), trace back to the deleted rule and restore it if needed.

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
cd /home/hernan/dnd_character
git add static/css/app.css
git commit -m "refactor: remove redundant dark mode overrides, token-only architecture"
```

---

### Task 7: Update lodestar — font declarations and tokens

**Files:**
- Modify: `lodestar/src/style.css` (lines 1–44)

lodestar already has the correct palette. Only two changes: add EB Garamond `@font-face` blocks, update `--font-body` and `--text`.

- [ ] **Step 1: Add EB Garamond @font-face declarations**

At the top of `lodestar/src/style.css`, after the existing AlegreyaSC blocks (after line 15), add:

```css
@font-face {
  font-family: 'EBGaramond';
  src: url('/fonts/EBGaramond-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'EBGaramond';
  src: url('/fonts/EBGaramond-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'EBGaramond';
  src: url('/fonts/EBGaramond-Italic.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
```

- [ ] **Step 2: Update --font-body and --text in :root**

Find in `lodestar/src/style.css`:

```css
  --font-body:      system-ui, -apple-system, sans-serif;
```

Replace with:

```css
  --font-body:      'EBGaramond', Georgia, serif;
```

Find:

```css
  --text:           #1c1a17;
```

Replace with:

```css
  --text:           #2c2218;
```

- [ ] **Step 3: Bump main body text sizes**

EB Garamond's smaller x-height means list items and result text need a slight size bump. Find and update these two rules:

```css
/* move-item: 0.95rem → 1rem */
.move-item {
  display: block;
  width: 100%;
  padding: 11px 14px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text);
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.1s, padding-left 0.1s;
}

/* raw-row-result: 0.88rem → 0.95rem */
.raw-row-result {
  font-size: 0.95rem;
  color: var(--text);
  line-height: 1.3;
}
```

- [ ] **Step 4: Verify visually**

```bash
cd /home/hernan/lodestar
npm run dev &
# Open the dev URL (typically http://localhost:5173)
# Check: move list items, oracle table results — should render in Garamond
# Check: warm ink-brown text (#2c2218) against the parchment bg
# Toggle dark mode — should look identical to before
kill %1
```

- [ ] **Step 5: Commit**

```bash
cd /home/hernan/lodestar
git add src/style.css public/fonts/EBGaramond-*.woff2
git commit -m "feat: unify typography — EB Garamond body font and ink-brown text"
```

---

### Task 8: Final cross-app visual review

- [ ] **Step 1: Run both apps side by side**

```bash
cd /home/hernan/dnd_character && python src/app.py &
cd /home/hernan/lodestar && npm run dev &
```

Open both URLs side by side.

- [ ] **Step 2: Light mode checklist**

- [ ] Both headers: dark background, AlegreyaSC title, Garamond subtitle
- [ ] Both tab bars: AlegreyaSC labels, same inactive/active color
- [ ] Both content areas: same warm parchment `#e5dfd3` background
- [ ] dnd_character saving throws: AlegreyaSC labels in grid boxes
- [ ] dnd_character character subtitle: 12px mixed-case Garamond, visibly secondary to name
- [ ] lodestar move list: Garamond body text, comfortable size
- [ ] lodestar oracle tables: Garamond result text

- [ ] **Step 3: Dark mode checklist**

- [ ] Both headers: dark background
- [ ] Both tab bars: same muted/active color
- [ ] No missing styles or invisible text anywhere in dnd_character
- [ ] lodestar dark mode unchanged from before

- [ ] **Step 4: Kill servers and wrap up**

```bash
kill %1 %2
```
