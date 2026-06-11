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
        'feature_descriptions': {},
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

    # Spellcasting ability
    m = re.search(r'Spellcasting Ability\s*\n\s*(\w+)', text, re.IGNORECASE)
    if m:
        ability = m.group(1).capitalize()
        if ability in ABILITY_MAP:
            cls['spellcasting_ability'] = ABILITY_MAP[ability]

    # Parse class table
    if content:
        _parse_class_table(content, cls)
        _parse_feature_descriptions(content, cls)

    # Collect subclass links (exclude UA) — handle both relative and absolute URLs
    subclass_links = set()
    pat_rel = re.compile(rf'^/{class_name}:([a-z][a-z0-9-]+)$')
    pat_abs = re.compile(rf'^https?://dnd5e\.wikidot\.com/{class_name}:([a-z][a-z0-9-]+)$')
    for a in (soup.find_all('a') if soup else []):
        href = a.get('href', '')
        if '-ua' in href:
            continue
        m = pat_rel.match(href) or pat_abs.match(href)
        if m:
            subclass_links.add(f'/{class_name}:{m.group(1)}')

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
            elif h == 'spell slots':
                col['pact_slots'] = i
            elif h == 'slot level':
                col['pact_level'] = i
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
            # Warlock pact magic: "Spell Slots" + "Slot Level" columns
            if not slots and 'pact_slots' in col and 'pact_level' in col:
                si, li = col['pact_slots'], col['pact_level']
                if si < len(cells) and li < len(cells) and cells[si].isdigit():
                    m2 = re.match(r'(\d+)', cells[li])
                    if m2:
                        slots = {m2.group(1): int(cells[si])}
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


def _parse_feature_descriptions(content, cls):
    for h in content.find_all(['h3', 'h4']):
        name = h.get_text().strip()
        if not name or len(name) > 50:
            continue
        desc_parts = []
        n = h.find_next_sibling()
        while n and n.name not in ('h3', 'h4', 'h2', 'h1'):
            if n.name == 'p':
                t = n.get_text().strip()
                if t and not t.startswith('Source:'):
                    desc_parts.append(t)
            n = n.find_next_sibling()
        desc = ' '.join(desc_parts).strip()[:2000]
        if desc:
            cls['feature_descriptions'][name] = desc


_CAP_WORD = r'[A-Z][a-z\']+'
_OPT_THE = r'(?:[Tt]he\s+)?'
_NAME_TAIL = rf'(?:\s+{_CAP_WORD}){{0,4}}'
_SUBCLASS_NAME_PATTERNS = [
    rf'(College of {_OPT_THE}{_CAP_WORD}{_NAME_TAIL})',
    rf'(Path of {_OPT_THE}{_CAP_WORD}{_NAME_TAIL})',
    rf'(Circle of {_OPT_THE}{_CAP_WORD}{_NAME_TAIL})',
    rf'(Oath of {_OPT_THE}{_CAP_WORD}{_NAME_TAIL})',
    rf'(Way of {_OPT_THE}{_CAP_WORD}{_NAME_TAIL})',
    rf'(School of {_OPT_THE}{_CAP_WORD}{_NAME_TAIL})',
    rf'(Order of {_OPT_THE}{_CAP_WORD}{_NAME_TAIL})',
    rf'({_CAP_WORD}{_NAME_TAIL}\s+Domain)',
    rf'({_CAP_WORD}{_NAME_TAIL}\s+Bloodline)',
    rf'(The {_CAP_WORD}{_NAME_TAIL})',
]


def _subclass_display_name(key, soup):
    """Try page title element first, then text patterns, then title-case the key."""
    title_el = soup.find(id='page-title') or soup.find(class_='page-title')
    if title_el:
        t = title_el.get_text().strip()
        if t:
            return t
    text = soup.get_text()[:3000]
    for pat in _SUBCLASS_NAME_PATTERNS:
        m = re.search(pat, text)
        if m:
            return m.group(1).strip()
    return key.replace('-', ' ').title()


