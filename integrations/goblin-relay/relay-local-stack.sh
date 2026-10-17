#!/usr/bin/env bash
# integrations/goblin-relay/relay-local-stack.sh - Bật trọn bộ thử trên MỘT máy: adapter (đưa ảnh tới 9Router đúng cách) + Tax Referee + receiver nhận file của Goblin.
# Đọc cấu hình từ ~/.config/goblin-tax-test/stack.env (quyền 600, không nằm trong git). Ctrl+C để tắt hết.
#   bash integrations/goblin-relay/relay-local-stack.sh          # rồi mở cửa sổ khác: bash integrations/goblin-relay/relay-local-test.sh
set -euo pipefail
ENV_FILE="${STACK_ENV:-$HOME/.config/goblin-tax-test/stack.env}"
[ -f "$ENV_FILE" ] || { echo "Chưa có $ENV_FILE (mẫu: stack.env.example cạnh file này; xem README.md)"; exit 1; }
set -a; . "$ENV_FILE"; set +a
HERE="$(cd "$(dirname "$0")" && pwd)"
LOG="${STACK_LOG:-$HOME/.cache/goblin-tax-test}"; mkdir -p "$LOG" "$RELAY_INBOX"
if command -v fnm >/dev/null 2>&1; then eval "$(fnm env --shell bash)"; fnm use 22 >/dev/null 2>&1 || true; fi
node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' || { echo "Cần Node >= 22 (đang $(node -v))"; exit 1; }
RB="${RELAY_BIND:-127.0.0.1}"
for hp in "127.0.0.1:$ADAPTER_PORT" "127.0.0.1:$TAX_PORT" "$RB:$RELAY_PORT"; do
  if (exec 3<>"/dev/tcp/${hp%:*}/${hp##*:}") 2>/dev/null; then echo "Cổng ${hp##*:} đang bị chiếm, tắt tiến trình đó trước"; exit 1; fi
done

PIDS=()
cleanup() { echo; echo "Đang tắt..."; kill "${PIDS[@]}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

node "$HERE/gemini-native-adapter.mjs" >"$LOG/adapter.log" 2>&1 & PIDS+=($!)
# Tax không được thấy khóa thật của 9Router lẫn token của receiver
(cd "$TAX_DIR" && exec env -u GATEWAY_API_KEY -u RELAY_TOKEN -u ADAPTER_TOKEN npx next dev --turbo -H 127.0.0.1 -p "$TAX_PORT") >"$LOG/tax.log" 2>&1 & PIDS+=($!)
TAX_BASE_URL="http://127.0.0.1:$TAX_PORT" node "$HERE/relay-receiver.mjs" >"$LOG/receiver.log" 2>&1 & PIDS+=($!)

ready() { for _ in $(seq 1 60); do curl -s -o /dev/null "$1" && return 0; sleep 1; done; return 1; }
ready "http://127.0.0.1:$TAX_PORT/api/health" && echo "✅ Tax Referee   http://127.0.0.1:$TAX_PORT" || echo "❌ Tax chưa lên, xem $LOG/tax.log"
ready "http://127.0.0.1:$ADAPTER_PORT/health" && echo "✅ Adapter       127.0.0.1:$ADAPTER_PORT -> ${GATEWAY_MODEL:-model theo request}" || echo "❌ Adapter lỗi, xem $LOG/adapter.log"
sleep 1; (exec 3<>"/dev/tcp/$RB/$RELAY_PORT") 2>/dev/null && echo "✅ Receiver      $RB:$RELAY_PORT -> inbox $RELAY_INBOX" || echo "❌ Receiver lỗi, xem $LOG/receiver.log"
echo "Log: $LOG/*.log   |   Thử: bash integrations/goblin-relay/relay-local-test.sh   |   Ctrl+C để tắt"
# Giám sát: một tiến trình chết, hoặc tax không trả lời 4 lần liên tiếp (~1 phút) thì thoát để systemd (hoặc bạn) dựng lại cả bộ.
fails=0
while true; do
  for p in "${PIDS[@]}"; do kill -0 "$p" 2>/dev/null || { echo "Một tiến trình đã dừng, thoát để dựng lại cả bộ"; exit 1; }; done
  if curl -sf -m 10 -o /dev/null "http://127.0.0.1:$TAX_PORT/api/health"; then fails=0; else fails=$((fails+1)); [ "$fails" -ge 4 ] && { echo "Tax không đáp ứng, thoát để dựng lại"; exit 1; }; fi
  sleep 15
done
