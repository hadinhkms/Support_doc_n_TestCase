---
name: qa-exploratory
description: >-
  Kiểm thử thăm dò (exploratory testing) có cấu trúc để săn lỗi tiềm ẩn mà requirement và
  checklist không nói tới. Kích hoạt khi người dùng muốn "test thăm dò", "explore", "bug bash",
  "săn bug", "tìm lỗi ẩn", "phá thử tính năng", test một tính năng chưa có hoặc có ít test case,
  hoặc khi requirement im lặng và cần phán đoán hành vi đúng/sai: lập charter, chạy session
  timebox theo SFDPOT, dùng oracle FEW HICCUPPS để quyết định "đây có phải bug không", ghi
  session report và chuyển phát hiện thành BUG / Q-xxx / TC mới / bài học DH-PA.
---

# QA Exploratory Testing — Charter, Heuristics & Oracles

Use the skill copy selected in the current workspace. When working in another
repository, follow that repository's local QA instructions and tools; do not assume
the Hub is installed at a fixed machine path.

Vai trò: **Senior Exploratory Tester**. Các skill khác kiểm *điều đã được nói* (REQ → AC → TC).
Skill này kiểm *điều chưa ai nói*: chủ động thay đổi sản phẩm theo nhiều chiều, quan sát, và
dùng oracle để phán đoán khi không có Expected result. Kết quả không phải là "PASS" mà là
**thông tin mới về rủi ro**, được chuyển thành artifact truy vết được.

## Định tuyến

| Tình huống | Skill |
|---|---|
| Đã có checklist test case, cần mark trạng thái | [qa-test-execution](../qa-test-execution/SKILL.md) — có thể chạy skill này sau đó cho phần ngoài checklist |
| Review tài liệu PRD/SRS trước khi có bản build | [qa-system-testing](../qa-system-testing/SKILL.md) Pha 01 |
| Rà độ phủ REQ/AC/TC/spec và assertion yếu | [qa-logic-gaps](../qa-logic-gaps/SKILL.md) |
| Đào sâu API, OWASP API | [qa-api-testing](../qa-api-testing/SKILL.md) |
| Review giao diện theo rubric | [qa-ui-review](../qa-ui-review/SKILL.md) |

Skill này cần **bản build chạy được** (môi trường test, local, staging). Không có bản build thì
chỉ làm được bước 1 (charter) và chuyển phần còn lại cho `qa-system-testing` Pha 01.

## Bước 0 — Phạm vi và an toàn

- Đọc `AGENTS.md` và `.github/copilot-instructions.md` của repo đích trước khi sửa
  `requirements/`, `test-cases/` hoặc `playwright/tests/`.
- Chỉ thăm dò trên môi trường test/staging/local người dùng chỉ định. Không thao tác phá hoại
  trên production, không tấn công hạ tầng ngoài phạm vi, không dùng credential thật ngoài
  `requireEnv()`.
- Ghi lại build/commit, môi trường, tài khoản/vai trò, browser/viewport trước khi bắt đầu.

## Bước 1 — Lập charter và chọn vùng rủi ro

Mỗi session có **một charter** theo mẫu:

> **Khám phá** `<vùng/tính năng>` **với** `<tài nguyên: vai trò, dữ liệu, công cụ, heuristic>`
> **để phát hiện** `<loại rủi ro>`.

Chọn charter theo rủi ro, không theo thứ tự màn hình. Chấm nhanh mỗi vùng ứng viên
(1–3 điểm mỗi cột), làm vùng điểm cao trước:

| Yếu tố | Câu hỏi |
|---|---|
| Tác động | Lỗi ở đây gây mất tiền, lộ dữ liệu, sai quyền, mất dữ liệu người dùng? |
| Thay đổi | Vùng này vừa đổi code (`git diff`), vừa refactor, vừa đổi dependency/cấu hình? |
| Độ phức tạp | Nhiều trạng thái, nhiều vai trò, nhiều hệ thống, bất đồng bộ, thời gian? |
| Lịch sử | Từng có bug, sự cố production, test flaky, hoặc ít test (`npm run qa:gaps`)? |

Với REQ có sẵn, chạy `npm run qa:impact -- <REQ-id>` và `npm run qa:gaps` để biết vùng nào ít
test. Session mặc định **45–90 phút** (hoặc tương đương số bước nếu là agent); một charter
quá rộng thì tách thành nhiều session.

## Bước 2 — Thực thi session

Đọc [references/heuristics-and-tours.md](references/heuristics-and-tours.md) và chọn 2–4
heuristic phù hợp charter; không cố chạy hết.

