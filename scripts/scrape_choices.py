"""
Scrapes sub-choice options for D&D 5e features and injects them into class JSONs
as feature_choices at class level or subclass level.

Run: python scripts/scrape_choices.py
"""
import requests
from bs4 import BeautifulSoup
import json, time, os, re

BASE_URL = 'https://dnd5e.wikidot.com'
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
DELAY = 0.35


def get(url, retries=3):
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
            r.raise_for_status()
            time.sleep(DELAY)
            return BeautifulSoup(r.text, 'html.parser')
        except Exception as e:
            if attempt == retries - 1:
                raise
            time.sleep(2)


def load_class(cls):
    path = os.path.join(DATA_DIR, 'classes', f'{cls}.json')
    with open(path) as f:
        return json.load(f)


def save_class(cls, data):
    path = os.path.join(DATA_DIR, 'classes', f'{cls}.json')
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f'  Saved {cls}.json')


# ─── Pattern A: each option is its own <ul> (fighting styles, metamagic) ─────
def parse_per_ul_options(content, heading_text):
    """One <ul><li>Name (src). Desc</li></ul> per option after heading."""
    options = []
    found = False
    for el in content.find_all(['h3', 'h4', 'ul']):
        if el.name in ('h3', 'h4'):
            if heading_text in el.get_text():
                found = True
            elif found:
                break
            continue
        if not found:
            continue
        # Skip nested uls (inside another li)
        if el.parent and el.parent.name == 'li':
            continue
        # Get first top-level li only
        first_li = el.find('li', recursive=False)
        if not first_li:
            continue
        text = first_li.get_text(' ', strip=True)
        # Name stops at first '. ' — strip source tags like (PHB)
        m = re.match(r'^(.+?)\.\s+(.+)$', text, re.DOTALL)
        if not m:
            continue
        name = re.sub(r'\s*\([A-Z]+\)\s*$', '', m.group(1)).strip()
        desc = m.group(2).strip()[:400]
        if name and len(name) < 60 and not any(o['name'] == name for o in options):
            options.append({'name': name, 'desc': desc})
    return options


# ─── Pattern B: one <ul> with nested <li><strong>Name</strong><ul>desc</ul> ──
def parse_strong_nested_options(content, heading_text):
    """Pact Boon style: top ul contains li with strong=name and nested ul=desc."""
    options = []
    found = False
    for el in content.find_all(['h3', 'h4', 'ul']):
        if el.name in ('h3', 'h4'):
            if heading_text in el.get_text():
                found = True
            elif found:
                break
            continue
        if not found or el.parent.name == 'li':
            continue
        for li in el.find_all('li', recursive=False):
            strong = li.find('strong') or li.find('b')
            if not strong:
                continue
            name = strong.get_text().strip()
            if 'UA' in name or len(name) > 50:
                continue
            # Description from nested ul li items
            nested = li.find('ul')
            if nested:
                desc = ' '.join(
                    sub.get_text(' ', strip=True)
                    for sub in nested.find_all('li', recursive=False)
                )[:400]
            else:
                full = li.get_text(' ', strip=True)
                desc = full[len(name):].strip().lstrip('.').strip()[:400]
            options.append({'name': name, 'desc': desc})
    return options


# ─── Pattern C: h2-headed items (maneuvers, invocations) ─────────────────────
def parse_h2_options(content, exclude_ua=True):
    options = []
    for h2 in content.find_all('h2'):
        name = h2.get_text().strip()
        if not name or len(name) > 60:
            continue
        if exclude_ua and '(UA)' in name:
            continue
        desc_parts = []
        prereq = None
        for sib in h2.next_siblings:
            if hasattr(sib, 'name') and sib.name == 'h2':
                break
            if hasattr(sib, 'name') and sib.name == 'p':
                txt = sib.get_text(' ', strip=True)
                strong = sib.find('strong')
                if strong and 'Prerequisite' in strong.get_text():
                    m = re.search(r'Prerequisite:?\s*(.+)', txt)
                    if m:
                        prereq = m.group(1).strip()
                else:
                    desc_parts.append(txt)
        entry = {'name': name, 'desc': ' '.join(desc_parts).strip()[:400]}
        if prereq:
            entry['prereq'] = prereq
        options.append(entry)
    return options


