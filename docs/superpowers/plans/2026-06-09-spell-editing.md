# Spell Editing & Slot Display Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix spell slot display to show remaining/max (4/4 when full) and add in-sheet spell editing (add/remove spells from the known list).

**Architecture:** Two self-contained changes to `static/js/sheet.js` + one CSS addition in `static/css/app.css`. No backend changes — the existing `PATCH /api/characters/:id` endpoint already accepts `spells_known`. The spell picker follows the existing item picker pattern already in the codebase.

**Tech Stack:** Vanilla JS, plain CSS, Flask backend (unchanged).

---

## Files

- Modify: `static/js/sheet.js` — `renderSpells`, `spellCard`, new `removeSpell`/`addSpell`/`renderSpellPickerResults`/`filterSpellPicker` functions
- Modify: `static/css/app.css` — add `.spell-card.editing` rule and spell-picker panel styles

---

## Task 1: Fix spell slot display

**Files:**
- Modify: `static/js/sheet.js:573-576`

### Context

Current `renderSpells` (lines 570–577) renders:

```js
${Object.entries(slots).sort(([a],[b])=>+a-+b).map(([lvl, s]) => `
  <div class="spell-level-row">
    <div class="spell-level-label">Lv ${lvl}</div>
    <div style="flex:1;text-align:center;font-size:15px;font-weight:700">${s.used}/${s.max}</div>
    <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="freeSlot('${lvl}')">−</button>
    <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="useSlot('${lvl}')">+</button>
    <button class="btn-icon" style="font-size:14px" onclick="restoreSlots('${lvl}')" title="Restore all">↺</button>
  </div>`).join('')}
```

`used` starts at 0 after long rest, so this shows `0/4`. Target: show `remaining/max = (max − used)/max` → `4/4` when fresh. The `−` button should spend a slot (remaining decreases) and `+` should recover one. This means swapping the onclick assignments.

- [ ] **Step 1: Edit `renderSpells` in `static/js/sheet.js`**

  Replace (lines ~573–576):
  ```js
        <div style="flex:1;text-align:center;font-size:15px;font-weight:700">${s.used}/${s.max}</div>
        <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="freeSlot('${lvl}')">−</button>
        <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="useSlot('${lvl}')">+</button>
  ```
  With:
  ```js
        <div style="flex:1;text-align:center;font-size:15px;font-weight:700">${s.max - s.used}/${s.max}</div>
        <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="useSlot('${lvl}')">−</button>
        <button class="hp-editor-btn" style="width:28px;height:28px;font-size:16px" onclick="freeSlot('${lvl}')">+</button>
  ```

- [ ] **Step 2: Verify in browser**

  Open the Spells tab for a character with spell slots. Confirm:
  - Slots show `4/4` / `2/2` (not `0/4`) on a fresh character.
  - Clicking `−` decreases the number (e.g., `4/4` → `3/4`).
  - Clicking `+` increases the number (e.g., `3/4` → `4/4`).
  - Clicking `↺` restores to full.

- [ ] **Step 3: Commit**

  ```bash
  git add static/js/sheet.js
  git commit -m "fix: show remaining spell slots (4/4 not 0/4), swap +/- button actions"
  ```

---

## Task 2: Spell removal in edit mode

**Files:**
- Modify: `static/js/sheet.js` — `renderSpells`, `spellCard`, add `removeSpell`

### Context

- `spells_known` on `char` is an array of spell key strings (e.g. `["mage-hand", "healing-word"]`).
- `spellData` is a global map `{ [key]: SpellObject }` loaded from `/api/spells`.
- `editMode` is a global boolean toggled by `toggleEdit()`.
- `delete-btn` CSS (line 559) already exists: a small grey `×` that turns red on hover. Use it directly.
- The existing `save({ spells_known: arr })` call persists to the backend.

The plan:
1. Add an "Edit" button to the Spells tab header (following the same pattern as Combat/Inventory tabs).
2. Embed the spell key on each spell object so `spellCard` can reference it.
3. In `spellCard`, append a `×` button to `.spell-header` when `editMode` is true.
4. Add a `removeSpell(key)` function.

