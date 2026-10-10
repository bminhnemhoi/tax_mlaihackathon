# Bóc tách hóa đơn: tối ưu và so sánh model — 10/10/2026

**Kết quả: CHƯA ĐẠT yêu cầu ảnh mới → dữ liệu trên web dưới 2 giây và chính xác cao.** Giữ Qwen3.7 Flash mặc định; không chuyển sang model đọc sai dữ liệu chỉ vì nhanh hơn. Các con số dưới đây là quan sát trên mẫu nhỏ, không phải SLA hoặc tỷ lệ chính xác trên tập đánh giá độc lập.

## Thay đổi đã thực hiện

- Prompt ngắn, JSON dùng khóa gọn; ánh xạ về tên trường API hiện hành. Nêu rõ số 0 đầu MST, thuế suất dạng phần trăm, không tự điền dữ liệu thiếu.
- Tắt reasoning cho Vision; cấu hình provider theo từng model và khả năng endpoint. Ling/Novita và Nex không gửi `response_format` không được endpoint hỗ trợ. Không tự chuyển sang provider khác có giá khác khi endpoint lỗi.
- Dùng sharp trong bộ nhớ thay subprocess để tối ưu ảnh. Giữ nguyên ảnh nhỏ để bảo toàn chữ; ảnh lớn giới hạn cạnh 1800px, JPEG chất lượng 88.
- Cache kết quả theo hash chứng từ, database phiên, phiên bản prompt/model/chuẩn hóa. Giữ cảnh báo và trạng thái cần xác minh. `forceRefresh=true` bỏ qua cache. Không có cache dùng chung giữa các phiên.
- API trả `performance.totalMs`, `performance.cacheHit`, Server-Timing và no-store. UI đo từ khi bắt đầu xử lý file đến khi form đã được vẽ, gồm upload, backend và hai animation frames; không gồm thời gian người dùng chọn file trong hộp thoại. Cache được ghi rõ trên UI.
- Xóa số đo khi sang hóa đơn tiếp theo; loading không còn quảng cáo “siêu tốc” hoặc gọi tên Qwen khi server đang dùng model khác.
- Phát hiện qua ảnh thật và sửa lỗi chuẩn hóa `HD198735` thành `198735`: chỉ bỏ nhãn đi kèm dấu hai chấm, giữ tiền tố mã và số 0. Cache được tăng phiên bản để không trả mã đã chuẩn hóa sai.
- Chặn phản hồi bị cắt do giới hạn token; không lấy reasoning thay cho nội dung JSON.

## Khảo sát giá và chọn ứng viên

Giá USD / triệu token vào và ra, kiểm tra từ catalog/endpoint OpenRouter ngày 10/10/2026; không bao gồm quy đổi tiền tệ. Giá token không phải chi phí cố định mỗi ảnh.