# ─── Pattern D: h3-headed items (disciplines, arcane shots on subclass pages) ─
def parse_h3_options(content):
    options = []
    for h3 in content.find_all('h3'):
        name = h3.get_text().strip()
        if not name or len(name) > 60:
            continue
        desc_parts = []
        prereq = None
        for sib in h3.next_siblings:
            if hasattr(sib, 'name') and sib.name in ('h2', 'h3'):
                break
            if hasattr(sib, 'name') and sib.name == 'p':
                txt = sib.get_text(' ', strip=True)
                m = re.search(r'(\d+)(?:st|nd|rd|th)[- ]level monk', txt, re.IGNORECASE)
                if m:
                    prereq = f'{m.group(1)}th level monk'
                desc_parts.append(txt)
        desc = ' '.join(desc_parts).strip()[:400]
        entry = {'name': name, 'desc': desc}
        if prereq:
            entry['prereq'] = prereq
        options.append(entry)
    return options


# ─── Pattern E: paragraphs starting with "Name. " (totem, arcane shots) ──────
def parse_p_named_options(content, heading_text):
    options = []
    found = False
    current = None
    for el in content.find_all(['h3', 'h4', 'p']):
        if el.name in ('h3', 'h4'):
            if heading_text in el.get_text():
                found = True
            elif found:
                if current:
                    options.append(current)
                    current = None
                break
            continue
        if not found:
            continue
        text = el.get_text(' ', strip=True)
        # Each animal/option starts with "Name. Description"
        m = re.match(r'^([A-Z][a-zA-Z ]{1,25})\.\s+(.+)$', text, re.DOTALL)
        if m:
            if current:
                options.append(current)
            current = {'name': m.group(1).strip(), 'desc': m.group(2).strip()[:400]}
    if current:
        options.append(current)
    return options


# ─── Scrapers ─────────────────────────────────────────────────────────────────

def scrape_fighting_styles():
    print('  Fighting Styles...')
    soup = get(f'{BASE_URL}/fighter')
    content = soup.select_one('#page-content')
    opts = parse_per_ul_options(content, 'Fighting Style')
    print(f'    {len(opts)}: {[o["name"] for o in opts]}')
    return opts


def scrape_maneuvers():
    print('  Battle Master Maneuvers...')
    soup = get(f'{BASE_URL}/fighter:battle-master:maneuvers')
    content = soup.select_one('#page-content')
    opts = parse_h2_options(content)
    print(f'    {len(opts)} maneuvers')
    return opts


def scrape_arcane_shots():
    print('  Arcane Shot options...')
    soup = get(f'{BASE_URL}/fighter:arcane-archer')
    content = soup.select_one('#page-content')
    opts = parse_p_named_options(content, 'Arcane Shot Options')
    print(f'    {len(opts)}: {[o["name"] for o in opts]}')
    return opts


def scrape_metamagic():
    print('  Metamagic...')
    soup = get(f'{BASE_URL}/sorcerer')
    content = soup.select_one('#page-content')
    opts = parse_per_ul_options(content, 'Metamagic')
    print(f'    {len(opts)}: {[o["name"] for o in opts]}')
    return opts


def scrape_pact_boon():
    print('  Pact Boon...')
    soup = get(f'{BASE_URL}/warlock')
    content = soup.select_one('#page-content')
    opts = parse_strong_nested_options(content, 'Pact Boon')
    # Exclude UA
    opts = [o for o in opts if 'Star Chain' not in o['name']]
    print(f'    {len(opts)}: {[o["name"] for o in opts]}')
    return opts


def scrape_eldritch_invocations():
    print('  Eldritch Invocations...')
    soup = get(f'{BASE_URL}/warlock:eldritch-invocations')
    content = soup.select_one('#page-content')
    opts = parse_h2_options(content)
    print(f'    {len(opts)} invocations')
    return opts


def scrape_totem_options(heading):
    soup = get(f'{BASE_URL}/barbarian:totem-warrior')
    content = soup.select_one('#page-content')
    return parse_p_named_options(content, heading)


def scrape_elemental_disciplines():
    print('  Elemental Disciplines...')
    soup = get(f'{BASE_URL}/monk:four-elements:disciplines')
    content = soup.select_one('#page-content')
    opts = parse_h3_options(content)
    print(f'    {len(opts)} disciplines')
    return opts