1. **Dựng mô hình**: liệt kê nhanh đối tượng, trạng thái, vai trò, luồng dữ liệu vào/ra của vùng.
   Mô hình sai chỗ nào thì đó thường là chỗ có bug.
2. **Thay đổi theo SFDPOT**: mỗi lần đổi một chiều (cấu trúc, chức năng, dữ liệu, giao diện
   tích hợp, nền tảng, thao tác, thời gian) và quan sát.
3. **Quan sát nhiều kênh, không chỉ màn hình**: network (status, payload, số lần gọi), console
   và `pageerror`, dữ liệu đọc lại qua API hoặc portal khác, email/notification, audit log,
   log server nếu có quyền đọc. Lỗi tiềm ẩn thường chỉ lộ ở kênh phụ.
4. **Phán đoán bằng oracle**: với mỗi điều bất thường, áp FEW HICCUPPS (xem reference) và ghi
   oracle nào bị vi phạm. Không có oracle nào bị vi phạm → không phải bug, có thể là `Q-xxx`.
5. **Ghi chú liên tục** theo mẫu session report: đã thử gì, thấy gì, nghi gì, còn chưa thử gì.
   Thử ý tưởng mới nảy ra ngay trong session nếu vẫn thuộc charter; ngoài charter thì ghi vào
   "Charter đề xuất tiếp theo".

## Bước 3 — Phân loại phát hiện

| Loại | Điều kiện | Hành động |
|---|---|---|
| `BUG-xx` | Vi phạm ít nhất một oracle mạnh (Claims, Standards, Purpose, History) **và** qua cổng mục 14 của workspace: loại trừ lỗi script/môi trường, tái hiện ≥ 3 lần, có bằng chứng kép | Báo bug theo mẫu workspace, có mục **`Bối cảnh nghiệp vụ`**, ảnh khoanh đỏ (`captureAnnotatedBugEvidence`) |
| `SUSPECT` | Bất thường nhưng chưa tái hiện ổn định hoặc chỉ vi phạm oracle yếu (Comparable, Image) | Ghi vào report, không báo bug; đề xuất probe (vd `Promise.all`, `expectMultiTabConcurrency`) |
| `Q-xxx` | Requirement im lặng, oracle mâu thuẫn nhau | Mở câu hỏi cho PO; không tự bịa Expected result |
| `TC-xxx` mới | Kịch bản đáng giữ để hồi quy | Thêm vào `test-cases/` theo quy tắc mã TC (lớn nhất + 1), cân nhắc automation |
| Bài học `DH`/`PA` | Mẫu lỗi lặp lại được ở dự án khác | Đưa qua Selective Learning của [qa-logic-gaps](../qa-logic-gaps/SKILL.md) Bước 6 |

## Bước 4 — Session report

Dùng [templates/session-report.md](templates/session-report.md). Bắt buộc có: charter, thời
lượng, môi trường/build, tỉ lệ thời gian (thiết lập / thăm dò / điều tra bug), danh sách phát
hiện đã phân loại, **vùng đã phủ và chưa phủ**, charter đề xuất tiếp theo. Không viết "không
còn bug" — chỉ viết những gì đã thử và chưa thử.

## Bước 5 — Chuyển hóa (khi người dùng yêu cầu sửa artifact)

1. Cập nhật `requirements/` (rule/AC còn thiếu, `Open questions`) và `test-cases/` (TC mới, bảng
   `Traceability`).
2. Tự động hóa TC đáng giữ trong `playwright/tests/` theo quy tắc spec của workspace (tag
   `@REQ-xxx`, title `TC-xxx - AC-yyy ...`, giữ dưới vùng vàng của Rule 15).
3. Chạy `npm run verify` trong `playwright/`, rồi `npm run qa:matrix` và `npm run qa:check` ở
   root. Repo không có các lệnh này thì ghi rõ giới hạn xác minh.

## Nguyên tắc

- **Thăm dò không phải test ngẫu nhiên**: luôn có charter, heuristic và ghi chú.
- **Một phát hiện = một oracle**: ghi rõ vì sao cho là sai; "thấy lạ" chưa phải lý do.
- **Không suy diễn nghiệp vụ**: requirement im lặng thì hỏi, không tự chọn hành vi "hợp lý".
- **Agent khác người**: agent dễ đi theo happy path và tin thông báo trên UI. Luôn đọc lại dữ
  liệu qua kênh độc lập (API, reload, vai trò khác) trước khi coi một thao tác là thành công.
