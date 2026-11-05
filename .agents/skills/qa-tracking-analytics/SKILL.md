---
name: qa-tracking-analytics
description: >-
  Use this skill when the user asks to review a tracking requirement / tracking plan, decide
  which events should be sent to Mixpanel, audit events a flow actually fires, find what makes
  reporting hard, or propose which analytics reports (funnel, retention, flows, breakdown) the
  data can support. Covers reading flows (REQ, Figma) and running real flows to capture events.
---

# QA Tracking & Analytics Review Skill

> **Live Source + Built-in Fallback:** Nếu trên máy tồn tại
> `D:/_QA_Test_Automation/.agents/skills/qa-tracking-analytics/`, ưu tiên đọc bản ở đó;
> nếu không, dùng bản tích hợp tại thư mục hiện tại.

Skill này trả lời 3 câu hỏi cho một flow hoặc một tracking requirement:

1. **Nên bắn event nào lên Mixpanel**: tên, thời điểm, property, user/super property.
2. **Tracking hiện tại hoặc theo req có hợp lý không**, và những gì sẽ làm report khó hoặc sai.
3. **Report nào khai thác được** từ bộ event đó, report nào chưa làm được và cần thêm gì.

Ranh giới với skill khác: coverage REQ/AC/TC/spec dùng [qa-logic-gaps](../qa-logic-gaps/SKILL.md);
thực thi checklist dùng [qa-test-execution](../qa-test-execution/SKILL.md). Finding tracking cần
test được thì nối vào REQ → AC → TC theo `.github/copilot-instructions.md`.

---

## Step 0: Chọn nguồn hiểu behavior (bắt buộc hỏi/kiểm tra trước)

| Trạng thái feature | Nguồn dùng | Không dùng |
|---|---|---|
| **Flow đã build, chạy được** (test/staging) | Chạy flow thật + bắt network Mixpanel + `Get-Live-Events` | Figma (thừa, dễ lệch bản thật) |
| **Mới có REQ, chưa build** | `requirements/`, `test-cases/`, Figma hoặc mô tả flow trong REQ | — |

- Không rõ flow đã build chưa thì **hỏi user**, không tự đoán.
- Thiếu mục tiêu business/KPI thì suy ra từ flow nhưng **ghi rõ là giả định** và đưa vào Open Questions.

## Step 1: Nạp ngữ cảnh

1. Đọc tracking req do user cung cấp (file, Jira, Confluence, paste) và REQ/TC liên quan trong repo.
2. Nếu Mixpanel MCP khả dụng: gọi `Get-Business-Context` **đầu tiên**, rồi `Get-Projects` để chọn
   đúng project; `Get-Events`, `List-Properties`, `Get-Property-Values` để lấy Lexicon hiện có.
3. Liệt kê **câu hỏi report** mà business cần trả lời (từ req, PO, hoặc suy ra có ghi giả định).
4. **Không có Mixpanel MCP** (chưa kết nối, hoặc lỗi `Regional access restriction` vì project ở vùng EU
   cần `mcp-eu.mixpanel.com`): vẫn làm tiếp Step 2–5 bằng network capture và review tài liệu. Ghi
   `Not verified` cho Lexicon, event server-side, data lịch sử, project nhận event; có thể dùng file export
   (Lexicon, CSV report) user gửi thay cho MCP.
5. Repo dự án có cấu hình môi trường (ví dụ `core/config`): lấy URL QC/staging từ đó, không tự đoán domain.

## Step 2: Thu thập behavior thực tế (chỉ khi flow đã build)

Theo [references/flow-capture-guide.md](references/flow-capture-guide.md):

1. Chạy flow trên **môi trường test/staging** bằng browser tích hợp hoặc Playwright.
   Không đăng nhập production; OTP, CAPTCHA, thanh toán thật thì nhờ user thao tác.
2. Ghi lại từng bước người dùng: màn hình, hành động, kết quả (success/error/empty state).
3. Bắt request gửi tới Mixpanel (`/track`, `/engage`, `/groups`, hoặc proxy `api_host` riêng),
   decode payload, map event → bước flow.
