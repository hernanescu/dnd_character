"""
Usage: python scripts/scrape_backgrounds.py
Scrapes background data from dnd5e.wikidot.com and writes data/backgrounds.json

Enriched schema includes:
  - name, description (flavor text)
  - skill_proficiencies, tool_proficiencies, languages
  - equipment (raw text)
  - source (book attribution)
  - features: [{name, description, table?}]
  - suggested_characteristics: {personality_traits, ideals, bonds, flaws}
    each with {die, entries: [[roll, text], ...]}
"""
import requests
from bs4 import BeautifulSoup
import json
import re
import time
import os

LIST_URL = 'https://dnd5e.wikidot.com'
DETAIL_BASE = 'https://dnd5e.wikidot.com'
DELAY = 0.4

SKILL_KEYWORDS = [
    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
    "History", "Insight", "Intimidation", "Investigation", "Medicine",
    "Nature", "Perception", "Performance", "Persuasion", "Religion",
    "Sleight of Hand", "Stealth", "Survival",
]

# Slugs to exclude (heroic chronicle pages, non-background entries)
EXCLUDE_SLUGS = {
    'optional-features', 'wildemount-heroic-chronicle',
    'sword-coast-heroic-chronicle', 'wildemount',
}


def get(url, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
            r.raise_for_status()
            time.sleep(DELAY)
            return r
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(2)


def get_background_slugs():
    """Get list of background slugs from dnd5e.wikidot.com main page."""
    r = get(LIST_URL)
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')
    seen = set()
    slugs = []
    for a in (content.find_all('a') if content else []):
        href = a.get('href', '')
        m = re.match(r'^/background:([a-z0-9-]+)$', href)
        if m:
            slug = m.group(1)
            if slug not in seen:
                seen.add(slug)
                slugs.append((a.get_text().strip(), slug))
    return slugs


def _extract_stat_value(text, key, single_line=False):
    """Extract value for a stat key (e.g. 'Skill Proficiencies') from text block."""
    for line in text.split('\n'):
        line = line.strip()
        if line.lower().startswith(key.lower() + ':'):
            raw = line.split(':', 1)[1].strip()
            return raw
    return None


def _parse_skills(text):
    if not text or text.lower() in ('none', '—', '-', ''):
        return []
    if 'choose' in text.lower():
        return []
    found = []
    for s in SKILL_KEYWORDS:
        if s.lower() in text.lower():
            found.append(s)
    if found:
        return found
    items = re.split(r',\s*(?:and\s+)?', text)
    return [i.strip().rstrip('.') for i in items if i.strip() and i.strip().lower() != 'none']


def _val_or_next_line(line, lines, i):
    """Value may be on the same line after ':' or on the next line (due to <br> in wikidot)."""
    after_colon = line.split(':', 1)[1].strip()
    if after_colon:
        return after_colon
    if i + 1 < len(lines):
        return lines[i + 1].strip()
    return ''

_STAT_KEYS = ['skill proficiencies:', 'tool proficiencies:', 'languages:', 'equipment:']

def _collect_equipment(lines, i):
    """Collect all following lines until next stat key or end (equipment spans multiple lines due to hover tooltips)."""
    parts = []
    for j in range(i + 1, len(lines)):
        line = lines[j].strip()
        if not line:
            continue
        if any(line.lower().startswith(k) for k in _STAT_KEYS):
            break
        parts.append(line)
    # Join with space, but be smart about comma placement
    result = ' '.join(parts)
    # Clean up space-before-comma and space-before-period
    result = re.sub(r'\s+,', ',', result)
    result = re.sub(r'\s+\.', '.', result)
    return result


def _parse_languages(text):
    if not text or text.lower() in ('none', '—', '-', ''):
        return 0
    m = re.search(r'\b(one|two|three|1|2|3)\b', text, re.IGNORECASE)
    if m:
        word_map = {'one': 1, 'two': 2, 'three': 3}
        n = m.group(1).lower()
        return word_map.get(n, int(n) if n.isdigit() else 1)
    if 'any' in text.lower():
        return 1
    return 0


def _parse_table(table):
    """Parse a wikidot table into list of [col1, col2, ...] rows (skipping header)."""
    rows = table.find_all('tr')
    if not rows:
        return []
    return [
        [cell.get_text(' ', strip=True) for cell in row.find_all(['td', 'th'])]
        for row in rows
    ]


def parse_background(name, slug):
    url = f'{DETAIL_BASE}/background:{slug}'
    r = get(url)
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')

    bg = {
        'name': name,
        'description': '',
        'skill_proficiencies': [],
        'tool_proficiencies': [],
        'languages': 0,
        'equipment': '',
        'gold': '',
        'feature': '',
        'features': [],
        'suggested_characteristics': {},
        'source': '',
    }

    if not content:
        return bg

    # Collect all paragraphs to identify sections
    paras = content.find_all('p')
    all_text = content.get_text('\n', strip=True)

    # --- Source: first para starting with "Source:" ---
    for p in paras:
        t = p.get_text(strip=True)
        if t.startswith('Source:'):
            bg['source'] = t.replace('Source:', '').strip()
            break

    # --- Description: consecutive <strong><em> paragraphs before source ---
    desc_paras = []
    for p in paras:
        t = p.get_text(strip=True)
        if t.startswith('Source:'):
            break
        # Description is usually strong+em paragraphs
        em = p.find('em')
        strong = p.find('strong')
        if (em and strong) or (em and len(t) > 40):
            desc_paras.append(t)
        elif not any(kw in t for kw in ['Skill Proficiencies', 'Tool Proficiencies', 'Languages', 'Equipment']):
            if len(t) > 40 and t[0].isupper():
                desc_paras.append(t)
    if desc_paras:
        bg['description'] = ' '.join(desc_paras)

    # --- Stat block ---
    stat_text = None
    for p in paras:
        t = p.get_text('\n', strip=True)
        if 'Skill Proficiencies' in t:
            stat_text = t
            break

    if stat_text:
        lines = stat_text.split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if line.lower().startswith('skill proficiencies:'):
                raw = _val_or_next_line(line, lines, i)
                bg['skill_proficiencies'] = _parse_skills(raw)
            elif line.lower().startswith('tool proficiencies:'):
                raw = _val_or_next_line(line, lines, i)
                if raw.lower() not in ('none', '—', '-', ''):
                    bg['tool_proficiencies'] = [t.strip() for t in raw.split(',') if t.strip()]
            elif line.lower().startswith('languages:'):
                raw = _val_or_next_line(line, lines, i)
                bg['languages'] = _parse_languages(raw)
            elif line.lower().startswith('equipment:'):
                raw = _collect_equipment(lines, i)
                bg['equipment'] = raw

    # --- Gold: extract from equipment text ---
    if bg['equipment']:
        m = re.search(r'containing\s+(\d+\s*(?:gp|sp|cp|pp))', bg['equipment'], re.IGNORECASE)
        if not m:
            m = re.search(r'(\d+\s*(?:gp|sp|cp|pp))\s+in\s+a\s+pouch', bg['equipment'], re.IGNORECASE)
        if not m:
            m = re.search(r'(\d+\s*(?:gp|sp|cp|pp))', bg['equipment'], re.IGNORECASE)
        if m:
            bg['gold'] = m.group(1)

    # --- Features + Suggested Characteristics ---
    # Find all headings at any depth; parse until the "Suggested Characteristics" section
    all_headings = content.find_all(['h1', 'h2', 'h3', 'h4'])
    found_stat_block = False
    in_suggested = False

    for heading in all_headings:
        text = heading.get_text(strip=True)

        # Skip everything before the stat block
        if not found_stat_block:
            prev = heading.find_previous('p')
            if prev and 'Skill Proficiencies' in prev.get_text():
                found_stat_block = True
            else:
                continue

        # Detect entry into Suggested Characteristics section
        if 'suggested characteristics' in text.lower():
            in_suggested = True
            bg['suggested_characteristics'] = {}
            continue

        if in_suggested:
            key = text.lower().replace(' ', '_')
            if key in ('personality_traits', 'ideals', 'bonds', 'flaws'):
                table = heading.find_next_sibling('table')
                if not table:
                    table = heading.find_next('table')
                if table:
                    rows = _parse_table(table)
                    if len(rows) > 1:
                        die = rows[0][0] if rows[0] else 'd6'
                        entries = [[r[0], r[1]] for r in rows[1:] if len(r) >= 2]
                        bg['suggested_characteristics'][key] = {
                            'die': die,
                            'entries': entries
                        }
            continue

        # Before SC — parse features
        # Skip the generic "Features" section header (h1/h2 exactly "Features")
        if text.lower() == 'features':
            continue
        # Skip Equipment heading if present
        if text.lower() == 'equipment':
            continue

        feature = {
            'name': text,
            'description': '',
            'table': None,
        }

        # Collect following text: walk siblings until next heading or SC
        nxt = heading.find_next_sibling()
        if nxt:
            if nxt.name == 'p':
                t = nxt.get_text(strip=True)
                if t and not t.startswith('Source:'):
                    feature['description'] = t
            if nxt.name == 'table':
                rows = _parse_table(nxt)
                if len(rows) > 1:
                    feature['table'] = {
                        'die': rows[0][0] if rows[0] else '',
                        'entries': [[r[0], r[1]] for r in rows[1:] if len(r) >= 2]
                    }

        bg['features'].append(feature)
        if not bg['feature']:
            bg['feature'] = text

    return bg


def scrape(output_path=None):
    print("Fetching background list from dnd5e.wikidot.com...")
    slugs = get_background_slugs()
    print(f"Found {len(slugs)} backgrounds")

    # Deduplicate: keep last occurrence (prefer non-UA version)
    seen = {}
    deduped = []
    for name, slug in slugs:
        if slug in EXCLUDE_SLUGS:
            continue
        # Skip -ua suffix when a non-UA version already exists
        base = slug.replace('-ua', '')
        if base != slug and base in seen:
            continue
        seen[slug] = True
        deduped.append((name, slug))
    slugs = deduped

    backgrounds = {}
    errors = []

    for i, (name, slug) in enumerate(slugs):
        print(f"  [{i+1}/{len(slugs)}] {name}")
        try:
            bg = parse_background(name, slug)
            backgrounds[slug] = bg
            print(f"    ✓ skills={len(bg['skill_proficiencies'])} features={len(bg['features'])} desc={bool(bg['description'])} sc={bool(bg['suggested_characteristics'])}")
        except Exception as e:
            errors.append(f"{name}: {e}")
            print(f"    Error: {e}")

    if errors:
        print(f"\n{len(errors)} errors:")
        for e in errors[:10]:
            print(f"  {e}")

    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data', 'backgrounds.json'
        )

    with open(output_path, 'w') as f:
        json.dump(backgrounds, f, indent=2, ensure_ascii=False)

    print(f"\nDone: {len(backgrounds)} backgrounds → {output_path}")
    return backgrounds


if __name__ == '__main__':
    scrape()