- [ ] **Step 1: Add Edit button and embed keys in `renderSpells`**

  In `static/js/sheet.js`, in `renderSpells(el)`, change the `el.innerHTML` template string.

  a) Add an Edit button row as the very first element inside the template string (before `<div class="spell-dc-bar">`):

  ```js
  el.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="btn btn-sm btn-outline" onclick="toggleEdit()">${editMode ? '✓ Done' : '✏ Edit'}</button>
    </div>
    <div class="spell-dc-bar">
  ```

  b) Change the `knownSpells` construction (currently line ~552) to embed the key on each object:

  Current:
  ```js
  const knownSpells = known.map(k => allSpells[k]).filter(Boolean);
  ```
  Replace with:
  ```js
  const knownSpells = known.map(k => allSpells[k] ? { ...allSpells[k], _key: k } : null).filter(Boolean);
  ```

- [ ] **Step 2: Add `×` button to `spellCard`**

  In `spellCard(s)`, add a remove button at the end of `.spell-header`, after `<span class="spell-school">`:

  Current (around line 607):
  ```js
  return `<div class="spell-card" onclick="this.classList.toggle('expanded')">
    <div class="spell-header">
      <span class="spell-level-badge">${levelLabel}</span>
      <span class="spell-name">${escHtml(s.name)}${ritual}${conc}</span>
      <span class="spell-school">${escHtml(s.school)}</span>
    </div>
  ```
  Replace with:
  ```js
  const removeBtn = editMode && s._key
    ? `<button class="delete-btn" onclick="event.stopPropagation();removeSpell('${s._key}')" title="Remove">×</button>`
    : '';
  return `<div class="spell-card" onclick="this.classList.toggle('expanded')">
    <div class="spell-header">
      <span class="spell-level-badge">${levelLabel}</span>
      <span class="spell-name">${escHtml(s.name)}${ritual}${conc}</span>
      <span class="spell-school">${escHtml(s.school)}</span>
      ${removeBtn}
    </div>
  ```

- [ ] **Step 3: Add `removeSpell` function**

  Add this after the `freeSlot` function (around line 1102):

  ```js
  window.removeSpell = (key) => {
    const known = (char.spells_known || []).filter(k => k !== key);
    save({ spells_known: known }).then(() => renderActiveTab());
  };
  ```

- [ ] **Step 4: Verify in browser**

  - Go to the Spells tab. An "✏ Edit" button should appear top-right.
  - Click it — each spell card gets a `×` button on the right side of its header row. The card name, school, description are all fully visible and un-obscured.
  - Click `×` on a spell — it disappears from the list.
  - Click "✓ Done" — `×` buttons disappear.
  - Reload — removed spell is gone (persisted).

- [ ] **Step 5: Commit**

  ```bash
  git add static/js/sheet.js
  git commit -m "feat: add spell remove in edit mode"
  ```

---

## Task 3: Spell add panel in edit mode

**Files:**
- Modify: `static/js/sheet.js` — `renderSpells`, add `renderSpellPickerResults`/`addSpell`/`filterSpellPicker`
- Modify: `static/css/app.css` — add `.sp-result-row` style

### Context

- `spellData` is already loaded globally and contains 562 spells, each with a `classes` array.
- `char.class_key` is the character's class key (e.g. `"bard"`).
- Filter: show only spells whose `classes` includes `char.class_key` and that are not already in `spells_known`.
- The panel lives inside `renderSpells`'s template, visible only in edit mode.
- Pattern: mirrors the item picker (`renderItemPickerResults` / `toggleItemPicker` / `filterItemPicker`) already in the codebase.

