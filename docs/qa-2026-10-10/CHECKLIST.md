# Checklist chạy lại / tiếp tục

Mỗi dòng mở rộng thành ca riêng khi chạy: ID, vai trò, dữ liệu, tiền điều kiện, bước, expected/actual, UI/API/storage, bằng chứng và PASS/FAIL/BLOCKED/NOT_RUN. Status ở đây là mức phủ nhóm, không thay thế results.csv.

| Nhóm | Đã thực hiện | Còn phải chạy |
|---|---|---|
| Phiên/đăng nhập | API3vai trò, sai password, expiry, logout, switch demo/internal; Verify Chrome/Safari | UI đăng nhập sai/expiry và lỗi khởi tạo demo/retry trên2browser |
| Sandbox |2demo API, chéoinvoice/artifact404, reset, Verify không đổiDB; banking leakFAIL | Export chéoID cho mọiđịnhdạng và2cửa sổ xử lý cùng hồ sơ |
| Parser | XML/missing/hỏng/rỗng/15MB/over/unsupported; text/PDF/image; sourcehash | Drag/drop, đổi file lúc đọc, reread, nhiều trang/rotate thành công với model mới |
| Form | Nhập thiếu→uncertain, XMLsource, nextinvoice; API sai ngày/MST/type | Mọi inlineerror/focus, sốâm/sốlớn/decimal, mấtmạngretry, PDFzoom/pan/assistant |
| Rules | Routine/3nhóm, thiếu/mờ/tổng/dòng/MST/status/manifest/adjust/sign/series/MCCQT | VAT0/5/8/10 đủcategories, reimbursement, cancelled, buyer/source branches |
| Biên/nhiều phát hiện | TM T−1/T/T+1, authority L−1/L/L+1, cùng ngày, multifindingguard | K min/max−ε/=/+ε, rounding, đảo thứtự nhập, effective-date branch không bị configoverride |
| Bàn thẩm định | UI detail, counters, chuyển trang; APIinbox | Search có/khôngdấu, combinedfilters, pagination/lớndữliệu, mọitab |
| Resolution | CFOauthority, KTTspoofdenied, sourceguard, invalidoptions/API | MỗiA/B/reject/forward/onhold trênUI với từngvai trò |
| Bổ sung | Revisioncurrent/stale, confirm+editinvalidates, paused409 | JSONeditor malformed/partial và chứngtừgốc trênUI |
| Dừng/undo/taxhold | APIeffects/voucher/tax/macro/precedent; UIdừng/undo | Undo reject/từngnhánhsource, lateAI pause quaUI, quyền UI taxhold |
| Race/idempotency | Doubleeval concurrent, onevoucher,409, atomicaction; safetytest |2browser resolution đồngthời, policychange inflight |
| Audit/dossier | Chain, note, JSON/print, oldGemini regression, UIhistory | Bảninvisualmọitrang, nonexistent/đườngdẫn bấtthường đầyđủ |
| Policy/legal | API draft/validate/publish/rollback/rights/webhook/syncempty/reject | Legalapprove effects, feedtimeout/invalid, studioeditor đầyđủUI |
| Precedent/feedback | CFOscope,10labels,9/10adapt,duplicate,rollback/revoke;originundo | Expired/supplier/purpose/trần matrix, tie/noimprovement/safetygate đầyđủ |
| Banking/TCT | Importvalid/empty/hỏng/repeat,match,scope; UIFAIL | Formatdate/money/ambiguousmatch, allTCTstatus/navigation saufix |
| Supplier/lookup | APIquery/filter/seed/evidence/name/error; UIsnapshot | UIsearch/filter không có trênmànhiệnhành; nguồnconflict/timeout độc lập |
| Notifications | APIlist/filter/read/all/bad | UIpopover navigation/reload/changeuser; per-user semantics |
| Accounting/ERP/taxforms |2regimes×4adapter,balanced/export;json/html2forms;holdexcluded | Negative/round/specialCSVformula/invoice-selection/periodmatrix, download+print UI |
| Verify |4/5/15API+UI, repeat/newinputinvalid, workspaceunchanged |2minh họa và UInewJSON lỗi network/questions mọibranch |
| Accessibility/responsive | Screenshots1366/768/375; Escape focusFAIL | Tabtrapmọimodal, zoom200%, contrast/noncolor, realdeviceBLOCKED |
| Performance/recovery |1/5/10Verifybatch, restart/offlinebackuprestore/standalonehealth | peakRAM, sustainedload, rate-limit/requestsize cho mọiendpoint,8minrehearsal |
| Deploy/integration | Localproduction và AI16request | DockerLinux/HTTPS/liveBLOCKED; externalfeedBLOCKED;3users/independentlabelsBLOCKED |

Các lỗi P0/P1 trong bugs.md cần được sửa theo yêu cầu riêng của người dùng trước khi kiểm thử hồi quy. Không đổi policy để đạt đáp án.