| Model | Input / Output | Provider thử | Kết luận sau thử |
|---|---:|---|---|
| [Qwen3.7 Flash](https://openrouter.ai/qwen/qwen3.7-flash) | 0.03 / 0.13 | Alibaba | Giữ mặc định; đọc tổng tiền tốt hơn Nex trên mẫu thật nhưng chưa đạt tốc độ hoặc OCR hoàn toàn chính xác |
| [Ling 3.0 Flash VL](https://openrouter.ai/inclusionai/ling-3.0-flash-vl) | 0.021 / 0.0616 | Novita | Giá khuyến mại; còn sai MST và vượt 2 giây trên mẫu rõ/xoay |
| [Nex N2.5 Mini](https://openrouter.ai/nex-agi/nex-n2.5-mini) | 0.025 / 0.10 | Nex AGI | Rẻ hơn Qwen, có một lượt API dưới 2 giây; không ổn định và đọc sai tiền trên ảnh thật |
| [Gemini 2.5 Flash Lite](https://openrouter.ai/google/gemini-2.5-flash-lite) | 0.10 / 0.40 | Google AI Studio | Khoảng 3 lần đơn giá Qwen, không chỉ mắc hơn một chút; chậm và bịa dữ liệu trên ảnh mờ trong thử nghiệm |
| [Nova Lite 1.0](https://openrouter.ai/amazon/nova-lite-v1) | 0.06 / 0.24 | Amazon Bedrock | Khoảng 2 lần đơn giá Qwen; đọc sai số tiền gấp 10 lần trên mẫu giả lập |

P50 latency / throughput của nhà cung cấp là tín hiệu để chọn ứng viên; không phải thời gian trả đủ JSON, độ chính xác hóa đơn tiếng Việt hay cam kết dưới 2 giây. Tham khảo [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection) và [reasoning tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens).

## Phương pháp và giới hạn

Server standalone production riêng cổng 3001; database và artifact nằm trong thư mục tạm. API nhà cung cấp đi qua proxy kiểm soát số lượt, gọi tuần tự; có thêm một chặng local proxy, không phải môi trường live. Workspace nội bộ không được dùng làm database thử nghiệm. Các model dùng cùng ảnh và cùng prompt trong mỗi vòng so sánh.

Counter nhà cung cấp kết thúc ở 50: 18 lượt QA cũ, 2 lượt baseline Qwen trên UI, 20 lượt so sánh/kiểm chứng giả lập bổ sung, và 10 lượt trên 5 ảnh thật được người dùng cho phép. Request bị proxy chặn không tới nhà cung cấp và không nằm trong số này. Không retry inference tự động. Phiên thử cuối đã tắt gọi ngoài.

Ảnh giả lập chỉ có một hóa đơn và các biến thể rõ/xoay/mờ, không được coi là nhiều hóa đơn độc lập. Ảnh thật là 5 file JPG trong `input-sample`, đọc đáp án từ ảnh gốc; README có thông tin sai ở các file 08–10 nên không dùng làm ground truth. Các đáp án nằm trong `real-sample-truth.json`; tên đơn vị có thể gồm tên chi nhánh, số hóa đơn Co.op có cả `Số HĐ` và mã ở cuối phiếu nên cần người nghiệp vụ xác nhận định danh mong muốn. Không chấm số liệu suy ra như thể đã in trên chứng từ.

## Thời gian UI quan sát

| Trường hợp | Thời gian từ file đến form | Cache | Kết luận |
|---|---:|---|---|
| Qwen prompt compact v1, giả lập rõ | 3.773s | Không | FAIL <2s, 10 trường khớp đáp án |
| Qwen prompt compact v1, giả lập xoay | 3.772s | Không | FAIL <2s, 10 trường khớp đáp án |
| Qwen prompt compact v2, giả lập rõ | 3.039s | Không | FAIL <2s |
| Nex compact v1, giả lập rõ | 2.47s | Không | FAIL <2s; MST cần xác minh |
| Qwen compact v2, ảnh thật Game & Hobby | 4.679s | Không | FAIL <2s |
| Nex compact v2, cùng ảnh thật | 2.304s | Không | FAIL <2s; tự điền CASH và thuế 0 không in trên ảnh |
| Đọc lại ảnh rõ Qwen v2 | 0.137s | Có | PASS đường cache, không phải OCR ảnh mới |
| XML giả lập mới | 0.071s | Không | PASS đường XML |
| PDF có lớp chữ giả lập mới | 1.382s | Không | PASS đường PDF có chữ; không đại diện PDF scan |

Các giá trị chính xác có thể đối chiếu JSON trong `performance-evidence`; screenshot chụp trước sửa lỗi tiền tố thể hiện trung thực bản đã đo. Không lấy số cache, XML hoặc ảnh mờ trả rất ít trường để chứng minh ảnh mới đọc đủ dữ liệu dưới 2 giây. Thay đổi prompt/cache/version giữa các lượt không đủ để quy toàn bộ chênh lệch tốc độ cho tối ưu; chưa đo p95 hoặc tải đồng thời.

## So sánh API trên giả lập

- Ling v1 rõ/xoay/mờ: 2.716 / 2.181 / 1.283s. Xoay sai MST; mờ trả `blur=true`.
- Nex v1 rõ/xoay/mờ: 2.366 / 1.568 / 1.799s. Rõ và xoay sai MST; mờ trả `blur=true`.
- Gemini v1 rõ/xoay/mờ: 3.595 / 2.981 / 3.008s. Thuế suất 0.1 thay vì 10; ảnh mờ bịa hóa đơn, MST và số tiền.
- Ling v2 rõ/xoay: 2.103 / 2.972s. Ảnh rõ 10 trường khớp; xoay vẫn sai MST.
- Nex v2 rõ/xoay: 1.554 / 2.260s. Ảnh rõ 10 trường khớp; xoay vẫn sai MST.
- Qwen v2 rõ/xoay/mờ: 2.900 / 3.055 / 1.374s. Rõ/xoay 10 trường khớp; mờ trả `blur=true`.
- Nova v2 rõ/mờ: 2.630 / 1.710s. Ảnh rõ sai MST, tiền trước thuế/thuế/tổng tăng 10 lần; mờ trả `blur=true`.

## So sánh trên ảnh thật

Bốn ảnh đầu đo toàn bộ API inference, ảnh 11 đo toàn bộ UI. Hai loại thời gian được ghi riêng, không gộp thành percentile.

| File | Tổng tiền đọc tay | Qwen API | Nex API | Đọc tổng tiền Qwen / Nex |
|---|---:|---:|---:|---|
| 07 | 11,500 | 3.249s | 2.557s | Đúng / Đúng |
| 08 | 13,832 | 3.785s | 2.237s | Đúng / Đúng |
| 09 | 26,400 | 3.764s | 2.110s | Đúng / Sai 28,640 |
| 10 | 28,200 | 3.371s | 2.078s | Đúng / Sai 31,020 |
| 11 | 1,380,000 | UI 4.679s | UI 2.304s | Đúng / Đúng |

Tổng tiền khớp 5/5 với Qwen và 3/5 với Nex **chỉ là metric tổng tiền trên 5 ảnh**, không phải độ chính xác OCR chung. Cả hai còn tự suy ra thuế trên phiếu không ghi thuế suất; Nex còn biến điện thoại/mã nhân viên/mã hàng thành MST, sai số tiền và tự đoán phương thức thanh toán. Qwen đọc mã Co.op ở cuối phiếu thay vì trường `Số HĐ`; cần xác nhận nghiệp vụ về định danh. Thiếu MST/bằng chứng vẫn phải qua review; không có bằng chứng rằng chỉ đổi model sẽ đạt nghiệm thu an toàn.

## Kiểm chứng mã và chạy lại

## Bổ sung: 10 ảnh hóa đơn Việt Nam chụp camera từ nguồn công khai

Đã chạy lại đường upload multipart của server local trên 10 ảnh JPG/PNG dạng
ảnh chụp hóa đơn/phiếu Việt Nam trong thư mục `stock/receipt` của repository
[tienhung2812/ocr](https://github.com/tienhung2812/ocr). Đây là phép đo OCR local
với `LOCAL_OCR_QWEN_FALLBACK=false` để không phát sinh request bên ngoài; khi
triển khai thật, các ca thiếu trường hoặc có vùng số tiền đáng ngờ sẽ gọi
Qwen3.7 Flash semantic extraction theo cơ chế mới.

Kết quả end-to-end (upload → parse → trả JSON) là 10/10 dưới 2 giây; min
736ms, median 1,044ms, p95/max 1,730ms. Độ chính xác theo các trường có đáp án
đọc tay: tên bên bán 10/10, số hóa đơn 6/7, ngày 7/9, tổng tiền 9/10, phương
thức thanh toán 7/7; tổng cộng 39/43 trường (90.7%), 7/10 bản ghi đủ các trường
được chấm. Ảnh `17.jpg` bị OCR đọc tổng tiền thành `69` thay vì `679999`; ca
này được coi là không chắc chắn và phải chuyển Qwen/kiểm tra người dùng, không
được tự duyệt. `accuracy.json`, `api-results.json` và `manifest.json` trong
`internet-vn-camera-10` là bằng chứng có thể chạy lại.

Đường trích xuất mới không dùng tên nhà cung cấp hay bố cục bộ mẫu. OCR local
chỉ tạo transcript và candidate có bằng chứng; Qwen3.7 Flash nhận transcript
ngắn khi độ tin cậy thấp, còn Vision chỉ là phương án dự phòng khi transcript
quá ngắn hoặc lỗi. Rule engine vẫn kiểm tra độc lập và không cho model suy ra
thuế, MST hoặc giá trị không nhìn thấy.

Typecheck, production build, acceptance (4/5/15, workflow/fallback/review và 38 QA regression), API smoke và recovery chạy trên môi trường tách riêng, không gọi provider thật. Log nằm cùng bằng chứng. Những check này không chứng minh OCR chính xác hoặc tốc độ nhà cung cấp.

Để đo lại: tạo DATA_DIR/DB_PATH mới, build standalone, chọn `OPENROUTER_MODEL`, mở demo → Tiếp nhận, chọn ảnh đã có đáp án, ghi `data-elapsed-ms` và `data-cache-hit` từ status UI; chỉ chấm OCR mới khi cache false. Đối chiếu raw extraction review và dữ liệu form với ảnh; xác nhận thuế/MST thiếu không tự trở thành sự thật. Lặp từng model tuần tự, khóa số lượt nhà cung cấp và ngừng khi hết ngân sách. Không dùng database nội bộ hoặc truyền thêm ảnh thật nếu chưa được phép.

**Quyết định:** giữ Qwen3.7 Flash; các profile thay thế chỉ để thử có kiểm soát qua env, chưa được khuyến nghị production. Mốc dưới 2 giây trên ảnh mới vẫn FAIL. Cần vòng thử tiếp theo trên tập đa dạng đã gán nhãn, có tiêu chí số trường đúng, không bịa trường thiếu, và thời gian end-to-end; không thể nghiệm thu bằng tên model hoặc thông số token/giây.

## Thử Qwen3-VL-8B trên OpenRouter (10/10/2026)

Theo yêu cầu, đã dùng đúng 10 ảnh trong bộ `internet-vn-camera-10` cho tối đa
10 request thật. Model được thử là
[`qwen/qwen3-vl-8b-instruct`](https://openrouter.ai/qwen/qwen3-vl-8b-instruct),
không chạy trên máy local. Catalog OpenRouter công bố giá 0.117/0.455 USD mỗi
triệu token vào/ra và hỗ trợ JSON schema; số liệu provider hiển thị không phải
độ trễ end-to-end của một ảnh hóa đơn.

Tại thời điểm chạy, API endpoint không có Alibaba Cloud Int. cho model này:
request khóa provider Alibaba trả HTTP 404 (`No endpoints found`); truy vấn
endpoints chỉ còn Parasail. Vì vậy phép đo tự định tuyến là phép đo khả dụng
thực tế, không được ghi thành kết quả của Alibaba.

| Chỉ số | Kết quả |
|---|---:|
| Request thật | 10 |
| Thành công / bị 429 | 5 / 5 |
| Provider của request thành công | Parasail |
| Độ trễ thành công | 14.912–28.039 giây |
| Trung vị / p95 | 16.902 / 18.092 giây |
| Thành công dưới 2 giây | 0/5 (và 0/10 nếu tính cả lỗi) |
| Trường đúng trên các response thành công | 20/21 = 95,24% |
| Chi phí ghi nhận | 0,00118593 USD |

Model đọc đúng toàn bộ trường của `10.jpg`, `13.png`, `15.jpg`; ảnh `14.jpg`
sai tên nhà cung cấp (`CUM` thành `CỤM`), còn `17.jpg` đọc thêm các giá trị
không có trong ground truth dù tổng tiền và tên đúng. Năm request còn lại bị
rate-limit upstream. JSONL và mã benchmark được lưu tại
`qwen3-vl-8b-openrouter-output.jsonl` và
`scripts/benchmark_openrouter_qwen3_vl_8b.py`.

**Quyết định không tích hợp Qwen3-VL-8B vào UI:** không đạt SLA dưới 2 giây,
không đạt 100% trên mẫu đã chạy, và provider Alibaba không khả dụng để khóa.
Giữ cơ chế hiện tại: OCR local trả kết quả nhanh cho ảnh rõ; chỉ gửi ca thiếu
bằng chứng/mâu thuẫn sang model cấu hình, giữ giá trị chưa chắc chắn và yêu cầu
người dùng xác minh thay vì tự ghi nhận.

## Khảo sát VLM giá rẻ, latency catalog dưới 1 giây

Đây là shortlist từ catalog OpenRouter ngày 10/10/2026, chưa được coi là kết
quả OCR hóa đơn thực tế. Latency của catalog là P50 theo provider; nó không bao
gồm đầy đủ thời gian upload ảnh, proxy, resize, JSON parse và render form.

| Model | Giá input/output USD/M | P50 catalog | Structured JSON | Đánh giá chọn |
|---|---:|---:|---|---|
| [Qwen3.7 Flash](https://openrouter.ai/qwen/qwen3.7-flash) | 0.03 / 0.13 | 0.69s Alibaba | JSON object, không ép JSON schema | Rẻ nhất; đã đo UI thực tế 3–4,7s nên chưa đạt |
| [Gemini 2.5 Flash Lite](https://openrouter.ai/google/gemini-2.5-flash-lite) | 0.10 / 0.40 | 0.41–0.53s | Có JSON schema | Ứng viên tốt nhất cho thử nghiệm tốc độ; OpenRouter ghi model sẽ ngừng ngày 20/10/2026 |
| [Gemini 3.1 Flash Lite](https://openrouter.ai/google/gemini-3.1-flash-lite) | 0.25 / 1.50 | 0.45–0.73s AI Studio | Có JSON schema | Ưu tiên nếu cần chất lượng mới hơn và chấp nhận giá cao hơn |
| [GPT-4o mini](https://openrouter.ai/openai/gpt-4o-mini) | 0.15 / 0.60 | 0.54s OpenAI | Có JSON schema | Có thể làm baseline, nhưng chưa có phép đo tiếng Việt trong bộ này |

Theo mục tiêu giá/thời gian, lựa chọn hợp lý để chạy vòng thử tiếp theo là
**Gemini 2.5 Flash Lite trên Google AI Studio**, với reasoning tắt, prompt JSON
ngắn, `max_tokens` thấp và `provider.only` cố định. Nếu cần model còn được hỗ
trợ sau ngày 20/10, chuyển sang **Gemini 3.1 Flash Lite**. Không được tuyên bố
model nào đạt dưới 1 giây hay 100% cho hóa đơn nếu chưa đo end-to-end trên ảnh
được gán nhãn.

## Đo API mới ShopAIKey — Gemini 2.5 Flash (10/10/2026)

Cấu hình runtime hiện tại được kiểm tra là endpoint `api.shopaikey.com` với
model `gemini-2.5-flash`. Phép đo dùng ảnh `input-sample/10_real_bill_restaurant.jpg`,
không ghi API key vào log. Thời gian giao diện được đo qua chính
`POST /api/documents/parse` mà `InteractiveInputForm` gọi; `totalMs` lấy từ
`Server-Timing` của route, còn `clientMs` bao gồm upload và nhận JSON.

| Đường đo | Kích thước ảnh gửi API | Kết quả |
|---|---:|---:|
| UI route hiện tại, lần 1–3 | server resize 1000px/JPEG q80 | 3.491–4.270s server; 3.499–4.282s client |
| Native API trực tiếp, ảnh gốc | 344,742 bytes | 6.527s |
| Native API trực tiếp, 1000px/JPEG q80 | 91,645 bytes | 3.632–5.023s trong 2 lượt |
| Native API trực tiếp, 800px/JPEG q70 | 40,304 bytes | 2.582–3.098s trong 4 lượt |
| Native API trực tiếp, 700px/JPEG q65 | 29,418 bytes | 2.963s |
| Native API trực tiếp, 600px/JPEG q60 | 20,462 bytes | 2.853s |

Kết luận về giới hạn hiện tại:

- Cache hit gần như không đại diện cho lần bóc tách đầu tiên; chỉ lần đầu với
  ảnh mới được dùng để chấm SLA.
- Với API/model hiện tại, sàn thực tế quan sát được cho ảnh mới là khoảng
  **2.6 giây ở server** khi nén 800px/JPEG q70. Cộng upload, xử lý route và
  cập nhật React, thời gian người dùng thấy hợp lý là khoảng **2.7–3.3 giây**.
- Cấu hình 1000px/JPEG q80 hiện tại giữ biên an toàn đọc chữ tốt hơn nhưng nằm
  ở khoảng **3.5–4.3 giây trên UI**.
- Vì provider đã mất hơn 2.5 giây ngay cả với payload 40KB, không thể đạt dưới
  1 giây cho lần bóc tách ảnh mới chỉ bằng tối ưu React hoặc JSON prompt. Muốn
  dưới 1 giây cần OCR local/NPU hoặc provider inference gần máy; VLM từ xa chỉ
  nên chạy như bước xác minh khi OCR local có confidence thấp.

Các số trên là latency quan sát được trong một cửa sổ đo, không phải SLA bảo
đảm. Cần chạy lại trên máy triển khai và nhiều ảnh trước khi đổi mặc định nén
ảnh; giảm xuống 800px có thể làm mất chữ nhỏ, nên mọi ca confidence thấp phải
được giữ ở trạng thái chờ xác minh thay vì tự duyệt.
