"""
Merge all class spell data into data/spells.json.
Each class JSON is rewritten with `spells` as an array of slugs instead of an object.
Run ONCE: python3 scripts/merge_spells.py
"""
import json, os, glob

DATA_DIR = 'data/classes'
SPELLS_PATH = 'data/spells.json'

all_spells = {}
class_updates = {}

for path in sorted(glob.glob(f'{DATA_DIR}/*.json')):
    with open(path) as f:
        cls = json.load(f)
    key = cls['key']
    spells = cls.get('spells', {})
    slugs = []
    for slug, spell in spells.items():
        if slug not in all_spells:
            all_spells[slug] = {
                'name': spell['name'],
                'level': spell['level'],
                'school': spell.get('school', ''),
                'description': spell.get('description', ''),
                'classes': [],
            }
        all_spells[slug]['classes'].append(key)
        slugs.append(slug)
    cls['spells'] = slugs
    class_updates[key] = cls

# Write spells.json
with open(SPELLS_PATH, 'w') as f:
    json.dump(all_spells, f, indent=2, ensure_ascii=False)
print(f"Written {SPELLS_PATH} ({len(all_spells)} unique spells)")

# Write updated class JSONs
for key, cls in class_updates.items():
    path = os.path.join(DATA_DIR, f'{key}.json')
    with open(path, 'w') as f:
        json.dump(cls, f, indent=2, ensure_ascii=False)
    print(f"Updated {path}")
