#!/usr/bin/env bash
# Prisma 6.19.3 cannot download its query engine through this VM's egress
# proxy (ECONNRESET), so `prisma generate` / `prisma version` crash.
# Workaround: copy the already-downloaded engine binary into the pnpm
# store locations Prisma looks in. Re-run after every `pnpm install`
# (which wipes the copies) or after a Prisma version bump.
# Source of truth: ~/.cache/prisma/master/*/debian-openssl-3.0.x/libquery_engine.so.node
set -euo pipefail
SRC=$(ls ~/.cache/prisma/master/*/debian-openssl-3.0.x/libquery_engine.so.node | head -1)
[ -n "$SRC" ] || { echo "No cached engine found under ~/.cache/prisma"; exit 1; }
for dst in $(find node_modules/.pnpm -path '*@prisma+engines*/libquery_engine-debian-openssl-3.0.x.so.node' -o -path '*prisma@*/node_modules/prisma/libquery_engine-debian-openssl-3.0.x.so.node' 2>/dev/null); do
  cp "$SRC" "$dst"
  sha256sum "$dst" | cut -d' ' -f1 > "$dst.sha256"
  echo "patched $dst"
done
echo "done — run: cd apps/api && npx prisma version"