DRAGON_ANCESTORS = [
    {'name': 'Black (Acid)',      'desc': 'Damage type: Acid. Breath: 5×30 ft. line (Dex save).'},
    {'name': 'Blue (Lightning)',  'desc': 'Damage type: Lightning. Breath: 5×30 ft. line (Dex save).'},
    {'name': 'Brass (Fire)',      'desc': 'Damage type: Fire. Breath: 5×30 ft. line (Dex save).'},
    {'name': 'Bronze (Lightning)','desc': 'Damage type: Lightning. Breath: 5×30 ft. line (Dex save).'},
    {'name': 'Copper (Acid)',     'desc': 'Damage type: Acid. Breath: 5×30 ft. line (Dex save).'},
    {'name': 'Gold (Fire)',       'desc': 'Damage type: Fire. Breath: 15 ft. cone (Dex save).'},
    {'name': 'Green (Poison)',    'desc': 'Damage type: Poison. Breath: 15 ft. cone (Con save).'},
    {'name': 'Red (Fire)',        'desc': 'Damage type: Fire. Breath: 15 ft. cone (Dex save).'},
    {'name': 'Silver (Cold)',     'desc': 'Damage type: Cold. Breath: 15 ft. cone (Con save).'},
    {'name': 'White (Cold)',      'desc': 'Damage type: Cold. Breath: 15 ft. cone (Con save).'},
]

ARTISAN_TOOLS = [
    {"name": "Alchemist's Supplies"}, {"name": "Brewer's Supplies"},
    {"name": "Calligrapher's Supplies"}, {"name": "Carpenter's Tools"},
    {"name": "Cobbler's Tools"}, {"name": "Cook's Utensils"},
    {"name": "Glassblower's Tools"}, {"name": "Jeweler's Tools"},
    {"name": "Leatherworker's Tools"}, {"name": "Mason's Tools"},
    {"name": "Painter's Supplies"}, {"name": "Potter's Tools"},
    {"name": "Smith's Tools"}, {"name": "Tinker's Tools"},
    {"name": "Weaver's Tools"}, {"name": "Woodcarver's Tools"},
]


# ─── Main ──────────────────────────────────────────────────────────────────────

