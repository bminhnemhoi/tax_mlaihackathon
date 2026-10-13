# Bàn giao redesign Tax Referee

Ngày 13/10/2026. Triển khai và kiểm tra trên local; chưa deploy Hostinger. Giữ dữ liệu và thay đổi có sẵn. Base Git: `e0118601c12af43cd83ec0c550afad3852436f10`; working tree chưa commit. Production build: `FIvniG-36irscxZzz0snT`.

## Kết quả triển khai

- Hệ màu sáng trung tính/lime, Inter tự phục vụ, dữ liệu tài chính dùng tabular-nums, giảm font đậm và shadow. Select cũ chuyển sang sáng; toast dùng chung với safe area.
- Workspace có URL riêng, breadcrumb, sidebar/drawer và role switch. Bản nháp tiếp nhận giữ khi điều hướng client hoặc đổi vai trò; đổi vùng dữ liệu remount state. Không lưu ảnh/token vào localStorage. Reload toàn trang không khôi phục ảnh/bản nháp chưa lưu.
- Tách shell/session/data hook, danh sách, báo cáo, tiếp nhận nguồn/layout/submit bar và viewer chung. Một số điều phối nghiệp vụ vẫn nằm trong ProductionWorkspace/InteractiveInputForm để bảo toàn hành vi hiện có.
- API chi tiết dùng cùng read model, auth và database scope với Inbox; mở hồ sơ ngoài 200 dòng đã tải. Bộ lọc/page/tab có kiểm tra giá trị, Back/Forward và đường quay về giữ ngữ cảnh.
- Laptop/phone hiển thị toàn ảnh theo chiều rộng và chiều cao, không upscale ảnh nhỏ. Có fit/zoom/fullscreen; bỏ hướng dẫn nổi. Beam lime nằm trong vùng ảnh, chạy theo trạng thái thật.
- Chụp tiếp trực tiếp mở input rear-camera; QR đóng khi ảnh tới laptop và tiếp tục nhận ảnh tiếp theo trong phiên. Toaster không đổi bố cục.
- Hồ sơ tập trung câu hỏi, căn cứ và phương án; dữ kiện bổ trợ mở tại chỗ. Giữ mọi phát hiện và quyền/revision từ backend; không thay thuật toán SOP.
- Verify có ba phần, SOP tìm quy tắc, Policy giữ gate và phân biệt ghi chú/tham số. ERP ghi rõ xuất payload. Bảng kê mẫu được trình bày là nguồn đã nhập, không xác nhận kết nối TCT trực tiếp.

## Phủ route

| Route | Thực hiện | Bằng chứng / kiểm tra |
| --- | --- | --- |
| `/` | Màn vào, vai trò, demo, Verify; redirect phiên | `after-entry-1440.png`, HTTP 200 server bàn giao |
| `/workspace` | Redirect Inbox | Build route, shared session |
| `/workspace/inbox` | Dải số liệu, tìm/filter/query/page, link hồ sơ | `after-inbox-1440.png`, Back/Forward với search=0000123 |
| `/workspace/receive` | Hai cột / tab hẹp, submit bar, draft, ảnh | `after-receive-1440.png`, `receive-*.png`, QR browser |
| `/workspace/approvals` | Hồ sơ theo vai trò, không bỏ hồ sơ bị chặn duyệt | `after-approvals-1440.png`, chief/CFO |
| `/workspace/invoices/[id]` | Xử lý/nguồn/lịch sử, GET độc lập Inbox | `after-handoff-1440.png`, `after-source-1440.png`, unit >200 |
| `/workspace/audit` | Lọc sự kiện, hồ sơ, undo/override hiện có | `after-audit-1440.png`, tests workflow |
| `/workspace/suppliers` | Tên/MST/nguồn, kỹ thuật mở rộng | `after-suppliers-1440.png`, loading/error/retry |
| `/workspace/banking` | Giao dịch và thao tác khớp hiện có | `after-banking-1440.png`, trạng thái trống |
| `/workspace/reconciliation` | Nhóm chênh lệch, bảng, chi tiết mở rộng | `after-reconciliation-1440.png` |
| `/workspace/reports` | Số máy chủ, phạm vi 200, kỳ và bản nháp | `after-reports-1440.png` |
| `/workspace/notifications` | Danh sách/loại/đã đọc, đường tới quy chế | `after-notifications-1440.png` |
| `/workspace/policy` | Các tab có URL, gate/tác động giữ nguyên | `after-policy-1440.png`, Ghi chú → tab=EDIT |
| `/workspace/ledger` | Payload, config, xem bút toán | `after-ledger-1440.png`, Nợ/Có dựa số thật |
| `/verify` | Suite/results/custom, JSON/CSV, chi tiết kỹ thuật | `after-verify-1440.png`, live UI 5/5 |
| `/sop` | Mục lục, 22 quy tắc, tìm nhóm/tên | `after-sop-1440.png`, tìm “thanh toán” trả 1 quy tắc |
| `/capture/[id]` | Preview/gửi/chụp tiếp/safe area | `phone-preview-390.png`, `phone-sent-360.png`, capture suite |
| Lỗi / thiếu hồ sơ | State thay thế tại chỗ, retry | `missing-invoice-1440.png`, API 401/404, workspace error/not-found |