4. Event server-side không thấy trên browser: kiểm qua `Get-Live-Events` hoặc tài liệu backend.
   Mobile native: dựa vào REQ, rồi verify bằng live events khi user thao tác trên máy.

## Step 3: Đánh giá tracking

Áp dụng [references/event-design-checklist.md](references/event-design-checklist.md) cho từng event
(mã `TR-xx`). Các nhóm phải check:

- **Business fit**: từng câu hỏi report có đủ event mốc + property breakdown chưa.
- **Naming & granularity**: nhất quán, không nhét giá trị động vào tên event.
- **Trigger timing**: bắn lúc click hay lúc server xác nhận thành công.
- **Property schema**: kiểu dữ liệu, enum, đơn vị, bắt buộc/tuỳ chọn.
- **Identity**: `identify`/`alias` lúc login, signup, logout; `distinct_id` trước và sau login.
- **Join keys**: `order_id`, `session_id`… để ghép funnel và đối soát.
- **Data hygiene**: trùng client và server, lẫn môi trường test, PII trong property.
- **Testability**: mỗi event có điều kiện trigger và expected property đủ để viết TC.

## Step 4: Suy ra report khai thác được

Dùng [references/report-catalog.md](references/report-catalog.md): với từng loại report (Insights,
Funnel, Retention, Flows, Breakdown, Error rate, Feature adoption, Revenue), đánh dấu
**Làm được / Làm được một phần / Chưa làm được** và nêu event/property còn thiếu.

Nếu đã có data trên Mixpanel và user muốn: chạy thử bằng `Get-Query-Schema` → `Run-Query` để chứng
minh report làm được thật. Chỉ tạo/sửa dashboard, cohort, metric, lexicon (`Create-*`, `Update-*`,
`Edit-*`, `Bulk-Edit-*`) khi user yêu cầu rõ.

## Step 5: Báo cáo

Dùng [templates/tracking-review-report.md](templates/tracking-review-report.md). Quy tắc:

- Mỗi finding có bằng chứng: dòng req, request đã bắt (đã che PII), hoặc kết quả query.
- Phân biệt `TR-RISK` (rủi ro từ thiết kế), `TR-BUG` (đã tái hiện trên app/Mixpanel theo mục 14 của
  workspace rules), `TR-REC` (đề xuất) và `Q-xxx` (câu hỏi cho PO/dev).
- Chưa chạy hoặc chưa query được thì ghi `Not verified`, không kết luận tracking đúng.
- Không tự bịa expected behavior khi req im lặng.

## Step 6: Chuyển thành test (khi user yêu cầu)

1. Ghi tracking plan theo `templates/tracking-plan-template.md` vào
   `test-cases/REQ-xxx-<slug>.tracking-plan.md` (không đặt trong `requirements/`).
   Thêm AC tracking vào `requirements/REQ-xxx-*.md` (event, thời điểm, property bắt buộc) và dòng
   `Tracking` trong `## Coverage notes`.
2. Thêm TC `Type: Tracking`, `- **Capabilities**: tracking` vào `test-cases/REQ-xxx-*.md`, cập nhật
   bảng Traceability. Khai `tracking` mà spec không gọi helper → `qa:gaps` báo `missing-tracking-guard`.
3. Script Playwright verify event bằng `expectMixpanelEvent` / `expectNoMixpanelEvent` từ
   `playwright/tests/support/mixpanel-capture.ts` (Hub QA, TypeScript) hoặc
   `core/deep-testing/mixpanel-capture.js` (project vệ tinh JavaScript, ví dụ SV_Automation; cùng API).
   Xem flow-capture guide; giữ giới hạn dòng Rule 15.
4. Chạy `npm run verify` (trong `playwright/`), `npm run qa:matrix`, `npm run qa:check`.

## An toàn & quyền riêng tư

- Không ghi project token, API secret hay service account vào repo; dùng `requireEnv()`.
- Che email, số điện thoại, tên thật khi dán payload vào báo cáo.
- Thay đổi Lexicon/dashboard trên Mixpanel là thay đổi dùng chung: hỏi trước khi làm.