def run():
    print('Scraping choice data...\n')

    # ── Shared data ────────────────────────────────────────────────────────────
    fighting_styles = scrape_fighting_styles()
    maneuvers       = scrape_maneuvers()
    arcane_shots    = scrape_arcane_shots()
    metamagic       = scrape_metamagic()
    pact_boons      = scrape_pact_boon()
    invocations     = scrape_eldritch_invocations()
    disciplines     = scrape_elemental_disciplines()

    print('\nScraping Totem options...')
    totem_spirit     = scrape_totem_options('Totem Spirit')
    aspect_beast     = scrape_totem_options('Aspect of the Beast')
    totem_attunement = scrape_totem_options('Totemic Attunement')
    print(f'  Spirit: {[o["name"] for o in totem_spirit]}')
    print(f'  Aspect: {[o["name"] for o in aspect_beast]}')
    print(f'  Attunement: {[o["name"] for o in totem_attunement]}')

    # ── Fighter ────────────────────────────────────────────────────────────────
    print('\nInjecting Fighter...')
    fighter = load_class('fighter')
    fighter.setdefault('feature_choices', {})['Fighting Style'] = {
        'pick': 1, 'options': fighting_styles
    }
    bm = fighter['subclasses'].get('battle-master', {})
    bm.setdefault('feature_choices', {})['Combat Superiority'] = {
        'label': 'Maneuvers',
        'pick_by_level': {'3': 3, '7': 5, '10': 7, '15': 9},
        'options': maneuvers,
    }
    bm['feature_choices']['Student of War'] = {
        'label': "Artisan's Tools", 'pick': 1, 'options': ARTISAN_TOOLS
    }
    if arcane_shots:
        aa = fighter['subclasses'].get('arcane-archer', {})
        aa.setdefault('feature_choices', {})['Arcane Shot'] = {
            'label': 'Arcane Shot Options',
            'pick_by_level': {'3': 2, '7': 3, '10': 4, '15': 5, '18': 6},
            'options': arcane_shots,
        }
    champ = fighter['subclasses'].get('champion', {})
    champ.setdefault('feature_choices', {})['Additional Fighting Style'] = {
        'label': 'Second Fighting Style', 'pick': 1, 'options': fighting_styles
    }
    ek_styles = [s for s in fighting_styles if s['name'] in (
        'Blind Fighting','Defense','Dueling','Great Weapon Fighting',
        'Interception','Protection','Thrown Weapon Fighting','Two-Weapon Fighting','Unarmed Fighting')]
    ek = fighter['subclasses'].get('eldritch-knight', {})
    ek.setdefault('feature_choices', {})['Fighting Style'] = {
        'pick': 1, 'options': ek_styles
    }
    save_class('fighter', fighter)

    # ── Paladin ────────────────────────────────────────────────────────────────
    print('Injecting Paladin...')
    paladin = load_class('paladin')
    pal_names = ('Blessed Warrior','Blind Fighting','Defense','Dueling','Great Weapon Fighting','Protection')
    paladin.setdefault('feature_choices', {})['Fighting Style'] = {
        'pick': 1,
        'options': [s for s in fighting_styles if s['name'] in pal_names]
    }
    save_class('paladin', paladin)

    # ── Ranger ─────────────────────────────────────────────────────────────────
    print('Injecting Ranger...')
    ranger = load_class('ranger')
    rng_names = ('Archery','Blind Fighting','Defense','Druidic Warrior','Dueling','Two-Weapon Fighting')
    ranger.setdefault('feature_choices', {})['Fighting Style'] = {
        'pick': 1,
        'options': [s for s in fighting_styles if s['name'] in rng_names]
    }
    save_class('ranger', ranger)

    # ── Bard ───────────────────────────────────────────────────────────────────
    print('Injecting Bard...')
    bard = load_class('bard')
    swords = bard['subclasses'].get('swords', {})
    swords.setdefault('feature_choices', {})['Fighting Style'] = {
        'pick': 1,
        'options': [s for s in fighting_styles if s['name'] in ('Dueling','Two-Weapon Fighting')]
    }
    save_class('bard', bard)

    # ── Sorcerer ───────────────────────────────────────────────────────────────
    print('Injecting Sorcerer...')
    sorcerer = load_class('sorcerer')
    sorcerer.setdefault('feature_choices', {})['Metamagic'] = {
        'pick_by_level': {'3': 2, '10': 3, '17': 4},
        'options': metamagic,
    }
    drac = sorcerer['subclasses'].get('draconic-bloodline', {})
    drac.setdefault('feature_choices', {})['Dragon Ancestor'] = {
        'pick': 1, 'options': DRAGON_ANCESTORS
    }
    save_class('sorcerer', sorcerer)

    # ── Warlock ────────────────────────────────────────────────────────────────
    print('Injecting Warlock...')
    warlock = load_class('warlock')
    warlock.setdefault('feature_choices', {})['Pact Boon'] = {
        'pick': 1, 'options': pact_boons
    }
    warlock['feature_choices']['Eldritch Invocations'] = {
        'pick_by_level': {'2': 2, '5': 3, '7': 4, '9': 5, '12': 6, '15': 7, '18': 8},
        'options': invocations,
    }
    save_class('warlock', warlock)

    # ── Barbarian ──────────────────────────────────────────────────────────────
    print('Injecting Barbarian...')
    barbarian = load_class('barbarian')
    tw = barbarian['subclasses'].get('totem-warrior', {})
    fc = tw.setdefault('feature_choices', {})
    if totem_spirit:
        fc['Totem Spirit'] = {'pick': 1, 'options': totem_spirit}
    if aspect_beast:
        fc['Aspect of the Beast'] = {'pick': 1, 'options': aspect_beast}
    if totem_attunement:
        fc['Totemic Attunement'] = {'pick': 1, 'options': totem_attunement}
    save_class('barbarian', barbarian)

    # ── Monk ───────────────────────────────────────────────────────────────────
    print('Injecting Monk...')
    monk = load_class('monk')
    fe = monk['subclasses'].get('four-elements', {})
    if disciplines:
        fe.setdefault('feature_choices', {})['Disciple of the Elements'] = {
            'label': 'Elemental Disciplines',
            'pick_by_level': {'3': 2, '6': 3, '11': 4, '17': 5},
            'options': disciplines,
        }
    save_class('monk', monk)

    print('\n✓ Done.')


if __name__ == '__main__':
    run()