Ảnh nằm ở `docs/evidence/taste-redesign/`. Phủ responsive tập trung vào shell, receive, image và capture; không tuyên bố đã thử mọi tổ hợp dữ liệu/trạng thái của mọi route ở mọi kích thước.

## Component và baseline

`component-inventory.md` / `.json` kiểm kê 49 module component/hook, nơi tham chiếu, quyết định xử lý và hash hiện hành. `baseline-manifest.json` ghi 41 file UI trước sửa. Giữ logo; HeaderBanner, MacroHealthWidget và EscalationCard giữ interface tương thích, không mount thêm vào màn chính. Tooltip Radix giữ hành vi hiện có. Không xóa component chưa dùng chỉ vì chưa xuất hiện trên màn chính.

| Trước | Sau |
| --- | --- |
| `before-inbox-1280.png` | `after-inbox-1280.png` / `after-inbox-1440.png` |
| `before-receive-1280.png` | `after-receive-1280.png` / `after-receive-1440.png` |

Các ảnh và ca QR dùng fixture tổng hợp trong database `/tmp/tax-referee-taste-browser-runtime`, không phải chứng từ người dùng. Kết quả AI trong ảnh minh họa không được dùng làm bằng chứng độ chính xác trích xuất.

## Kiểm thử đã chạy

| Lệnh | Kết quả quan sát |
| --- | --- |
| `npm run typecheck` | Exit 0, không lỗi TypeScript |
| `npm run lint` | Exit 0, không warning/error |
| `NEXT_BUILD_DIR=.next-taste npm run build` | Exit 0; các route build thành công, shared JS 103 kB |
| `npm run test:manifest` | common 4/4, đề A 5/5, regression 15/15 |
| `npm run test:referee-core` | 14 kiểm tra; 60 ca tổng hợp và chạy đảo thứ tự |
| `npm run test:workflow` | 20 kiểm tra an toàn đạt |
| `npm run test:review-regressions` | 5 nhóm kiểm tra đạt |
| `npm run test:workspace-ui` | Fit dọc/ngang/no-upscale; query an toàn; >200/chuỗi số/quyền/401/404/cách ly DB đạt |
| `NEXT_BUILD_DIR=.next-taste npm run test:capture` | Token, ảnh, artifact riêng, gate ShopAIKey, follow-up, hết hạn và audit đạt |
| `git diff --check` | Exit 0 |

Log kiểm tra nằm trong thư mục evidence của máy chạy và được bỏ qua bởi Git; README và báo cáo ghi lệnh để tái chạy. Các kiểm thử nghiệp vụ dùng database cách ly; lỗi provider giả lập trong core là ca kiểm tra fallback, suite vẫn đạt. Không công bố độ chính xác thực tế từ các bộ tổng hợp này.

### Browser production

