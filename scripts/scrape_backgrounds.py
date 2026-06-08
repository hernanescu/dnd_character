"""
Usage: python scripts/scrape_backgrounds.py
Scrapes backgrounds from dnd5e.wikidot.com and writes data/backgrounds.json
"""
import requests
from bs4 import BeautifulSoup
import json
import re
import time
import os

LIST_URL = 'http://dnd2014.wikidot.com/backgrounds'
DETAIL_BASE = 'https://dnd5e.wikidot.com'
DELAY = 0.35


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
    """Get list of background slugs from the dnd2014 listing page."""
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


def parse_background(name, slug):
    url = f'{DETAIL_BASE}/background:{slug}'
    r = get(url)
    soup = BeautifulSoup(r.text, 'html.parser')
    content = soup.select_one('#page-content')

    bg = {
        'name': name,
        'skill_proficiencies': [],
        'tool_proficiencies': [],
        'languages': 0,
        'feature': '',
    }

    if not content:
        return bg

    # Find the stat block paragraph: contains "Skill Proficiencies:"
    stat_block = None
    for p in content.find_all('p'):
        if 'Skill Proficiencies' in p.get_text():
            stat_block = p.get_text()
            break

    if stat_block:
        for line in stat_block.split('\n'):
            line = line.strip()
            if line.lower().startswith('skill proficiencies:'):
                raw = line.split(':', 1)[1].strip()
                bg['skill_proficiencies'] = _parse_skill_list(raw)
            elif line.lower().startswith('tool proficiencies:'):
                raw = line.split(':', 1)[1].strip()
                if raw.lower() not in ('none', '—', '-', ''):
                    bg['tool_proficiencies'] = [t.strip() for t in raw.split(',') if t.strip()]
            elif line.lower().startswith('languages:'):
                raw = line.split(':', 1)[1].strip()
                bg['languages'] = _parse_languages(raw)

    # Feature: first heading before "Personality Traits"
    for h in content.find_all(['h3', 'h4', 'h2']):
        text = h.get_text().strip()
        if text.lower() in ('personality traits', 'ideals', 'bonds', 'flaws',
                             'suggested characteristics', 'variant', 'feature'):
            break
        if text and text.lower() not in ('description', 'equipment'):
            bg['feature'] = text
            break

    return bg


def _parse_skill_list(text):
    if not text or text.lower() in ('none', '—', '-'):
        return []
    # Some have "Choose two from X, Y, Z"
    if 'choose' in text.lower():
        return []  # flexible, marked as empty
    items = re.split(r',\s*(?:and\s+)?', text)
    return [i.strip().rstrip('.') for i in items if i.strip() and i.strip().lower() != 'none']


def _parse_languages(text):
    if not text or text.lower() in ('none', '—', '-'):
        return 0
    m = re.search(r'\b(one|two|three|1|2|3)\b', text, re.IGNORECASE)
    if m:
        word_map = {'one': 1, 'two': 2, 'three': 3}
        n = m.group(1).lower()
        return word_map.get(n, int(n) if n.isdigit() else 1)
    if 'any' in text.lower():
        return 1
    return 0


def scrape(output_path=None):
    print("Fetching background list...")
    slugs = get_background_slugs()
    print(f"Found {len(slugs)} backgrounds")

    backgrounds = {}
    errors = []

    for i, (name, slug) in enumerate(slugs):
        print(f"  [{i+1}/{len(slugs)}] {name}")
        try:
            bg = parse_background(name, slug)
            if bg['skill_proficiencies']:
                backgrounds[slug] = bg
            else:
                print(f"    Skipped (no skills parsed)")
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
