"""
Usage: python scripts/scrape_class.py bard
Scrapes dnd5e.wikidot.com for class data and writes data/classes/<class>.json
"""
import requests
from bs4 import BeautifulSoup
import json
import sys
import re
import time
import os

BASE_URL = 'https://dnd5e.wikidot.com'
DELAY = 0.35

ALL_SKILLS = [
    "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
    "History", "Insight", "Intimidation", "Investigation", "Medicine",
    "Nature", "Perception", "Performance", "Persuasion", "Religion",
    "Sleight of Hand", "Stealth", "Survival",
]

ABILITY_MAP = {
    'Strength': 'str', 'Dexterity': 'dex', 'Constitution': 'con',
    'Intelligence': 'int', 'Wisdom': 'wis', 'Charisma': 'cha',
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


def parse_class_page(class_name):
    print(f"  Fetching /{class_name}...")
    r = get(f'{BASE_URL}/{class_name}')
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')
    text = content.get_text() if content else ''

    cls = {
        'key': class_name,
        'name': class_name.capitalize(),
        'hit_die': 8,
        'saving_throws': ['dex', 'cha'],
        'skill_choices': ALL_SKILLS,
        'skill_count': 3,
        'subclasses': {},
        'spells': {},
        'features_by_level': {},
        'spells_known_by_level': {},
        'cantrips_known_by_level': {},
        'spell_slots_by_level': {},
    }

    # Hit die
    m = re.search(r'1d(\d+) per \w+ level', text, re.IGNORECASE)
    if not m:
        m = re.search(r'Hit Dice.*?(\d+)', text, re.IGNORECASE)
    if m:
        cls['hit_die'] = int(m.group(1))

    # Saving throws
    m = re.search(r'Saving Throws?:?\s+([A-Za-z, ]+)', text)
    if m:
        saves = [ABILITY_MAP[a.strip()] for a in m.group(1).split(',')
                 if a.strip() in ABILITY_MAP]
        if saves:
            cls['saving_throws'] = saves

    # Skill count
    m = re.search(r'Choose any (\w+)', text, re.IGNORECASE)
    if m:
        word_map = {'two': 2, 'three': 3, 'four': 4}
        n = m.group(1).lower()
        cls['skill_count'] = word_map.get(n, int(n) if n.isdigit() else 3)

    # Parse class table
    if content:
        _parse_class_table(content, cls)

    # Collect subclass links (exclude UA)
    subclass_links = set()
    for a in (soup.find_all('a') if soup else []):
        href = a.get('href', '')
        if re.match(rf'^/{class_name}:[a-z]', href) and '-ua' not in href:
            subclass_links.add(href)

    return cls, subclass_links


def _parse_class_table(content, cls):
    for table in content.find_all('table'):
        rows = table.find_all('tr')
        if len(rows) < 3:
            continue

        # Row 0 might be a span header ("The Bard" / "Spell Slots per Spell Level")
        # Row 1 should be actual column headers
        header_row_idx = 0
        for i, row in enumerate(rows[:3]):
            cells = [c.get_text().strip().lower() for c in row.find_all(['th', 'td'])]
            if 'level' in cells[0]:
                header_row_idx = i
                break

        if header_row_idx >= len(rows) - 1:
            continue

        headers = [c.get_text().strip().lower()
                   for c in rows[header_row_idx].find_all(['th', 'td'])]

        # Map column positions
        col = {}
        for i, h in enumerate(headers):
            if h == 'level':
                col['level'] = i
            elif 'feature' in h:
                col['features'] = i
            elif 'cantrips known' in h:
                col['cantrips'] = i
            elif 'spells known' in h:
                col['spells_known'] = i
            else:
                m = re.match(r'^(\d+)(?:st|nd|rd|th)$', h)
                if m:
                    col[f'slot_{m.group(1)}'] = i

        if 'features' not in col:
            continue

        for row in rows[header_row_idx + 1:]:
            cells = [c.get_text().strip() for c in row.find_all(['td', 'th'])]
            if not cells:
                continue

            level_cell = cells[col.get('level', 0)]
            m = re.match(r'(\d+)', level_cell)
            if not m:
                continue
            level = str(int(m.group(1)))

            if 'features' in col and col['features'] < len(cells):
                raw = cells[col['features']]
                # Clean up optional features
                raw = re.sub(r'\s*\(Optional\)', '', raw)
                feats = [f.strip() for f in raw.split(',')
                         if f.strip() and f.strip() != '-' and f.strip() != '—']
                cls['features_by_level'][level] = feats

            if 'cantrips' in col and col['cantrips'] < len(cells):
                val = cells[col['cantrips']]
                if val.isdigit():
                    cls['cantrips_known_by_level'][level] = int(val)

            if 'spells_known' in col and col['spells_known'] < len(cells):
                val = cells[col['spells_known']]
                if val.isdigit():
                    cls['spells_known_by_level'][level] = int(val)

            slots = {}
            for key in [k for k in col if k.startswith('slot_')]:
                slot_lvl = key.split('_')[1]
                idx = col[key]
                if idx < len(cells) and cells[idx].isdigit():
                    slots[slot_lvl] = int(cells[idx])
            if slots:
                cls['spell_slots_by_level'][level] = slots

    # Compact cantrips: only store levels where value changes
    prev = None
    compact = {}
    for lvl in sorted(cls['cantrips_known_by_level'], key=int):
        val = cls['cantrips_known_by_level'][lvl]
        if val != prev:
            compact[lvl] = val
            prev = val
    cls['cantrips_known_by_level'] = compact


def parse_subclass(class_name, href):
    print(f"    Fetching subclass {href}...")
    r = get(f'{BASE_URL}{href}')
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')

    key = href.split(':')[1]

    # Derive display name from key or first paragraph
    name = f"College of {key.capitalize()}"
    if content:
        first_p = content.find('p')
        if first_p:
            text = first_p.get_text()
            m = re.search(r'College of (\w+(?: of \w+)*)', text)
            if m:
                name = f"College of {m.group(1)}"

    sub = {
        'name': name,
        'description': '',
        'features_by_level': {},
    }

    if not content:
        return key, sub

    # Description: first non-source paragraph
    for p in content.find_all('p'):
        t = p.get_text().strip()
        if t and not t.startswith('Source:'):
            sub['description'] = t
            break

    # Map each heading to a level by reading the paragraph that follows it
    headings = content.find_all(['h3', 'h4', 'h2'])
    for heading in headings:
        feat_name = heading.get_text().strip()
        if not feat_name:
            continue

        # Collect following paragraphs until next heading
        following_text = ''
        for sib in heading.next_siblings:
            if hasattr(sib, 'name') and sib.name in ['h2', 'h3', 'h4']:
                break
            if hasattr(sib, 'get_text'):
                following_text += ' ' + sib.get_text()

        # Extract level from following text
        level = _extract_level(following_text, feat_name)
        if level:
            sub['features_by_level'].setdefault(level, []).append(feat_name)

    return key, sub


def _extract_level(text, feat_name=''):
    """Extract the level number from a feature description."""
    patterns = [
        r'at (\d+)(?:st|nd|rd|th) level',
        r'Starting at (\d+)(?:st|nd|rd|th) level',
        r'At (\d+)(?:st|nd|rd|th) level',
        r'reach(?:es)? (\d+)(?:st|nd|rd|th) level',
        r'join[^.]+at (\d+)(?:st|nd|rd|th) level',
        r'level (\d+)',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def parse_spell_list(class_name):
    print(f"  Fetching /{class_name}-core spell list...")
    r = get(f'{BASE_URL}/spells:{class_name}-core')
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')
    slugs = []
    for a in (content.find_all('a') if content else []):
        href = a.get('href', '')
        if re.match(r'^/spell:[a-z0-9]', href) and '-ua' not in href:
            slug = href.split(':')[1]
            if slug not in slugs:
                slugs.append(slug)
    return slugs


def parse_spell(slug):
    r = get(f'{BASE_URL}/spell:{slug}')
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')

    name = slug.replace('-', ' ').title()
    # Fix common title casing
    for pat, rep in [("Of ", "of "), ("The ", "the "), ("'S ", "'s ")]:
        name = name.replace(pat, rep)
    name = name[0].upper() + name[1:]

    level = 0
    school = ''
    description = ''

    if content:
        paras = content.find_all('p')
        # p0 = source, p1 = "Xth-level school" or "School cantrip", p2 = stat block, p3+ = desc
        level_para = None
        desc_start = 3
        for i, p in enumerate(paras[:5]):
            t = p.get_text().strip()
            if re.search(r'cantrip|level \w+|th-level|st-level|nd-level|rd-level', t, re.IGNORECASE) \
               and not t.startswith('Source') and not t.startswith('Casting'):
                level_para = t
                desc_start = i + 2  # skip stat block
                break

        if level_para:
            m_cantrip = re.search(r'(\w+)\s+cantrip', level_para, re.IGNORECASE)
            m_level = re.search(r'(\d+)(?:st|nd|rd|th).level\s+(\w+)', level_para, re.IGNORECASE)
            if m_cantrip:
                level = 0
                school = m_cantrip.group(1).capitalize()
            elif m_level:
                level = int(m_level.group(1))
                school = m_level.group(2).capitalize()

        # Description paragraphs
        desc_parts = []
        for p in paras[desc_start:]:
            t = p.get_text().strip()
            if re.match(r'At Higher Levels', t, re.IGNORECASE):
                break
            if re.match(r'Spell Lists?|Source:', t, re.IGNORECASE):
                continue
            if t:
                desc_parts.append(t)
            if len(desc_parts) >= 2:
                break

        description = ' '.join(desc_parts).strip()[:500]

    return {'name': name, 'level': level, 'school': school, 'description': description}


def scrape(class_name='bard', output_path=None):
    print(f"Scraping class: {class_name}")

    cls, subclass_links = parse_class_page(class_name)

    # Subclasses
    print(f"  {len(subclass_links)} subclass pages found")
    for href in sorted(subclass_links):
        try:
            key, sub = parse_subclass(class_name, href)
            cls['subclasses'][key] = sub
            print(f"    ✓ {sub['name']} ({len(sub['features_by_level'])} levels mapped)")
        except Exception as e:
            print(f"    ✗ {href}: {e}")

    # Spells
    slugs = parse_spell_list(class_name)
    print(f"  {len(slugs)} spells to fetch")

    for i, slug in enumerate(slugs):
        try:
            spell = parse_spell(slug)
            cls['spells'][slug] = spell
            if (i + 1) % 20 == 0:
                print(f"    {i+1}/{len(slugs)} spells done...")
        except Exception as e:
            print(f"    ✗ {slug}: {e}")

    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data', 'classes', f'{class_name}.json'
        )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(cls, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Done: {len(cls['spells'])} spells, {len(cls['subclasses'])} subclasses")
    print(f"  features_by_level: {len(cls['features_by_level'])} levels")
    print(f"  spell_slots_by_level: {len(cls['spell_slots_by_level'])} levels")
    print(f"  Saved to: {output_path}")
    return cls


if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'bard'
    scrape(name)
