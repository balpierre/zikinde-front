#!/usr/bin/env bash
# Build puis déploiement sur Cloudflare Workers, rattaché au sous-domaine.
#   scripts/deploy-cloudflare.sh            (prérequis : npx wrangler@4 login)
set -euo pipefail
DOMAIN="${DOMAIN:-zikinde.claves-technologies.fr}"
cd "$(dirname "$0")/.."
npx -y bun@1.3 install --frozen-lockfile
npx -y bun@1.3 x vite build
python3 - "$DOMAIN" <<'PY'
import json, sys
p = ".output/server/wrangler.json"
c = json.load(open(p))
c["name"] = "zikinde-front"
c["routes"] = [{"pattern": sys.argv[1], "custom_domain": True}]
json.dump(c, open(p, "w"), indent=2)
PY
npx -y wrangler@4 deploy --cwd .output
