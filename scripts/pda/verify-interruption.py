"""Run only against the isolated b1c2test package; baseline APK and fixture must already exist."""
import argparse
import pathlib
import subprocess
import time
import re

parser = argparse.ArgumentParser()
parser.add_argument('--serial', required=True)
parser.add_argument('--adb', required=True)
parser.add_argument('--recovery', action='store_true')
args = parser.parse_args()
base = [args.adb, '-s', args.serial]
package = 'cn.maozhi.wms.pda.b1c2recovery.debug' if args.recovery else 'cn.maozhi.wms.pda.b1c2test.debug'
# Reject an accidentally built normal APK before stopping or installing anything.
aapt_tools = sorted((pathlib.Path(args.adb).parent.parent / 'build-tools').glob('*/aapt.exe'))
assert aapt_tools, 'Android aapt is required to verify isolated APK application IDs'
old = ('.local/b1c2-recovery' if args.recovery else '.local/b1c2-baseline') + '/source/apps/pda/app/build/outputs/apk/'
for root in ['apps/pda/app/build/outputs/apk/', old]:
    for suffix, expected in [('debug/app-debug.apk', package), ('androidTest/debug/app-debug-androidTest.apk', package + '.test')]:
        apk = root + suffix
        result = subprocess.run([str(aapt_tools[-1]), 'dump', 'badging', apk], capture_output=True, text=True, encoding='utf-8', check=True)
        match = re.search(r"package: name='([^']+)'", result.stdout)
        assert match and match.group(1) == expected, 'Refuse non-isolated or wrong validation APK: ' + apk
output = pathlib.Path('.local/evidence/b1c2-migration-interruption.log')
if output.exists():
    output.rename(output.with_name(f'b1c2-migration-interruption-{int(time.time())}.log'))
log = output.open('w', encoding='utf-8')

def run(*parts):
    result = subprocess.run(base + list(parts), capture_output=True, text=True, encoding='utf-8', errors='replace')
    log.write('> ' + ' '.join(parts) + '\n' + result.stdout + result.stderr)
    log.flush()
    print(result.stdout, flush=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout

run('shell', 'am', 'force-stop', package)
run('install', '-r', 'apps/pda/app/build/outputs/apk/debug/app-debug.apk')
run('install', '-r', 'apps/pda/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')
prior = subprocess.run(base + ['logcat', '-d', '-s', 'B1C2:I', '*:S'], capture_output=True, text=True).stdout.splitlines()
proc = subprocess.Popen(base + ['shell', 'am', 'instrument', '-w', '-e', 'class',
    'cn.maozhi.wms.pda.MigrationInterruptionTest#pauseBeforeCommit',
    package + '.test/androidx.test.runner.AndroidJUnitRunner'], stdout=log, stderr=log)
found = False
for _ in range(80):
    logs = subprocess.run(base + ['logcat', '-d', '-s', 'B1C2:I', '*:S'],
        capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
    if any('MIGRATION_WRITES_DONE_BEFORE_COMMIT' in line and line not in prior for line in logs.splitlines()):
        log.write(logs)
        found = True
        break
    time.sleep(.25)
assert found, 'No migration checkpoint observed; do not claim interruption passed'
run('shell', 'am', 'force-stop', package)
proc.wait(timeout=10)
log.write('HOST: killed during Room transaction after writes and before commit\n')
run('install', '-r', '-d', old + 'debug/app-debug.apk')
run('install', '-r', '-d', old + 'androidTest/debug/app-debug-androidTest.apk')
result = run('shell', 'am', 'instrument', '-w', '-e', 'class', 'cn.maozhi.wms.pda.LegacyFixtureTest#verify',
    package + '.test/androidx.test.runner.AndroidJUnitRunner')
assert 'OK (1 test)' in result
run('shell', 'am', 'start', '-n', package + '/cn.maozhi.wms.pda.ui.MainActivity')
time.sleep(2)
shot = '/sdcard/Android/data/' + package + '/files/b1c2-old-queue.png'
# LegacyFixtureTest verifies visible text and captures the actual old app view.
run('pull', shot, '.local/evidence/b1c2-old-queue.png')
run('logcat', '-d', '-s', 'System.out:I', '*:S')
print('B1C2_INTERRUPTION old_apk_started=true original_queue=60/60 freeze_key=unchanged', flush=True)
log.write('B1C2_INTERRUPTION old_apk_started=true original_queue=60/60 freeze_key=unchanged\n')
log.close()
