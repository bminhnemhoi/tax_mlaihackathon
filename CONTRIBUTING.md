# Hướng dẫn đóng góp (Contributing Guidelines)

Cảm ơn bạn đã quan tâm đến dự án **Tax Referee**! Dự án được phát triển nhằm mục tiêu tự động hóa việc rà soát và xử lý hóa đơn điện tử, leo thang (escalation) có kiểm soát và minh bạch.

---

## 1. Chuẩn bị môi trường phát triển

1. **Yêu cầu hệ thống**:
   - Node.js >= 20.19 (khuyến nghị Node 22 theo CI)
   - npm >= 10

2. **Cài đặt dependencies**:
   ```bash
   git clone https://github.com/khanhle1406/Tax-Referee.git
   cd Tax-Referee
   npm ci
   ```

3. **Cấu hình môi trường**:
   ```bash
   cp .env.example .env.local
   ```
   *Lưu ý: API Key Gemini chỉ cần khi chạy tính năng đọc ảnh/OCR hóa đơn scan. Chế độ Verify và Test chạy tất định không cần API key.*

4. **Khởi chạy ứng dụng**:
   ```bash
   npm run dev
   ```
   Truy cập `http://localhost:3000` trên trình duyệt.

---

## 2. Quy chuẩn kiểm thử & Chất lượng mã nguồn (Quality Gates)

Trước khi gửi Pull Request, vui lòng đảm bảo mọi bước kiểm tra cục bộ đều vượt qua (CI sẽ chạy tự động trên Ubuntu và Windows):

```bash
# Kiểm tra TypeScript typecheck
npm run typecheck
npm run typecheck:referee

# Kiểm tra linter
npm run lint

# Chạy toàn bộ test suites (unit tests + regression manifest)
npm test
```

---

## 3. Quy trình gửi Pull Request (PR Workflow)

1. **Tạo branch mới**:
   - Tính năng mới: `feat/<ten-tinh-nang>`
   - Tài liệu: `docs/<noi-dung>`
   - Vá lỗi: `fix/<loi-can-sua>`

2. **Commit message convention**:
   - Sử dụng định dạng Conventional Commits:
     - `feat: ...` cho tính năng
     - `fix: ...` cho sửa lỗi
     - `docs: ...` cho tài liệu
     - `test: ...` cho kiểm thử
     - `refactor: ...` cho tái cấu trúc mã nguồn

3. **Mở Pull Request**:
   - Mô tả rõ các thay đổi, lý do thay đổi và cách kiểm chứng.
   - Đảm bảo toàn bộ các checks trong CI/CD đều vượt qua (`All checks passed`).

---

## 4. Nguyên tắc cốt lõi của dự án

- **Quy tắc tất định trước (Deterministic First)**: Engine phân loại chạy hoàn toàn theo 24 quy tắc SOP tất định; không phụ thuộc vòng lặp agent AI.
- **Audit nối chuỗi SHA-256**: Mọi quyết định và thao tác đều phải ghi nhận nhật ký kiểm toán không thể đảo ngược hoặc giả mạo.
- **Không đoán bừa, không chuyển tiếp thừa**: Dừng đúng lúc, hỏi đúng người, bằng một câu hỏi có thể trả lời được ngay.
