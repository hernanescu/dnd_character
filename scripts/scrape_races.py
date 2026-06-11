"""
Usage: python scripts/scrape_races.py
Scrapes dnd5e.wikidot.com lineage pages (Common + Exotic) and writes data/races.json.
The app keeps the old name "race" everywhere even though the site says "species/lineage".

For each page only the FIRST sourcebook section (h1) is used — that is the primary
source (PHB for common races, Monsters of the Multiverse for most exotic ones).
Subraces (h2 inside that section) are flattened into separate race entries whose
keys match the ones the builder already used (elf_high, dwarf_hill, ...).
"""
import json
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

BASE_URL = 'https://dnd5e.wikidot.com'
DELAY = 0.35

COMMON = ['dragonborn', 'dwarf', 'elf', 'gnome', 'half-elf', 'half-orc',
          'halfling', 'human', 'tiefling']
EXOTIC = ['aarakocra', 'aasimar', 'changeling', 'deep-gnome', 'duergar',
          'eladrin', 'fairy', 'firbolg', 'genasi-air', 'genasi-earth',
          'genasi-fire', 'genasi-water', 'githyanki', 'githzerai', 'goliath',
          'harengon', 'kenku', 'locathah', 'owlin', 'satyr', 'sea-elf',
          'shadar-kai', 'tabaxi', 'tortle', 'triton', 'verdan']

ABILITIES = {'strength': 'str', 'dexterity': 'dex', 'constitution': 'con',
             'intelligence': 'int', 'wisdom': 'wis', 'charisma': 'cha'}
WORD_NUM = {'one': 1, 'two': 2, 'three': 3}

# (page slug, subrace heading) -> (race key, display name). Keys the builder
# already shipped with are preserved so existing characters keep resolving.
SUBRACE_KEYS = {
    ('elf', 'dark elf'): ('drow', 'Drow'),
    ('elf', 'high elf'): ('elf_high', 'High Elf'),
    ('elf', 'wood elf'): ('elf_wood', 'Wood Elf'),
    ('dwarf', 'hill dwarf'): ('dwarf_hill', 'Hill Dwarf'),
    ('dwarf', 'mountain dwarf'): ('dwarf_mtn', 'Mountain Dwarf'),
    ('gnome', 'forest gnome'): ('gnome', 'Forest Gnome'),
    ('gnome', 'forest'): ('gnome', 'Forest Gnome'),
    ('gnome', 'rock gnome'): ('gnome_rock', 'Rock Gnome'),
    ('gnome', 'rock'): ('gnome_rock', 'Rock Gnome'),
    ('halfling', 'lightfoot'): ('halfling', 'Lightfoot Halfling'),
    ('halfling', 'stout'): ('halfling_stout', 'Stout Halfling'),
    ('human', 'variant human traits'): ('human_variant', 'Variant Human'),
    ('human', 'variant human'): ('human_variant', 'Variant Human'),
    ('human', 'variant'): ('human_variant', 'Variant Human'),
    ('tiefling', 'bloodline of asmodeus'): ('tiefling', 'Tiefling'),
}
# pages where the base section is itself a playable race even though subraces follow
EMIT_BASE = {'human'}
BASE_KEYS = {  # pages without subraces, or the base entry name
    'half-elf': ('half_elf', 'Half-Elf'),
    'half-orc': ('half_orc', 'Half-Orc'),
    'deep-gnome': ('deep_gnome', 'Deep Gnome'),
    'sea-elf': ('sea_elf', 'Sea Elf'),
    'shadar-kai': ('shadar_kai', 'Shadar-Kai'),
    'genasi-air': ('genasi_air', 'Genasi (Air)'),
    'genasi-earth': ('genasi_earth', 'Genasi (Earth)'),
    'genasi-fire': ('genasi_fire', 'Genasi (Fire)'),
    'genasi-water': ('genasi_water', 'Genasi (Water)'),
}


