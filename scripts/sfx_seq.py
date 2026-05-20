"""Roda sons restantes em sequência com pausa pra respeitar rate-limit Replicate."""
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = os.path.join(ROOT, 'sfx-batch.json')
SFX_GEN = r'C:\Users\manu\dev\universal-toolbelt\sfx-generator\sfx-gen.py'
PYTHON = r'C:\Users\manu\AppData\Local\Programs\Python\Python312\python.exe'

with open(BATCH) as f:
    data = json.load(f)

sounds = data.get('sounds', data)

remaining = [s for s in sounds if not os.path.exists(s['output'])]
print(f'Restantes: {len(remaining)} sons')

for i, s in enumerate(remaining):
    name = os.path.basename(s['output'])
    print(f"\n[{i+1}/{len(remaining)}] {name} - {s['prompt'][:60]}...")
    cmd = [PYTHON, SFX_GEN,
           '--prompt', s['prompt'],
           '--output', s['output'],
           '--duration', str(s.get('duration', 1))]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode == 0 and os.path.exists(s['output']):
            sz = os.path.getsize(s['output'])
            print(f"   OK ({sz} bytes)")
        else:
            print(f"   FAIL: {r.stderr[-300:] if r.stderr else r.stdout[-300:]}")
    except subprocess.TimeoutExpired:
        print("   TIMEOUT")
    # Pausa pra não estourar rate limit (Replicate: 6/min com burst 1)
    if i < len(remaining) - 1:
        time.sleep(12)

print('\nFeito.')
