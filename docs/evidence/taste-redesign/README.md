# Bằng chứng redesign

Ảnh minh họa dùng dữ liệu thử tổng hợp hoặc workspace demo trống. Không lưu token QR, API key, database hoặc chứng từ người dùng trong thư mục này.

- `baseline-manifest.json`: hash 41 file UI trước khi sửa.
- `component-inventory.md` / `.json`: quyết định xử lý và tham chiếu tĩnh của 49 module component/hook.
- `image-manifest.json`: kích thước pixel, dung lượng và hash thực của từng PNG.
- `viewport-checks.json`: số đo DOM tại các kích thước yêu cầu; ca landscape có kết quả trước/sau sửa.

Hậu tố kích thước trong tên ảnh biểu thị viewport yêu cầu khi thử. Công cụ chụp in-app browser có thể scale hoặc crop vùng hiển thị: ví dụ `before-inbox-1280.png` chỉ lưu 447×720 pixel, `receive-1440x900.png` chỉ lưu 506×900. Các ảnh này chỉ minh họa phần đã chụp, không chứng minh toàn bộ màn hình ở kích thước đó. Đối chiếu manifest và số đo DOM; `after-receive-1440.png` có toàn bộ bố cục 1440×900.

Log kiểm thử được giữ trên máy chạy nhưng bị Git bỏ qua. Lệnh, kết quả và giới hạn nghiệm thu nằm trong [báo cáo bàn giao](../../taste-redesign-handoff.md); chạy lại theo README dự án để kiểm chứng bản checkout hiện tại. Camera thiết bị thật và LCP/CLS vẫn cần nghiệm thu riêng.
