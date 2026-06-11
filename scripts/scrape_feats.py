"""
Usage: python scripts/scrape_feats.py
Scrapes dnd5e.wikidot.com feat pages and writes data/feats.json.

The feat list is read from the homepage "Feats" section (#toc70): Published
plus the setting groups (Planescape, Strixhaven, Dragonlance, Plane Shift).
Unearthed Arcana and Homebrew are skipped.

Half-feats ("Increase your Strength or Dexterity score by 1") get a
structured `asi` field so the app can actually apply the bonus:
  asi: {"choices": ["str", "dex"] | "any", "points": 1}
"""
import json
import os
import re
import time

import requests
from bs4 import BeautifulSoup

BASE_URL = 'https://dnd5e.wikidot.com'
DELAY = 0.35

SKIP_CATEGORIES = {'unearthed arcana', 'homebrew'}

# 'consititution' is a typo on the site (Tavern Brawler)
ABILITIES = {'strength': 'str', 'dexterity': 'dex', 'constitution': 'con',
             'consititution': 'con', 'intelligence': 'int', 'wisdom': 'wis',
             'charisma': 'cha'}
ABILITY_RE = r'(?:strength|dexterity|consitit?ution|constitution|intelligence|wisdom|charisma)'


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


def feat_index():
    """Read the homepage Feats section (#toc70): [(slug, name, category)]."""
    r = get(BASE_URL)
    soup = BeautifulSoup(r.text, 'html.parser')
    start = soup.find('h1', id='toc70')
    feats, category = [], None
    for el in start.find_all_next(['h1', 'h6', 'a']):
        if el.name == 'h1':  # next section (Racial Feats)
            break
        if el.name == 'h6':
            label = el.get_text(strip=True)
            if label and label != '.':  # '.' marks a continuation column
                category = label.lower().replace(' ', '-')
            continue
        href = el.get('href', '')
        if href.startswith('/feat:') and category not in SKIP_CATEGORIES:
            feats.append((href[len('/feat:'):], el.get_text(strip=True), category))
    return feats


def parse_asi(text):
    """Half-feat ASI from a benefit line. Returns None if the line has none."""
    t = text.lower()
    # "score" is missing on some pages (Crusher: "Increase your Strength or
    # Constitution by 1")
    m = re.search(r'increase (?:your )?((?:' + ABILITY_RE + r'(?:,? or |, )?)+)'
                  r'(?: score)? by (\d)', t)
    if m:
        choices = [ABILITIES[a] for a in re.findall(ABILITY_RE, m.group(1))]
        return {'choices': choices, 'points': int(m.group(2))}
    m = re.search(r'increase (?:the chosen ability score|(?:one|an) ability score of your choice)'
                  r' by (\d)', t)
    if m:
        return {'choices': 'any', 'points': int(m.group(1))}
    return None


def table_to_text(table):
    rows = []
    for tr in table.find_all('tr'):
        cells = [c.get_text(' ', strip=True) for c in tr.find_all(['th', 'td'])]
        rows.append(' — '.join(cells))
    return ' | '.join(rows)


def parse_feat(slug, name, category):
    print(f'  Fetching /feat:{slug}...')
    r = get(f'{BASE_URL}/feat:{slug}')
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')

    source, prerequisite = '', ''
    desc_parts, benefits = [], []
    for el in content.find_all(['p', 'ul', 'ol', 'table'], recursive=False):
        if el.name == 'p':
            txt = el.get_text(' ', strip=True)
            low = txt.lower()
            if low.startswith('source:'):
                source = txt[len('source:'):].strip()
            elif low.startswith('prerequisite'):
                prerequisite = txt.split(':', 1)[1].strip() if ':' in txt else txt
            elif txt:
                desc_parts.append(txt)
        elif el.name in ('ul', 'ol'):
            for li in el.find_all('li', recursive=False):
                benefits.append(li.get_text(' ', strip=True))
        elif el.name == 'table':
            target = benefits if benefits else desc_parts
            if target:
                target[-1] += ' [' + table_to_text(el) + ']'

    entry = {
        'name': name, 'category': category, 'source': source,
        'page': f'feat:{slug}', 'desc': ' '.join(desc_parts),
        'benefits': benefits,
    }
    if prerequisite:
        entry['prerequisite'] = prerequisite
    # prose-only feats (Planescape) keep the ASI line inside desc
    for line in benefits + [entry['desc']]:
        asi = parse_asi(line)
        if asi:
            entry['asi'] = asi
            break
    return entry


def main():
    index = feat_index()
    print(f'{len(index)} feats listed')
    out = {}
    for slug, name, category in index:
        key = slug.replace('-', '_')
        out[key] = parse_feat(slug, name, category)

    problems = []
    for key, f in out.items():
        if not f['source']:
            problems.append(f'{key}: no source')
        if not f['benefits'] and not f['desc']:
            problems.append(f'{key}: empty body')
        body = (' '.join(f['benefits']) + ' ' + f['desc']).lower()
        if re.search(r'increase (?:your|an|one|the)\b.{0,80}\bby 1', body) \
                and not f.get('asi'):
            problems.append(f'{key}: looks like a half-feat but no asi parsed')
    if problems:
        print('\nWARNINGS:')
        for p in problems:
            print(' ', p)

    path = os.path.join(os.path.dirname(__file__), '..', 'data', 'feats.json')
    with open(path, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print(f'\nWrote {len(out)} feats to data/feats.json')


if __name__ == '__main__':
    main()