def get(url, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
            r.raise_for_status()
            time.sleep(DELAY)
            return r
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(2)


def parse_asi(text):
    """Turn an Ability Score Increase paragraph into structured data."""
    t = text.lower()
    out = {}
    # MPMM-style: "+2/+1 to any, or +1/+1/+1" (Strixhaven phrases it without
    # the three-by-one alternative)
    if ('increase one score by 2' in t and 'three different scores by 1' in t) or \
            re.search(r'increase one ability score by 2,? and increase a different one by 1', t):
        out['flexible_asi'] = True
        return out
    if re.search(r'ability scores? each increase', t):  # PHB human
        out['asi'] = {a: 1 for a in ABILITIES.values()}
        return out
    asi = {}
    for m in re.finditer(r'(strength|dexterity|constitution|intelligence|wisdom|charisma)'
                         r' score increases by (\d)', t):
        asi[ABILITIES[m.group(1)]] = int(m.group(2))
    if asi:
        out['asi'] = asi
    # "two other ability scores of your choice each increase by 1" (half-elf)
    m = re.search(r'(one|two|three) other ability scores? of your choice (?:each )?increase', t)
    # "two different ability scores of your choice increase by 1" (variant human)
    m2 = re.search(r'(one|two|three) different ability scores? of your choice (?:each )?increase by 1', t)
    if m:
        out['flexAsi'] = {'count': WORD_NUM[m.group(1)], 'points': 1,
                          'exclude': sorted(asi.keys())}
    elif m2 and not asi:
        out['flexAsi'] = {'count': WORD_NUM[m2.group(1)], 'points': 1, 'exclude': []}
    return out


def parse_traits_meta(traits):
    """Extract speed/size/skills/asi metadata from a trait list."""
    meta = {}
    for tr in traits:
        name, desc = tr['name'].lower(), tr['desc']
        d = desc.lower()
        if name.startswith('ability score increase'):
            meta.update(parse_asi(desc))
            meta['asi_text'] = desc
        m = re.search(r'walking speed is (\d+) feet', d)
        if m:
            meta['speed'] = int(m.group(1))
        # speed overrides only from dedicated speed traits (avoids nested
        # variant text like Half-Elf Versatility's "Fleet of Foot" option)
        if name in ('speed', 'fleet of foot'):
            m = re.search(r'walking speed increases to (\d+) feet', d)
            if m:
                meta['speed'] = int(m.group(1))
        if name == 'size':
            m = re.search(r'your size is (medium or small|medium|small)', d) or \
                re.search(r'you are (?:a )?(medium or small|medium|small)\b', d)
            if m:
                size = m.group(1).title()
                meta['size'] = 'Medium or Small' if 'Or' in size else size
        for m in re.finditer(r'proficiency in the ([a-z ]+?) skills?\b', d):
            for skill in m.group(1).split(' and '):
                meta.setdefault('skills', []).append(skill.strip().title())
        m = re.search(r'proficiency in (one|two) skills? of your choice', d)
        if m:
            meta['bonusSkills'] = {'count': WORD_NUM[m.group(1)]}
    return meta


DROP_TRAITS = {'ability score increase', 'age', 'alignment', 'size', 'speed',
               'creature type', 'languages'}


def clean_traits(traits):
    return [t for t in traits if t['name'].lower().rstrip('.') not in DROP_TRAITS]


def table_to_text(table):
    rows = []
    for tr in table.find_all('tr'):
        cells = [c.get_text(' ', strip=True) for c in tr.find_all(['th', 'td'])]
        rows.append(' — '.join(cells))
    return ' | '.join(rows)


def parse_section(elements):
    """elements: tags between two headings. Returns (desc, traits)."""
    desc_parts, traits = [], []
    for el in elements:
        if el.name == 'p':
            txt = el.get_text(' ', strip=True)
            if txt and not txt.lower().startswith('source:'):
                desc_parts.append(txt)
        elif el.name in ('ul', 'ol'):
            for li in el.find_all('li', recursive=False):
                strong = li.find('strong')
                if not strong:
                    continue
                name = strong.get_text(strip=True).rstrip('.')
                full = li.get_text(' ', strip=True)
                desc = full[len(strong.get_text(strip=True)):].strip()
                traits.append({'name': name, 'desc': desc})
        elif el.name == 'table' and traits:
            traits[-1]['desc'] += ' [' + table_to_text(el) + ']'
    return (desc_parts[0] if desc_parts else ''), traits


def parse_lineage(slug, category):
    print(f'  Fetching /lineage:{slug}...')
    r = get(f'{BASE_URL}/lineage:{slug}')
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')

    # collect the first h1 (primary source) section, split by h2 subraces
    h1 = content.find('h1')
    chunks = [('', [])]  # (subrace heading, elements)
    if h1 is None:
        # single-source page with no headings (locathah, owlin, verdan)
        source = ''
        for el in content.find_all(['p', 'ul', 'ol', 'table'], recursive=False):
            txt = el.get_text(' ', strip=True)
            if el.name == 'p' and txt.lower().startswith('source:'):
                source = txt[7:].strip()
            chunks[-1][1].append(el)
    else:
        source = h1.get_text(strip=True)
        for el in h1.find_next_siblings():
            if el.name == 'h1':
                break
            if el.name == 'h2':
                chunks.append((el.get_text(strip=True), []))
            else:
                chunks[-1][1].append(el)

    base_key, base_name = BASE_KEYS.get(
        slug, (slug.replace('-', '_'), slug.replace('-', ' ').title()))
    base_desc, base_traits = parse_section(chunks[0][1])
    base_meta = parse_traits_meta(base_traits)

    def build(key, name, desc, traits, meta, subrace_of=None):
        entry = {
            'name': name, 'category': category, 'source': source,
            'page': f'lineage:{slug}', 'desc': desc,
            'size': meta.get('size', 'Medium'), 'speed': meta.get('speed', 30),
            'asi_text': meta.get('asi_text', ''),
            'traits': clean_traits(traits),
        }
        if meta.get('asi'):
            entry['asi'] = meta['asi']
        if meta.get('flexAsi'):
            entry['flexAsi'] = meta['flexAsi']
        if meta.get('flexible_asi'):
            entry['flexible_asi'] = True
        if meta.get('skills'):
            entry['skills'] = meta['skills']
        if meta.get('bonusSkills'):
            entry['bonusSkills'] = meta['bonusSkills']
        if subrace_of:
            entry['subrace_of'] = subrace_of
        return entry

    races = {}
    subraces = [c for c in chunks[1:] if c[0]]
    if not subraces or slug in EMIT_BASE:
        races[base_key] = build(base_key, base_name, base_desc, base_traits, base_meta)
    if not subraces:
        return races

    for heading, els in subraces:
        lookup = SUBRACE_KEYS.get((slug, heading.lower()))
        if lookup is None:
            # unmapped subrace in the primary section — derive a key
            sub_slug = re.sub(r'[^a-z0-9]+', '_', heading.lower()).strip('_')
            lookup = (f'{base_key}_{sub_slug}', heading)
        key, name = lookup
        s_desc, s_traits = parse_section(els)
        s_meta = parse_traits_meta(s_traits)
        merged = dict(base_meta)
        merged.update({k: v for k, v in s_meta.items() if k not in ('asi', 'skills')})
        if s_meta.get('flexAsi') or s_meta.get('flexible_asi'):
            # the subrace's ASI replaces the base one (variant human)
            merged['asi'] = s_meta.get('asi', {})
        else:
            merged['asi'] = {**base_meta.get('asi', {}), **s_meta.get('asi', {})}
        merged['skills'] = base_meta.get('skills', []) + s_meta.get('skills', [])
        if not merged['skills']:
            merged.pop('skills')
        if base_meta.get('asi_text') and s_meta.get('asi_text'):
            merged['asi_text'] = base_meta['asi_text'] + ' ' + s_meta['asi_text']
        races[key] = build(key, name, s_desc or base_desc,
                           base_traits + s_traits, merged, subrace_of=base_name)
    return races


def main():
    out = {}
    for slug in COMMON:
        out.update(parse_lineage(slug, 'common'))
    for slug in EXOTIC:
        out.update(parse_lineage(slug, 'exotic'))

    # sanity report
    problems = []
    for key, r in out.items():
        if not r.get('asi') and not r.get('flexAsi') and not r.get('flexible_asi'):
            problems.append(f"{key}: no parsed ASI ({r.get('asi_text', '')[:80]!r})")
        if not r['traits'] and key != 'human':  # PHB human legitimately has none
            problems.append(f'{key}: no traits')
    if problems:
        print('\nWARNINGS:')
        for p in problems:
            print(' ', p)

    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'races.json')
    with open(path, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(f'\nWrote {len(out)} races to data/races.json')


if __name__ == '__main__':
    main()
