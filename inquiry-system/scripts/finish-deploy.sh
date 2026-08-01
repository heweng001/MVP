#!/bin/bash
set -euo pipefail
cd /opt/inquiry/repo/inquiry-system
npx prisma db push
npm run build
systemctl restart inquiry-system
sleep 2
systemctl is-active inquiry-system
python3 - <<'PY'
import sqlite3
con = sqlite3.connect("/opt/inquiry/data/prod.db")
tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("tables_with_promo:", [t for t in tables if "romo" in t.lower()])
PY
curl -sI -o /dev/null -w "promos_http=%{http_code}\n" https://mvp.maoniux.com/admin/promos
curl -sI -o /dev/null -w "login_http=%{http_code}\n" https://mvp.maoniux.com/login
