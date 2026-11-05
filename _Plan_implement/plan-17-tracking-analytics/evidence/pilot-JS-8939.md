# Báo cáo review tracking — JS-8939 Filter tỉnh thành (vieclam24h.vn, ứng viên)

- **Phạm vi**: trang tìm việc `/tim-kiem-viec-lam-nhanh`, filter tỉnh thành (cũ / sau sáp nhập), Desktop 1920, khách chưa đăng nhập
- **Nguồn behavior**: chạy flow thật trên QC `https://seeker.vl24hv2.qc.sieuviet-team.com` (flow đã build nên không dùng Figma)
- **Công cụ**: helper `playwright/tests/support/mixpanel-capture.ts` (Plan 17 Phase 2), spec pilot tạm ngoài repo
- **Mixpanel project**: Not used. Project `vieclam24h.vn-*` nằm ở vùng EU, MCP đang nối vùng US
- **Ticket**: [JS-8939](https://sieuviet.atlassian.net/browse/JS-8939), trạng thái READY ON STAGING
- **Liên quan**: verify chức năng cùng ngày tại `D:/_SV_Automation/evidence/JS-8939/REPORT_JS-8939_2026-11-05.md`.
  Báo cáo này không làm lại phần đó; nó review **thiết kế tracking** và ảnh hưởng tới report.
- **Ngày review**: 2026-11-05

## 1. Tóm tắt

- Kết quả verify chức năng khớp với report SV_Automation: không chọn tỉnh → `null/null`; Hà Nội (cũ) → `1 / "1.0"`;
  Toàn quốc (mới) → `34 / "2.0"`; sau F5 → `63 / "1.0"`.
- 4 rủi ro thiết kế làm report sai hoặc khó: `Job Search Performed` bắn khi **load/reload trang** (thổi phồng số search);
  `province_number` mang 2 nghĩa; F5 làm mất phiên bản filter; **Áp dụng** không bắn event nào trên web.
- Report làm được: 1/6 | Một phần: 3 | Chưa làm được: 1 | Chưa kiểm chứng: 1.

## 2. Flow và event (Desktop, guest)

| # | Bước người dùng | Event bắn | Property chính | Ghi chú |
|---|---|---|---|---|
| 1 | Mở trang tìm việc | `The_South_Star` ×2, `Job Search Performed`, `view_entry_point_chatbot` | JSP: `province_number` null, `filter_version` null, `from_page` `JS_SearchPage`, không có `action` | JSP bắn khi chỉ load trang |
| 2 | Bấm Tìm kiếm, không chọn tỉnh | `The_South_Star` ×2, `Job Search Performed` | null / null | Đúng ticket |
| 3 | Chọn tỉnh → **Áp dụng** | *(không có)* | — | Không event, không đổi URL cho tới khi bấm Tìm kiếm |
| 4 | Cũ: Hà Nội → Áp dụng → Tìm kiếm | `Job Search Performed` | `province_ids` [73], `action` `province`, `1 / "1.0"`, `district_number` 0 | Đúng |
| 5 | Mới: Toàn quốc → Áp dụng → Tìm kiếm | `Job Search Performed` | `province_ids` [136], `34 / "2.0"` | URL `viec-lam-toan-quoc-p136.html` |
| 6 | F5 ở bước 5 | `Job Search Performed` | `province_ids` [136], **`63 / "1.0"`**, **cùng `request_id`** với bước 5 | Mất phiên bản filter |
| 7 | F5 ở trang không filter rồi bấm Tìm kiếm | `Job Search Performed` ×2 | `request_id` giống nhau, `search_id` khác | Một kết quả search bị đếm 2 lần |

`The_South_Star` là event exposure A/B (`testing_name`, `group_name`): một event cho mỗi experiment, nên 2 event/lần là đúng.

## 3. Findings

| Mã | Loại | Checklist | Bằng chứng | Vấn đề | Đề xuất |
|---|---|---|---|---|---|
| TR-RISK-01 | Thiết kế · Major | TR-21, TR-13 | Bước 1, 6, 7 | `Job Search Performed` bắn cả khi load/reload trang, không chỉ khi user tìm. Load trang không có `action`; reload gửi lại cùng `request_id` | Thêm property `trigger` (`page_load` / `search_button` / `reload` / `pagination`…). Trước mắt, report đếm search của user phải lọc `action` hoặc dedupe theo `request_id` |
| TR-RISK-02 | Thiết kế · Major | TR-13, TR-31 | Bước 5, 6 | `province_number` vừa là "số tỉnh đã chọn", vừa mã hoá "Toàn quốc" = tổng số tỉnh (34/63). Không phân biệt được Toàn quốc với việc chọn tay đủ mọi tỉnh. Phiên bản filter phải suy ngược từ con số | Thêm `province_scope` (`none` / `nationwide` / `specific`), giữ `province_number` là số tỉnh thật và `filter_version` là nguồn duy nhất cho phiên bản |
| TR-RISK-03 | Thiết kế · Major | TR-20, TR-23 | Bước 6 | Sau F5, UI và tracking cùng về filter cũ (`63 / "1.0"`) vì URL `…-p136.html` không lưu phiên bản. Ticket kỳ vọng "giữ đúng filter version khi reload" | Lưu phiên bản vào URL/query hoặc storage. Nếu PO chấp nhận hành vi hiện tại, ghi rõ trong tracking plan rằng reload = filter cũ |
| TR-RISK-04 | Thiết kế · Minor | TR-04, TR-01 | Bước 3 | Bấm Áp dụng trên Desktop không bắn event. `Search Filter Applied` không có trên web (report SV) | Xác nhận event filter có cần trên web không. Nếu cần, bắn `Search Filter Applied` khi Áp dụng với cùng bộ property |
| TR-REC-01 | Đề xuất | TR-10 | Bước 1 | Tên event lẫn nhiều kiểu: `Job Search Performed`, `The_South_Star`, `view_entry_point_chatbot`, `view_hover_content` | Chốt một convention cho event mới; event cũ giữ nguyên, đặt display name trong Lexicon |
| TR-REC-02 | Đề xuất | TR-30, TR-35 | Mọi JSP | `url`, `refer_page` là chuỗi URL-encode; `experiments` là object lồng nhau | Gửi path chưa encode. Breakdown experiment dùng `The_South_Star` / `ab_version` thay vì object lồng |
| TR-REC-03 | Đề xuất | TR-30 | Bước 4–6 | `filter_version` gửi dạng **chuỗi** `"1.0"` / `"2.0"`, trong khi solution PO mô tả là "số" | Chốt kiểu dữ liệu trong tracking plan; nếu là số thì gửi `1` / `2` |

Không thấy PII trong payload guest. `distinct_id` dạng `$device:…`, `user_id` null, có `session_id`/`device_id`.

## 4. Report khai thác được

| Câu hỏi business | Loại report | Trạng thái | Đang có | Còn thiếu |
|---|---|---|---|---|
| Số lượt tìm việc theo thời gian | Insights | Một phần | `Job Search Performed`, `request_id` | `trigger` để loại load/reload (TR-RISK-01) |
| Tỉ lệ search không chọn tỉnh / Toàn quốc / tỉnh cụ thể | Breakdown | Một phần | `province_number` null / 34·63 / khác | `province_scope` (TR-RISK-02) |
| Mức dùng filter mới so với filter cũ | Breakdown theo `filter_version` | Một phần | `filter_version` | Reload đếm sai sang filter cũ (TR-RISK-03) |
| Mức dùng filter (mở → áp dụng) | Funnel | Chưa làm được trên web | — | Event khi Áp dụng (TR-RISK-04) |
| Search → xem job → ứng tuyển | Funnel | Not verified | — | Pilot không bắt event downstream |
| So sánh biến thể A/B trên search | Experiment | Làm được | `The_South_Star`, `ab_version`, `experiments` | — |

## 5. Open questions

- `Q-01` (PO): chấp nhận reload Toàn quốc (mới) → ghi nhận filter cũ không? Ticket ghi kỳ vọng ngược lại.
- `Q-02` (PO/analyst): `Job Search Performed` khi load/reload trang có được tính là một lượt search không?
- `Q-03` (dev): `Search Filter Applied` có cần trên web không, hay chỉ có trên App?
- `Q-04` (PO): `filter_version` là chuỗi `"1.0"` hay số `1`?
- `Q-05` (data): token `420711…` mà QC đang gửi thuộc project `vieclam24h.vn-testing` hay project khác?

## 6. Chưa kiểm chứng

- Mobile Web: report SV_Automation đã chạy 414/360; pilot này chỉ chạy Desktop.
- Data trên Mixpanel: Lexicon, lịch sử, project nhận event. Cần kết nối MCP vùng EU.
- Người dùng đã đăng nhập (`identify`): pilot chạy guest.
- Event downstream (xem job, ứng tuyển) và event server-side.
