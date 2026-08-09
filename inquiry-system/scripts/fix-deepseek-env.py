#!/usr/bin/env python3
from pathlib import Path
import sys

key = sys.argv[1] if len(sys.argv) > 1 else ""
if not key.startswith("sk-"):
    raise SystemExit("usage: fix-deepseek-env.py sk-xxx")

p = Path("/opt/inquiry/repo/inquiry-system/.env")
lines = p.read_text(encoding="utf-8").splitlines()
out = []
for line in lines:
    s = line.strip()
    if s.startswith("DEEPSEEK_") or s.startswith("# 月报 AI"):
        continue
    # drop corrupted stuck lines that look like escaped env dumps
    if "DEEPSEEK_BASE_URL" in line or "DEEPSEEK_MODEL" in line:
        continue
    out.append(line)
while out and out[-1].strip() == "":
    out.pop()
out += [
    "",
    "# 月报 AI（DeepSeek）",
    f'DEEPSEEK_API_KEY="{key}"',
    'DEEPSEEK_BASE_URL="https://api.deepseek.com"',
    'DEEPSEEK_MODEL="deepseek-chat"',
    "",
]
p.write_text("\n".join(out), encoding="utf-8")
print("wrote", p)
for line in out:
    if line.startswith("DEEPSEEK_API_KEY"):
        print("DEEPSEEK_API_KEY=***")
    elif "DEEPSEEK" in line or "月报 AI" in line:
        print(line)
