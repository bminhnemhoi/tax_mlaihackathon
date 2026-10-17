#!/usr/bin/env bash
# integrations/goblin-relay/demo-check.sh - Kiểm tra nhanh trước demo: mỗi mục ✅/❌ kèm cách sửa. Không gửi dữ liệu nào, không in bí mật.
#   bash integrations/goblin-relay/demo-check.sh                    # kiểm tra máy này
#   VPS=user@host bash integrations/goblin-relay/demo-check.sh      # kiểm tra cả bot Goblin trên VPS (cần SSH bằng khóa, SSH_KEY=... nếu khác mặc định)
ENV_FILE="${STACK_ENV:-$HOME/.config/goblin-tax-test/stack.env}"
set -a; . "$ENV_FILE" 2>/dev/null; set +a
VPS="${VPS:-}"; KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"   # VPS dạng user@host chạy bot Goblin (để trống = bỏ qua 3 mục phía VPS)
RB="${RELAY_BIND:-127.0.0.1}"; bad=0
ok() { echo "✅ $1"; }
no() { echo "❌ $1"; echo "   → $2"; bad=$((bad+1)); }
code() { curl -s -m "${2:-6}" -o /dev/null -w '%{http_code}' "$1" 2>/dev/null; }

systemctl --user is-active --quiet goblin-demo-stack && ok "Dịch vụ goblin-demo-stack đang chạy" || no "Dịch vụ không chạy" "systemctl --user start goblin-demo-stack"
[ "$(code http://127.0.0.1:${TAX_PORT:-3100}/api/health 10)" = 200 ] && ok "Tax Referee http://127.0.0.1:${TAX_PORT:-3100} (health ok)" || no "Tax không trả lời" "systemctl --user restart goblin-demo-stack, đợi ~30 giây"
[ "$(code http://127.0.0.1:${ADAPTER_PORT:-8790}/health)" = 200 ] && ok "Cầu nối đọc ảnh (9Router) ok" || no "Cầu nối đọc ảnh lỗi" "xem ~/.cache/goblin-tax-test/adapter.log"
[ "$(code http://$RB:${RELAY_PORT:-8787}/inbox)" = 405 ] && ok "Bộ nhận nghe $RB:${RELAY_PORT:-8787}" || no "Bộ nhận không nghe" "xem ~/.cache/goblin-tax-test/receiver.log"
tailscale status >/dev/null 2>&1 && ok "Tailscale laptop đang chạy ($(tailscale ip -4 2>/dev/null | head -1))" || no "Tailscale tắt" "sudo tailscale up"
firewall-cmd --list-rich-rules 2>/dev/null | grep -q "$RELAY_PORT" && ok "Tường lửa mở cổng ${RELAY_PORT:-8787} cho Tailscale" || no "Tường lửa chưa mở (mất sau khi khởi động lại máy)" "sudo firewall-cmd --add-rich-rule='rule family=\"ipv4\" source address=\"100.64.0.0/10\" port port=\"${RELAY_PORT:-8787}\" protocol=\"tcp\" accept'"
if [ -n "$VPS" ]; then
  out=$(ssh -i "$KEY" -o ConnectTimeout=10 -o BatchMode=yes "$VPS" "echo -n \"\$(systemctl is-active goblin) \$(curl -s -m 8 -o /dev/null -w '%{http_code}' http://$RB:${RELAY_PORT:-8787}/inbox) \$(sudo grep -c '^RELAY_TAX_AUTO=1' /home/goblin/ChatBotOpenClaw/.env)\"" 2>/dev/null)
  set -- $out
  [ "${1:-}" = active ] && ok "Bot Goblin trên VPS đang chạy" || no "Không vào được VPS hoặc bot tắt" "ssh -i $KEY $VPS 'sudo systemctl restart goblin'"
  [ "${2:-}" = 405 ] && ok "VPS gọi được laptop qua Tailscale" || no "VPS không tới được laptop" "kiểm tra Tailscale ở cả hai máy và tường lửa"
  [ "${3:-}" = 1 ] && ok "Bot đang bật tự chuyển hóa đơn (RELAY_TAX_AUTO=1)" || no "Bot chưa bật tự chuyển" "đổi RELAY_TAX_AUTO=1 trong .env VPS rồi restart goblin"
else
  echo "⏭️  Bỏ qua 3 mục phía VPS (chưa đặt VPS=user@host)"
fi
echo; [ $bad -eq 0 ] && echo "🎉 Sẵn sàng demo." || echo "⚠️  Còn $bad mục chưa ổn, sửa theo mũi tên rồi chạy lại."
exit $bad