def parse_subclass(class_name, href):
    print(f"    Fetching subclass {href}...")
    r = get(f'{BASE_URL}{href}')
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')

    key = href.split(':')[1]
    name = _subclass_display_name(key, soup)

    sub = {
        'name': name,
        'description': '',
        'features_by_level': {},
        'feature_descriptions': {},
    }

    if not content:
        return key, sub

    # Description: first non-source paragraph
    for p in content.find_all('p'):
        t = p.get_text().strip()
        if t and not t.startswith('Source:'):
            sub['description'] = t[:500]
            break

    # Walk headings: collect level mapping AND description for each feature
    for heading in content.find_all(['h2', 'h3', 'h4']):
        feat_name = heading.get_text().strip()
        if not feat_name or len(feat_name) > 60:
            continue

        following_text = ''
        desc_parts = []
        for sib in heading.next_siblings:
            if hasattr(sib, 'name') and sib.name in ['h2', 'h3', 'h4']:
                break
            if hasattr(sib, 'get_text'):
                t = sib.get_text()
                following_text += ' ' + t
                if hasattr(sib, 'name') and sib.name == 'p':
                    clean = t.strip()
                    if clean and not clean.startswith('Source:'):
                        desc_parts.append(clean)

        level = _extract_level(following_text, feat_name)
        if level:
            sub['features_by_level'].setdefault(level, []).append(feat_name)

        desc = ' '.join(desc_parts).strip()[:2000]
        if desc:
            sub['feature_descriptions'][feat_name] = desc

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
    print(f"  Fetching /{class_name} spell list...")
    r = get(f'{BASE_URL}/spells:{class_name}')
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
    for pat, rep in [("Of ", "of "), ("The ", "the "), ("'S ", "'s ")]:
        name = name.replace(pat, rep)
    name = name[0].upper() + name[1:]

    spell = {
        'name': name,
        'level': 0,
        'school': '',
        'ritual': False,
        'concentration': False,
        'casting_time': '',
        'range': '',
        'components': '',
        'material': '',
        'duration': '',
        'description': '',
        'higher_levels': '',
    }

    if content:
        paras = content.find_all('p')

        # Level/school/ritual — find the para that has level info
        level_para = None
        stat_idx = None
        desc_start = 3
        for i, p in enumerate(paras[:6]):
            t = p.get_text().strip()
            if re.search(r'(?:th|st|nd|rd).level|cantrip', t, re.IGNORECASE) \
               and not t.startswith('Source') and not t.startswith('Casting'):
                level_para = t
                stat_idx = i + 1
                desc_start = stat_idx + 1
                break

        if level_para:
            m_cantrip = re.search(r'(\w+)\s+cantrip', level_para, re.IGNORECASE)
            m_level = re.search(r'(\d+)(?:st|nd|rd|th).level\s+(\w+)', level_para, re.IGNORECASE)
            if m_cantrip:
                spell['level'] = 0
                spell['school'] = m_cantrip.group(1).capitalize()
            elif m_level:
                spell['level'] = int(m_level.group(1))
                spell['school'] = m_level.group(2).capitalize()
            spell['ritual'] = '(ritual)' in level_para.lower()

        # Stat block (casting_time, range, components, duration)
        if stat_idx is not None and stat_idx < len(paras):
            stat_text = paras[stat_idx].get_text()
            for line in stat_text.split('\n'):
                line = line.strip()
                if line.lower().startswith('casting time:'):
                    spell['casting_time'] = line[len('Casting Time:'):].strip()
                elif line.lower().startswith('range:'):
                    spell['range'] = line[len('Range:'):].strip()
                elif line.lower().startswith('components:'):
                    comp = line[len('Components:'):].strip()
                    # Extract material component (text in parentheses)
                    m = re.search(r'\((.+?)\)', comp)
                    if m:
                        spell['material'] = m.group(1)
                        comp = comp[:m.start()].strip().rstrip(',')
                    spell['components'] = comp
                elif line.lower().startswith('duration:'):
                    dur = line[len('Duration:'):].strip()
                    spell['duration'] = dur
                    spell['concentration'] = 'concentration' in dur.lower()

        # Description
        desc_parts = []
        higher_parts = []
        in_higher = False
        for p in paras[desc_start:]:
            t = p.get_text().strip()
            if not t or t.startswith('Spell Lists') or t.startswith('Source:'):
                continue
            if re.match(r'At Higher Levels', t, re.IGNORECASE):
                in_higher = True
                higher_parts.append(t)
                continue
            if in_higher:
                higher_parts.append(t)
            else:
                desc_parts.append(t)

        spell['description'] = ' '.join(desc_parts).strip()
        if higher_parts:
            spell['higher_levels'] = ' '.join(higher_parts).strip()

    return spell


