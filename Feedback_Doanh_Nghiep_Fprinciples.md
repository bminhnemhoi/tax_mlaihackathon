# FEEDBACK TỪ DOANH NGHIỆP — SPRINT 1 (TRACK VNG)
## Đội thi: Fprinciples

---

### TỔNG QUAN ĐÁNH GIÁ
* **Xếp nhóm kỹ thuật**: Nhóm giữa
* **Tiềm năng thương mại thực tế**: **Cao**
* **Số kiểu dừng đạt chuẩn (Spec Stops)**: **2/3** kiểu dừng
* **Đánh giá năng lực thực thi**:
  * **Nó chạy (It runs - 40%)**: Partial Một phần
  * **Ranh giới con người (Human loop - 20%)**: Partial Một phần
  * **Khớp yêu cầu đề bài (Spec test - 20%)**: Strong Tốt
  * **Phương pháp kiểm chứng (Method - 20%)**: Strong Tốt

---

### 1. BÀI TOÁN & GIẢI PHÁP CỦA ĐỘI (WHAT THEY BUILT)
Tuân thủ thuế Việt Nam. Bóc tách XML hoá đơn điện tử từ các nhà phát hành lớn cùng file PDF và ảnh chụp; kiểm tra mã số thuế, số học, thời hạn kê khai và trùng lặp; lập hồ sơ giải trình cho đợt thanh tra.

---

### 2. GÓC NHÌN DOANH NGHIỆP & CHỖ ĐỨNG TRONG TỔ CHỨC THỰC TẾ
* **Định giá tiềm năng**: Mức **Cao**
* **Phân tích giá trị kinh doanh**:
Đây là bài toán có giá trị thương mại cao nhất cuộc thi, và khoảng cách không hề sát. Mọi doanh nghiệp tại Việt Nam đều phát hành và nhận hoá đơn điện tử. Phạt thuế là tiền mặt. Thuế GTGT đầu vào bị loại là tiền mặt. Và người mua của bạn không cần được thuyết phục rằng vấn đề tồn tại, vì cơ quan quản lý đã làm điều đó thay bạn. Bạn bóc tách đúng định dạng XML chuẩn quốc gia chứ không phải một định dạng demo tiện tay, nghĩa là bạn chạy được ngay ngày đầu tại doanh nghiệp thật thay vì sau sáu tháng tích hợp. Hãy định giá theo thuế đầu vào thu hồi được và tiền phạt tránh được, không phải theo số giờ tiết kiệm.

---

### 3. ĐIỂM SÁNG NỔI BẬT (STRENGTHS)
Bạn là đội duy nhất xử lý đúng hoá đơn điện tử Việt Nam. Chạy các kiểm tra tất định trước khi gọi mô hình là đúng thứ tự, và đó là lý do tỷ lệ báo lên sai của bạn gần bằng không trong khi của một đội khác thì thảm hoạ. Khoá chống trùng gồm mã số thuế cộng ký hiệu cộng số hoá đơn là tư duy kế toán thật.

---

### 4. MỘT RÀO CẢN BẮT BUỘC PHẢI SỬA (CRITICAL FIX)
> *Điểm nghẽn kỹ thuật/nghiệp vụ lớn nhất cần giải quyết ngay:*

Mọi thứ đang giữ trên RAM. Một lần khởi động lại xoá sạch mọi hoá đơn và toàn bộ dấu vết kiểm toán, và trên hạ tầng serverless việc đó tự xảy ra. Chuyển sang cơ sở dữ liệu thật.

---

### 5. KẾ HOẠCH HÀNH ĐỘNG ƯU TIÊN CHO SPRINT 2 (ACTION ITEMS)
1. Nối một cơ sở dữ liệu thật; dấu vết kiểm toán phải sống sót qua khởi động lại.
2. Tắt việc nạp thực thể ngoài trong bộ đọc XML — đây là lỗ hổng bảo mật thật.
3. Biến các script test thành bộ kiểm thử chuẩn.
4. Xung phong dùng phần xử lý hoá đơn điện tử của bạn làm ví dụ mẫu tại buổi tổng kết Sprint 2.

---

### 6. ĐỐI CHIẾU TIÊU CHUẨN KỸ THUẬT ĐỀ BÀI (SPEC COMPLIANCE CHECKLIST)
| Tiêu chí đối chiếu | Kết quả đánh giá |
| :--- | :--- |
| **Tài liệu quy định (Policy doc)** | Yes / Đạt |
| **Bộ dữ liệu thử nội bộ (Test set)** | Partial / Một phần |
| **Ba kiểu dừng riêng biệt (Three stops)** | Partial / Một phần |
| **Câu hỏi báo lên cụ thể (Specific question)** | Yes / Đạt |
| **Không bao giờ đoán bừa (No confident guess)** | Partial / Một phần |
| **Không báo lên thừa (No over-escalation)** | Partial / Một phần |
| **Đường dẫn chạy trực tiếp (Live URL)** | Partial / Một phần |
| **Lệnh chạy kiểm chứng (Verify run)** | Partial / Một phần |
| **Kho mã nguồn sạch (Repo clean)** | Partial / Một phần |

* **Ghi chú đối chiếu**: Vòng lặp agent không có trần số bước nên có thể chạy mãi thay vì dừng. Đó là lý do quy tắc dữ liệu bị đánh dấu chỉ đạt một phần.
* **Nhận xét tổng kết kỹ thuật**: Kiểm tra tất định chạy trước khi gọi mô hình — đúng thứ tự, và đó là lý do tỷ lệ từ chối nhầm hoá đơn điện tử gần bằng không. Có sổ bộ quy định. Dữ liệu XML thật từ nhà phát hành là dữ liệu thật, được tính cho tiêu chí phương pháp. Lưu trên RAM nên dấu vết kiểm toán mất khi khởi động lại.