- [ ] **Step 1: Add spell picker panel to `renderSpells`**

  In the `el.innerHTML` template string of `renderSpells`, add the picker panel **between the spell slots block and the "No known spells" / spell groups**. Replace the current `${!known.length ? ...}` and levels map section:

  Current (around line 578):
  ```js
    ${!known.length ? '<div style="padding:24px;text-align:center;color:#888;font-size:13px">No known spells</div>' : ''}
    ${levels.map(lvl => {
  ```
  Replace with:
  ```js
    ${editMode ? `
    <div class="section-title" style="margin-top:12px">Add Spell</div>
    <input class="input-field" id="spell-search" placeholder="Search ${char.class_key} spells…" oninput="filterSpellPicker()" style="width:100%;margin-bottom:6px">
    <div id="sp-results" style="max-height:220px;overflow-y:auto;margin-bottom:12px"></div>
    ` : ''}
    ${!known.length && !editMode ? '<div style="padding:24px;text-align:center;color:#888;font-size:13px">No known spells</div>' : ''}
    ${levels.map(lvl => {
  ```

- [ ] **Step 2: Call `renderSpellPickerResults` after innerHTML is set**

  At the end of `renderSpells`, after the `el.innerHTML = ...` assignment closes (currently around line 594), add:

  ```js
  if (editMode) renderSpellPickerResults();
  ```

  (The pattern already exists for items: `if (editMode) renderItemPickerResults();` after inventory innerHTML.)

- [ ] **Step 3: Add `renderSpellPickerResults`, `addSpell`, `filterSpellPicker`**

  Add these three functions after `removeSpell` (after line ~1105):

  ```js
  function renderSpellPickerResults() {
    const q = (document.getElementById('spell-search')?.value || '').toLowerCase();
    const results = document.getElementById('sp-results');
    if (!results || !spellData) return;
    const known = new Set(char.spells_known || []);
    const entries = Object.entries(spellData)
      .filter(([k, s]) => s.classes?.includes(char.class_key) && !known.has(k))
      .filter(([, s]) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a[1].level - b[1].level || a[1].name.localeCompare(b[1].name))
      .slice(0, 40);
    results.innerHTML = entries.map(([k, s]) => {
      const lvlLabel = s.level === 0 ? 'Cantrip' : `Lv ${s.level}`;
      return `<div class="sp-result-row" onclick="addSpell('${k}')">
        <span class="spell-level-badge" style="font-size:8px;flex-shrink:0">${lvlLabel}</span>
        <span style="font-size:12px;font-weight:600;flex:1;margin:0 6px">${escHtml(s.name)}</span>
        <span style="font-size:10px;color:var(--text-dim)">${escHtml(s.school)}</span>
      </div>`;
    }).join('');
    if (!entries.length) results.innerHTML = '<div style="font-size:11px;color:#888;padding:4px">No spells found.</div>';
  }

  window.addSpell = (key) => {
    const known = [...(char.spells_known || []), key];
    save({ spells_known: known }).then(() => renderActiveTab());
  };

  window.filterSpellPicker = () => renderSpellPickerResults();
  ```

- [ ] **Step 4: Add `.sp-result-row` CSS**

  In `static/css/app.css`, after the `.spell-higher` rule (line ~341), add:

  ```css
  .sp-result-row {
    display: flex; align-items: center; padding: 6px 8px;
    border-radius: var(--radius-sm); cursor: pointer;
  }
  .sp-result-row:hover { background: var(--surface2); }
  ```

- [ ] **Step 5: Verify in browser**

  - Enter edit mode on the Spells tab.
  - An "Add Spell" section appears with a search input above the spell list.
  - Typing in the search filters results to matching spells for the character's class.
  - Clicking a result adds it to the known spell list immediately (it also disappears from the picker since it's now known).
  - Existing spell cards remain fully readable with the `×` button only.
  - Exit edit mode — picker disappears, spell list renders normally.
  - Reload — added spell persists.

- [ ] **Step 6: Run the test script**

  Make sure the Flask server is running (`flask run` or the systemd service), then:

  ```bash
  cd /home/hernan/dnd_character/scripts && node test_fixes.mjs
  ```

  Expected output ends with:
  ```
  Module loaded (no syntax errors): true
  Errors: NONE
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add static/js/sheet.js static/css/app.css
  git commit -m "feat: add spell picker panel in edit mode"
  ```
