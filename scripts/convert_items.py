#!/usr/bin/env python3
"""Convert dnd_pricing.xlsx to data/items.json (slug-keyed, matching spells pattern)."""
import json, os, re, sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit('pip install openpyxl')

BASE = Path(__file__).resolve().parent.parent
XLSX = BASE / 'data' / 'dnd_pricing.xlsx'
OUT = BASE / 'data' / 'items.json'

SOURCE_SHEETS = ['DMG 2024', 'DMG 2014', 'XGTE', 'TCoE']

COLS = {
    'name': 1, 'rarity': 2, 'attunement': 3, 'cost_gp': 4, 'note': 5,
    'armor_cost': 6, 'rare_material': 7, 'ac_bonus': 8, 'save_bonus': 9,
    'set_score': 10, 'bonus_score': 11, 'weapon_bonus': 12, 'spell_level': 13,
    'unlimited_charges': 14, 'charges_per_day': 15, 'charges_item': 16,
    'spells_share_charges': 17, 'condition': 18,
    'consumable_damage': 19, 'consumable_save': 20,
    'semi_perm_damage': 21, 'semi_perm_save': 22, 'duration_minutes': 23,
    'perm_damage': 24, 'perm_save': 25, 'specific_situations': 26,
    'restore_hp': 27, 'misc_costs': 28,
}

PROP_COLS = {v: k for k, v in COLS.items()}  # col_number -> field_name

def slugify(name):
    s = name.strip().lower()
    s = re.sub(r'[,:\'"]', '', s)
    s = re.sub(r'\s+', '-', s)
    s = re.sub(r'[^a-z0-9\-]', '', s)
    return s

def parse_cost(val):
    if val is None or val == '-' or val == '':
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

def row_to_item(row, source):
    name = row[0]
    if not name or not str(name).strip():
        return None
    name = str(name).strip()

    item = {
        'name': name,
        'source': source,
        'rarity': str(row[1] or '').strip() or None,
        'attunement': str(row[2] or '').strip() or None,
        'cost_gp': parse_cost(row[3]),
        'note': str(row[4] or '').strip() or None,
    }

    for col_num, field in PROP_COLS.items():
        val = row[col_num - 1] if col_num <= len(row) else None
        if val is not None and val != '' and val != 0:
            item[field] = val
            if isinstance(val, float) and val == int(val):
                item[field] = int(val)

    item = {k: v for k, v in item.items() if v is not None}

    return item

def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    items = {}

    for sheet_name in SOURCE_SHEETS:
        ws = wb[sheet_name]
        rows = list(ws.iter_rows(min_row=2, values_only=True))
        for row in rows:
            item = row_to_item(row, sheet_name)
            if item is None:
                continue
            slug = slugify(item['name'])
            if slug in items:
                slug = f"{slug}-{slugify(sheet_name.lower().replace(' ', '-'))}"
            items[slug] = item

    print(f'Extracted {len(items)} items from {len(SOURCE_SHEETS)} source sheets')
    with open(OUT, 'w') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    print(f'Wrote {OUT} ({os.path.getsize(OUT) / 1024:.1f} KB)')

if __name__ == '__main__':
    main()
