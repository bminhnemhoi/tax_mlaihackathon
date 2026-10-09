# KỊCH BẢN VIDEO DEMO SẢN PHẨM (DƯỚI 3 PHÚT)
## DỰ ÁN: TAX REFEREE — THE ESCALATION REFEREE
### Cuộc thi MLAI Hackathon Track 2: OrganizationAI (Demo Day: 17/10/2026)

> **Quy định của Ban tổ chức:**
> - Thời lượng: **Tối đa 3 phút (180 giây)**.
> - Định dạng: Quay màn hình mộc (raw screen recording), không qua chỉnh sửa xảo thuật, thể hiện hệ thống đang vận hành thực tế và nêu rõ cả các điểm hạn chế.

---

## BẢNG PHÂN CẢNH VÀ THỜI LƯỢNG CHI TIẾT

| Phân Cảnh | Mốc Thời Gian | Thao Tác Màn Hình (Action) | Lời Thuyết Minh (Voiceover) |
| :---: | :---: | :--- | :--- |
| **Cảnh 1** | **0:00 - 0:25** (25s) | **Trang chủ (`http://localhost:3000`):**<br>- Mở trang chủ.<br>- Chỉ chuột vào nút xanh: **"VÀO WORKSPACE NGAY (CHẾ ĐỘ GIÁM KHẢO 1-CLICK)"**.<br>- Bấm 1 click -> Vào thẳng Bàn Thẩm Định. | *"Xin chào Ban giám khảo, đây là Tax Referee — Bộ trọng tài chuyển tiếp rủi ro hóa đơn đầu vào dành cho doanh nghiệp Việt Nam. Đúng theo thể lệ cuộc thi, Giám khảo có thể truy cập đường dẫn trực tuyến và vào thẳng bàn làm việc chỉ với 1 click, không cần đăng ký tài khoản, không cần cài đặt."* |
| **Cảnh 2** | **0:25 - 0:55** (30s) | **Bộ Verify Tự Động (`/verify`):**<br>- Chuyển sang trang Verify.<br>- Nhấn nút **"Chạy Bộ Kiểm Thử Verify"**.<br>- Bảng kết quả in tức thì kèm **Dấu thời gian thực** (Real Timestamp).<br>- Chỉ vào 3 ca `ROUTINE` (Xử lý thẳng) và 2 ca `ESCALATED` (Dừng lại). | *"Tại trang Verify, chỉ cần một thao tác bấm, hệ thống thực thi tự động toàn bộ 5 ca benchmark của Đề bài A trong 20 mili-giây. Kết quả in ra tức thì kèm dấu thời gian thực: 3 ca thường quy hợp lệ được tự động xử lý thẳng (STP), và 2 ca rủi ro bị dừng lại chuyển tiếp chính xác với câu hỏi A/B định lượng dứt khoát. Tỷ lệ bỏ sót vi phạm là 0%."* |
| **Cảnh 3** | **0:55 - 1:30** (35s) | **Trình diễn Ca Chuyển Tiếp (Escalation Card):**<br>- Mở chi tiết 1 ca bị dừng: Hóa đơn tiếp khách có bia rượu hoặc tiền mặt trên 5M.<br>- Quay cận cảnh **Thẻ Chuyển Tiếp (Escalation Card)**.<br>- Đọc to câu hỏi A/B.<br>- Nhấn chọn **Phương án B (Tách dòng hàng/loại thuế)**. | *"Đây là trái tim của hệ thống: Thẻ Escalation Card. Với hóa đơn tiếp khách có đồ uống có cồn, thay vì cấm đoán mù quáng hay tự tiện duyệt, AI dừng lại và đưa ra câu hỏi A/B dứt khoát: Phương án A là xác nhận có quy chế để khấu trừ toàn bộ, Phương án B là tách dòng hàng: khấu trừ tiền ăn và loại tiền rượu khỏi thuế GTGT. Kế toán trưởng chỉ cần bấm 1 click là hoàn tất quyết định mà không cần tra cứu hồ sơ gốc."* |
| **Cảnh 4** | **1:30 - 2:05** (35s) | **Kiểm thử Dữ liệu Mới của Giám Khảo (Sandbox):**<br>- Quay lại tab Hộp Cát Giám Khảo.<br>- Bấm nạp **"Ca Mới: Vi Phạm Pháp Lý (Thanh toán tiền mặt 12 triệu)"**.<br>- Hệ thống lập tức bóc tách XML, phát hiện vi phạm Điều 15 Thông tư 219 và **DỪNG LẠI CHUYỂN TIẾP**, không tự duyệt. | *"Bây giờ, chúng tôi kiểm thử với dữ liệu đầu vào mới của Giám khảo: Một hóa đơn 12 triệu thanh toán tiền mặt. Hệ thống lập tức bóc tách, nhận diện vi phạm quy định thanh toán không dùng tiền mặt và kiên quyết dừng lại, tuyệt đối không tự ý hạch toán. Đây là minh chứng cho nguyên tắc Zero Trust và bộ máy quy tắc tất định."* |
| **Cảnh 5** | **2:05 - 2:35** (30s) | **Nhật Ký Kiểm Toán & Nút Ghi Đè (Audit Trail & Override):**<br>- Vào tab **"Nhật Ký & Bằng Chứng"**.<br>- Bấm vào 1 dòng log kiểm tra chuỗi băm Merkle SHA-256.<br>- Bấm nút **Ghi đè (Override)** hoặc **Hoàn tác (Undo)**.<br>- Bấm nút **"Hồ sơ Thuế"** mở Tax Defense Dossier. | *"Tại phân hệ Nhật ký Kiểm toán, mọi thao tác của AI và con người đều được băm nối chuỗi Merkle SHA-256 bất biến. Giám khảo có thể tra cứu chính xác ai làm, lúc nào, vì lý do gì. Bấm nút Ghi đè (Override), hệ thống cho phép con người lật ngược phán quyết và ngay lập tức tạo khối kiểm toán mới. Bấm nút 'Hồ sơ Thuế', hệ thống xuất ngay biên bản giải trình thuế 1-click."* |
| **Cảnh 6** | **2:35 - 2:55** (20s) | **Nhìn nhận Giới hạn & Bất cập Thực tế (Trung thực):**<br>- Quay trở lại màn hình chính.<br>- Nêu rõ hạn chế và bất cập. | *"Cuối cùng, chúng tôi thẳng thắn nhìn nhận giới hạn: Với hóa đơn chụp quá mờ, hệ thống kiên quyết dừng lại không đoán mò. Về mặt tổ chức, bất cập hóa đơn bị nghẽn ngày cao điểm đã được chúng tôi giải quyết bằng tính năng tách thuế tạm tính để nộp tờ khai đúng hạn. Cảm ơn Ban giám khảo đã theo dõi!"* |

---

## HƯỚNG DẪN KỸ THUẬT QUAY VIDEO (RECORDING TIPS)
1. **Độ phân giải:** 1080p (1920x1080), tỷ lệ 16:9.
2. **Âm thanh:** Giọng nói rõ ràng, dứt khoát, không dùng nhạc nền quá lớn gây át tiếng.
3. **Thao tác chuột:** Di chuyển chuột dứt khoát, có hiệu ứng vòng tròn vàng quanh con trỏ khi click (nếu dùng OBS / Screenflow / QuickTime).
4. **Thời lượng:** Căn chỉnh đồng hồ dừng ở mốc **2 phút 50 giây - 2 phút 55 giây** để bảo đảm tuyệt đối không vượt quá 3 phút (vi phạm thời lượng bị trừ điểm nặng).
