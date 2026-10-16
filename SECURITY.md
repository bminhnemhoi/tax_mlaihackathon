# Chính sách bảo mật

Tax Referee xử lý dữ liệu thuế và quyết định khấu trừ, nên lỗ hổng bảo mật được ưu tiên cao hơn mọi loại lỗi khác.

## Phiên bản được hỗ trợ

| Phiên bản | Hỗ trợ |
|---|---|
| Nhánh `main` | ✅ |
| [`v1.0.0`](https://github.com/bminhnemhoi/tax_mlaihackathon/releases/tag/v1.0.0) — commit `e496ab4`, bản đang chạy trên live | ✅ |
| Nhánh tính năng, commit cũ | ❌ — hãy kiểm tra lại trên `main` |

Commit đang chạy trên live xem tại [`/api/health`](https://limegreen-salamander-517622.hostingersite.com/api/health) (trường `commit`).

## Báo cáo lỗ hổng

**Không mở issue công khai** cho lỗ hổng bảo mật.

1. Báo riêng qua tab **Security → [Report a vulnerability](https://github.com/bminhnemhoi/tax_mlaihackathon/security/advisories/new)** của repo này, hoặc liên hệ riêng chủ repo [@bminhnemhoi](https://github.com/bminhnemhoi). Lỗ hổng ảnh hưởng bản live xin báo thêm cho repo gốc của đội [khanhle1406/Tax-Referee](https://github.com/khanhle1406/Tax-Referee) ([@khanhle1406](https://github.com/khanhle1406)).
2. Nội dung nên có:
   - mô tả lỗ hổng và tác động (ví dụ: hóa đơn được tự duyệt sai, vượt thẩm quyền, sửa được nhật ký);
   - các bước tái hiện tối thiểu, commit hoặc URL bị ảnh hưởng;
   - đề xuất khắc phục, nếu có.
3. Không đính kèm dữ liệu thật của doanh nghiệp, khóa API hay mật khẩu.

Đội phản hồi sớm nhất có thể và thông báo hướng xử lý sau khi tái hiện được. Bản sửa đi qua Pull Request có test hồi quy; người báo được ghi nhận trong [CHANGELOG.md](CHANGELOG.md) nếu đồng ý.

## Phạm vi

**Trong phạm vi:**
- Vượt quyền: thao tác hoặc duyệt khi vai trò không được phép, hạ thẩm quyền của ca cần CFO, tự duyệt hồ sơ do chính mình nhập.
- Ranh giới thực thi: khiến hóa đơn đáng lẽ phải chuyển người lại được tự duyệt; đầu ra của AI ảnh hưởng tới quyết định ngoài 14 trường được phép.
- Toàn vẹn nhật ký: sửa, xóa, chèn hoặc cắt đuôi nhật ký mà `/api/audit?verify=1` hay điểm neo không phát hiện.
- Cách ly: đọc hoặc ghi dữ liệu của phiên demo khác; XXE, SSRF, chèn lệnh qua chứng từ tải lên.
- Lộ bí mật: khóa API, khóa audit, mật khẩu qua phản hồi, log hoặc mã nguồn.

**Ngoài phạm vi:**
- Đổi vai trò trong **phiên demo** — đây là tính năng mô phỏng, đã nêu trong giới hạn của [README](README.md#bằng-chứng-và-giới-hạn).
- Tấn công từ chối dịch vụ khối lượng lớn, quét tự động gây tải cho live.
- Lỗ hổng của dịch vụ bên thứ ba (Hostinger, proxy AI) không do cấu hình của dự án gây ra.
- Các tính năng nhóm **Mở rộng · beta** đã ghi là giả lập.

Vui lòng thử trên bản chạy cục bộ (`npm run dev`) hoặc trong phiên demo của chính bạn; không thử trên dữ liệu của người khác.

## Cơ chế bảo mật hiện có

Mô hình mối đe dọa, ranh giới tin cậy và các lỗi đội tự phát hiện: [docs/security/threat-model.md](docs/security/threat-model.md).
Bằng chứng chạy trên mã đang deploy: trang [`/trust`](https://limegreen-salamander-517622.hostingersite.com/trust) — 12 phép thử theo 4 trụ (định danh, đặc quyền tối thiểu, ranh giới thực thi, cách ly).

## Dành cho người đóng góp

- Không commit file môi trường thật (`.env*` trừ `.env.example`, `env_*`); chỉ nhắc **tên** biến trong tài liệu.
- Thay đổi chạm vào workflow, xác thực, đọc chứng từ, nhật ký hoặc policy cần test hồi quy và nên chạy agent `security-reviewer` (`.claude/agents/`).