- Verify UI: 5/5, đúng 3 thường quy/2 chuyển tiếp, workflow/schema đúng.
- Hai lần gửi fixture trong cùng QR: phone báo đã gửi, laptop đóng QR và nhận ảnh; chụp tiếp mở file chooser từ input camera sau.
- Ảnh 640×760 trên laptop 1440×900: hiển thị 471,58×560, toàn ảnh nằm trong vùng xem; 74% là tỷ lệ thật.
- Bản nháp DRAFT-TASTE giữ sau Receive → Inbox → Receive và Chief → CFO. Bộ lọc tìm hóa đơn mã hóa trong URL; Back/Forward giữ query; đường quay về giữ bộ lọc.
- Mobile drawer có Chờ duyệt; focus vẫn trong dialog khi Tab, Escape đóng. Đã sửa và thử lại lỗi đóng drawer đồng thời chuyển breakpoint làm lớp aria-hidden còn treo.
- Hồ sơ thiếu dữ kiện vẫn chuyển tiếp theo engine hiện có, không tự duyệt. Không đổi quy tắc để ép form từ chối hồ sơ thiếu nghiệp vụ.
- 1280×720, 1440×900, 768×1024, 360×640, 390×844, 430×932: form không tràn ngang, nút thẩm định nằm trong viewport. Các rect ghi trong `viewport-checks.json`.
- 844×390: đã sửa thành vùng receive tối thiểu 36rem, document có thể cuộn tới nút; không cắt nút hoặc thu chữ. Số đo ban đầu trong JSON ghi rõ ca phát hiện lỗi; bằng chứng sau sửa là `receive-landscape-safe-scroll.png` và kiểm tra document scrollHeight=640 ở height=390.

## Giới hạn kiểm chứng còn lại

1. Cần chạy camera thật trên iPhone/Android: quyền camera, hủy picker, xoay dọc/ngang, browser chrome/safe area phần cứng, gallery, gửi lại do mạng và chụp tiếp. File chooser mô phỏng không chứng minh phần camera vật lý.
2. Chưa có số đo LCP/CLS chuẩn: công cụ trình duyệt hiện tại không hỗ trợ PerformanceTimeline, và scope đọc DOM không cung cấp Performance API. Không khẳng định đạt LCP <2,5s/CLS <0,1 từ thời gian build hay Verify. Cần Lighthouse/Performance trên production local, ghi thiết bị, throttle, cold/warm và tách thời gian AI.
3. Focus, nhãn, trạng thái sr-only, reduced-motion CSS và màu chính đã rà soát; chưa phải chứng nhận WCAG AA toàn sản phẩm hoặc kiểm thử thực tế VoiceOver/TalkBack ở mọi trạng thái. Cần nghiệm thu trợ năng bằng thiết bị/phần mềm đọc màn hình.
4. Danh sách vẫn giới hạn 200 theo backend, phân trang chỉ áp dụng số hồ sơ đã tải. Vị trí cuộn giữ trong phiên workspace bằng map bộ nhớ theo URL; đã thử 180px trước/sau mở hồ sơ. Reload toàn trang không giữ vị trí cuộn riêng; filter/page và URL vẫn giữ. Các link từ công cụ ngân hàng/TCT hiện quay về Inbox mặc định.
5. Server bàn giao dùng `next start` local với build `.next-taste`; bản commit chuẩn build bằng `npm run build` vào `.next`, Next cảnh báo cấu hình standalone. Deploy thật cần quy trình standalone hiện hành kèm static/public và cấu hình môi trường. Đợt này chưa thực hiện deploy.

## Dùng thử

Mở `http://localhost:3000/`. Từ Tiếp nhận chọn Chụp bằng điện thoại, dùng điện thoại cùng mạng quét QR. Server bind `0.0.0.0`, APP_PUBLIC_URL lấy địa chỉ mạng đang định tuyến lúc khởi động. Nếu đổi mạng sau khi chạy server, cần khởi động lại và tạo QR mới. Cổng HTTP local dùng file capture picker; không giả định getUserMedia HTTPS ở mọi thiết bị.

Các thay đổi nghiệp vụ, dữ liệu gán nhãn độc lập, xác minh nguồn luật và tích hợp ERP/ngân hàng/TCT thật thuộc đợt khác. Không phát triển trên Hostinger hoặc push GitHub trong lần bàn giao này.
