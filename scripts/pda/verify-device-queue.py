"""Read the isolated validation package only; never clear or edit a device queue."""
import argparse
import json
import pathlib
import sqlite3
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--serial', required=True)
parser.add_argument('--adb', required=True)
args = parser.parse_args()
package = 'cn.maozhi.wms.pda.b1c2test.debug'
base = [args.adb, '-s', args.serial]
subprocess.run(base + ['shell', 'am', 'force-stop', package], check=True)
target = pathlib.Path('.local/evidence/b1c2-device-final-db')
target.mkdir(exist_ok=True)
for suffix in ['', '-wal', '-shm']:
    name = 'maozhi-scan.db' + suffix
    result = subprocess.run(base + ['exec-out', 'run-as', package, 'cat', 'databases/' + name], capture_output=True)
    if result.returncode == 0:
        (target / name).write_bytes(result.stdout)
    elif not suffix:
        raise RuntimeError('Cannot read isolated validation queue')
    elif (target / name).exists():
        raise RuntimeError('Old snapshot sidecar exists; use a fresh evidence directory')
original = json.loads(pathlib.Path('.local/evidence/b1c2-legacy-records.json').read_text(encoding='utf-8'))
with sqlite3.connect((target / 'maozhi-scan.db').resolve().as_uri() + '?mode=ro', uri=True) as db:
    rows = db.execute('SELECT id,payload,state FROM facts WHERE planId=?', ['pda-handoff-plan']).fetchall()
    current = {row[0]: row for row in rows}
    for row in original:
        payload = row['payload']
        assert current[json.loads(payload)['id']][1] == payload
    assert len(original) == 60 and len(rows) == 61
    assert all(row[2] == 'synced' for row in rows)
    distribution = {}
    for _, payload, _ in rows:
        fact = json.loads(payload)
        version = str(fact['catalogVersion'])
        item = distribution.setdefault(version, {'facts': 0, 'weightGrams': 0})
        item['facts'] += 1
        item['weightGrams'] += fact['weightGrams']
    print('B1C2_DEVICE_READBACK original_raw_payloads=60/60 identical=true received=61/61 pending=0 failed=0 conflict=0')
    print('B1C2_DEVICE_VERSIONS', json.dumps(distribution, sort_keys=True))