def scrape(class_name='bard', output_path=None):
    print(f"Scraping class: {class_name}")

    cls, subclass_links = parse_class_page(class_name)

    # Preserve feature_choices injected by scrape_choices.py across re-scrapes
    existing_path = output_path or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'data', 'classes', f'{class_name}.json'
    )
    prev_choices, prev_sub_choices = {}, {}
    if os.path.isfile(existing_path):
        with open(existing_path) as f:
            prev = json.load(f)
        prev_choices = prev.get('feature_choices') or {}
        prev_sub_choices = {k: v.get('feature_choices') for k, v in (prev.get('subclasses') or {}).items()
                            if v.get('feature_choices')}
    if prev_choices:
        cls['feature_choices'] = prev_choices

    # Subclasses
    print(f"  {len(subclass_links)} subclass pages found")
    for href in sorted(subclass_links):
        try:
            key, sub = parse_subclass(class_name, href)
            if key in prev_sub_choices:
                sub['feature_choices'] = prev_sub_choices[key]
            cls['subclasses'][key] = sub
            print(f"    ✓ {sub['name']} ({len(sub['features_by_level'])} levels mapped)")
        except Exception as e:
            print(f"    ✗ {href}: {e}")

    # Spells — load existing central spells, update with new ones
    spells_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        'data', 'spells.json'
    )
    all_spells = {}
    if os.path.isfile(spells_path):
        with open(spells_path) as f:
            all_spells = json.load(f)

    slugs = []
    try:
        slugs = parse_spell_list(class_name)
        print(f"  {len(slugs)} spells to fetch")
    except Exception as e:
        print(f"  No spell list found ({e})")

    for i, slug in enumerate(slugs):
        try:
            # Skip re-fetch if already enriched (has components field)
            if slug in all_spells and 'components' in all_spells[slug]:
                if class_name not in all_spells[slug]['classes']:
                    all_spells[slug]['classes'].append(class_name)
                continue

            spell = parse_spell(slug)
            if slug not in all_spells:
                all_spells[slug] = spell
                all_spells[slug]['classes'] = []
            else:
                all_spells[slug].update({k: v for k, v in spell.items() if k != 'classes'})
            if class_name not in all_spells[slug]['classes']:
                all_spells[slug]['classes'].append(class_name)
            if (i + 1) % 20 == 0:
                print(f"    {i+1}/{len(slugs)} spells done...")
        except Exception as e:
            print(f"    ✗ {slug}: {e}")

    cls['spells'] = slugs

    # Write spells.json
    with open(spells_path, 'w') as f:
        json.dump(all_spells, f, indent=2, ensure_ascii=False)

    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            'data', 'classes', f'{class_name}.json'
        )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(cls, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Done: {len(cls['spells'])} spell slugs, {len(cls['subclasses'])} subclasses")
    print(f"  features_by_level: {len(cls['features_by_level'])} levels")
    print(f"  spell_slots_by_level: {len(cls['spell_slots_by_level'])} levels")
    print(f"  Saved to: {output_path}")
    print(f"  Central spells: {len(all_spells)} unique spells")
    return cls


if __name__ == '__main__':
    name = sys.argv[1] if len(sys.argv) > 1 else 'bard'
    scrape(name)
