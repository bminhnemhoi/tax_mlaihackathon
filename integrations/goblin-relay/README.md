# integrations/goblin-relay

Bộ nối chatbot Zalo (Goblin) với Tax Referee. Giải thích đầy đủ, kiến trúc, quyết định và cách dựng: [docs/integrations/zalo-goblin-relay.md](../../docs/integrations/zalo-goblin-relay.md).

| File | Dùng để |
|---|---|
| `relay-receiver.mjs` | Nhận file từ bot (Bearer token, 15 MB, kiểm sha256) và đưa vào tax + thẩm định |
| `gemini-native-adapter.mjs` | Cầu nối đọc ảnh: Google native → OpenAI (9Router làm rơi ảnh ở đường native) |
| `relay-local-stack.sh` | Chạy tax + cầu nối + bộ nhận trên một máy; tự giám sát, thoát để systemd dựng lại |
| `relay-local-test.sh` | Gửi file mẫu vào bộ nhận như bot sẽ làm |
| `demo-check.sh` | Kiểm tra nhanh trước demo, mục lỗi kèm lệnh sửa |
| `relay-kit-start.mjs`, `relay-kit-check.mjs`, `relay-kit.env.example` | Bản cho máy khác (Windows/macOS/Linux, chỉ cần Node 22) |
| `stack.env.example`, `goblin-demo-stack.service.example` | Mẫu cấu hình và dịch vụ systemd (giá trị giả) |

Đây là mã demo, không thuộc ứng dụng chạy production và không được import từ `app/`, `lib/`, `services/`. Không chứa khóa hay địa chỉ riêng; mọi giá trị nhạy cảm đọc từ `stack.env` hoặc biến môi trường.
