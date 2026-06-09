# Design Unification — dnd_character & lodestar

**Date:** 2026-06-09  
**Scope:** Visual design tokens, typography, and dark mode architecture shared across both apps  
**Status:** Approved

---

## Problem

Both apps are part of the same D&D suite but have drifted in three areas: background palette warmth, body font, and saving throw label style. They share AlegreyaSC as a display font but feel like slightly different products.

---

## Design Decisions

### 1. Palette — adopt lodestar's warmer tokens in dnd_character

lodestar's palette reads easier on the eyes. dnd_character adopts it wholesale.

| Token | Old (dnd_character) | New (both apps) |
|---|---|---|
| `--bg` | `#f8f6f1` | `#e5dfd3` |
| `--surface` | `#ffffff` | `#f8f6f1` |
| `--surface2` | `#f0ece4` | `#ece7dd` |
| `--border` | `#d8d0c4` | `#b8b0a4` |
| `--border-subtle` | `#e8e0d4` | `#d0c8bc` |

lodestar's palette tokens are already correct — no changes there.

### 2. Main text color — ink-brown in both apps

`--text` shifts from the neutral near-black `#1c1a17` to a warmer ink-brown `#2c2218` in both apps. Reads as "written on parchment" rather than "printed on paper."

### 3. Body font — EB Garamond in both apps

Replace `Lato` (dnd_character) and `system-ui` (lodestar) with **EB Garamond**.

Rationale: EB Garamond and AlegreyaSC share Renaissance Venetian roots — both trace back to Claude Garamond's 16th-century typefaces. The body and display fonts feel like family rather than a clash between old-world and modern.

Font loading: Both apps serve fonts as local files. Download EB Garamond woff2 files (weights 400 and 500, plus italic 400) and add them to `static/fonts/` (dnd_character) and `public/fonts/` (lodestar). Add `@font-face` declarations matching the existing AlegreyaSC pattern in each app. Remove the existing Lato `@font-face` blocks from dnd_character.

Body text size should bump to **14px** (from 13px) to compensate for Garamond's smaller x-height at equivalent point sizes.

### 4. Display font — no change

`AlegreyaSC` remains the display font in both apps. It is already the shared visual backbone for headers, tab labels, section titles, and small-caps labels. No changes needed.

### 5. Dark mode tokens — no change

Both apps already share identical dark mode tokens. No token changes needed.

```
--bg: #1c1a17   --surface: #252220   --surface2: #2e2b27
--border: #3a3830   --text: #e0dbd4   --text-dim: #6a6460
```

### 8. Dark mode architecture cleanup — dnd_character only

dnd_character implements dark mode with ~80 explicit `[data-theme="dark"] .component` overrides that manually reassign colors per component. lodestar instead overrides only the 8 tokens in `:root` and lets `var()` references cascade automatically.

The dnd_character approach is brittle: every new component requires a matching dark rule or it won't adapt. It also makes future token changes expensive — each change touches both the `:root` block and a long list of component overrides.

**Fix:** Audit all `[data-theme="dark"]` component rules in `static/css/app.css`. For each rule:
- If it only reassigns values already expressed via CSS variables (e.g. `border-color: var(--border)`), delete it — the variable already handles it.
- If it hardcodes a specific color not covered by any token (e.g. `background: #1a2e1a` on a selected spell row), keep it — these are intentional per-component overrides.

After cleanup, `[data-theme="dark"]` should contain only the 8 token overrides plus any genuinely component-specific exceptions. New components added in the future will automatically inherit correct dark mode colors without extra rules.

### 6. Saving throw labels — dnd_character only

The `.save-box` labels in the Combat tab currently use `system-ui` at `9px`. This is visually disconnected from the rest of the UI.

**Fix:** Switch to `AlegreyaSC` at `0.55rem` with `letter-spacing: 0.08em` and `text-transform: uppercase` — the same treatment used for section titles and ability score labels.

### 7. Character header subtitle — dnd_character only

The `.char-meta` line ("Bard · Creation · Level 3 · Noble") currently uses `10px` uppercase system-ui.

**Fix:** EB Garamond, `12px`, mixed case, `color: rgba(229, 223, 211, 0.65)` (semi-transparent version of `--bg`). Clearly secondary to the AlegreyaSC character name without disappearing.

---

## Shared Design Token Reference (post-unification)

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
  --font-body:     'EB Garamond', Georgia, serif;
}

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

---

## Scope of Changes per App

### dnd_character (`static/css/app.css`)
- Update all `:root` palette tokens (5 values)
- Update `--text` to `#2c2218`
- Replace `@font-face` Lato declarations with EB Garamond
- Update `--font-body` to `'EB Garamond', Georgia, serif`
- Bump base body font-size from 13px to 14px where Lato was used
- Fix `.save-box .save-name`: `font-family: var(--font-display)`, `font-size: 0.55rem`, `letter-spacing: 0.08em`, `text-transform: uppercase`
- Fix `.char-meta`: `font-family: var(--font-body)`, `font-size: 12px`, remove `text-transform: uppercase`, `color: rgba(229, 223, 211, 0.65)`
- Audit and remove redundant `[data-theme="dark"]` component overrides (keep only the 8 token overrides and genuine per-component exceptions)

### lodestar (`src/style.css`)
- Update `--text` to `#2c2218`
- Replace `--font-body: system-ui, -apple-system, sans-serif` with `'EB Garamond', Georgia, serif`
- Add EB Garamond woff2 files to `public/fonts/` and `@font-face` declarations at top of `src/style.css`
- Bump body font-size references from 13px to 14px where appropriate

---

## Out of Scope

- Layout, spacing, or component structure changes
- Any functional changes to either app
- Dark mode token changes (tokens are already unified)
- AlegreyaSC font files or display font usage
- Dark mode architecture in lodestar (already correct — token-only overrides)
