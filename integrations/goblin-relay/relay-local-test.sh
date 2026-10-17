#!/usr/bin/env bash
# integrations/goblin-relay/relay-local-test.sh - Gửi file mẫu vào receiver ĐANG CHẠY (bật bằng relay-local-stack.sh) như Goblin sẽ làm, in kết quả tax đọc được.
#   bash integrations/goblin-relay/relay-local-test.sh                      # gửi các XML/PDF/JPG mẫu trong input-sample của tax
#   bash integrations/goblin-relay/relay-local-test.sh ~/anh/hoa-don.jpg    # gửi file của bạn
set -uo pipefail
ENV_FILE="${STACK_ENV:-$HOME/.config/goblin-tax-test/stack.env}"
set -a; . "$ENV_FILE"; set +a
if [ "$#" -gt 0 ]; then FILES=("$@"); else FILES=("$TAX_DIR"/input-sample/*.xml "$TAX_DIR"/input-sample/*.pdf "$TAX_DIR"/input-sample/*.jpg); fi
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "Không có file $f"; continue; }
  sha=$(sha256sum "$f" | cut -d' ' -f1)
  start=$(date +%s)
  body=$(curl -s -m 150 -w '\n%{http_code}' -X POST "http://${RELAY_BIND:-127.0.0.1}:$RELAY_PORT/inbox" -H "Authorization: Bearer $RELAY_TOKEN" -F "filename=$(basename "$f")" -F "sha256=$sha" -F "file=@$f")
  code=${body##*$'\n'}; json=${body%$'\n'*}
  printf '%-34s HTTP %s (%ss)\n   ' "$(basename "$f" | cut -c1-34)" "$code" "$(( $(date +%s) - start ))"
  python3 -c 'import json,sys
try: print(json.loads(sys.argv[1]).get("summary") or sys.argv[1][:200])
except Exception: print(sys.argv[1][:200])' "$json"
done
