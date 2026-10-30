---
name: qa-test-execution
description: >-
  Thực thi kiểm thử chuyên sâu theo checklist test case và ghi nhận kết quả. Kích hoạt khi
  test chuyên sâu / test lại / regression một task (Jira issue, REQ, feature, bugfix) mà task
  đó có checklist test case: (1) mark trạng thái từng test case (PASS/FAIL/BLOCKED/N/A/NOT RUN)
  kèm bằng chứng, (2) phát hiện test case còn thiếu so với AC, rule nghiệp vụ, edge case và
  bổ sung vào checklist, rồi thực thi luôn test case mới bổ sung.
---

# QA Test Execution — Checklist Status & Gap Fill

Vai trò: **Senior QA Engineer** thực thi checklist test case. Đầu ra bắt buộc gồm hai phần:
mọi test case trong checklist đều có trạng thái, và mọi lỗ hổng phủ đã được bổ sung thành
test case mới. Không có checklist thì skill này không áp dụng — dùng
[qa-system-testing](../qa-system-testing/SKILL.md) Pha 02 để thiết kế test case trước.

## Bước 1 — Xác định checklist của task

Tìm checklist theo thứ tự, dừng ở nguồn đầu tiên có dữ liệu (một task có thể có nhiều nguồn,
khi đó gộp theo mã TC):

| Nguồn | Cách nhận diện |
|---|---|
| `test-cases/REQ-xxx-*.md` | Bảng truy vết + phần chi tiết `TC-zzz` của REQ gắn với task |
| Jira issue | Description/comment có ADF `taskList`/`taskItem`, bảng có cột Status/Kết quả, hoặc dòng `- [ ]`; custom field checklist (Smart Checklist…) |
| File/tài liệu user đưa | Bảng hoặc danh sách test case trong file, sheet, Confluence page |

Ghi lại nguồn, số lượng item và ánh xạ item → `TC-zzz` (item chưa có mã thì gán mã ở Bước 4).

## Bước 2 — Thực thi và mark trạng thái

Chạy từng test case (spec Playwright nếu có, nếu không thì kiểm thủ công qua browser/API).
Chỉ dùng đúng bộ trạng thái sau:

| Trạng thái | Khi nào dùng |
|---|---|
| `PASS` | Kết quả thực tế khớp Expected result, có bằng chứng |
| `FAIL` | Đã qua Rule 14 (loại trừ lỗi script/môi trường, tái hiện ≥ 3 lần) — kèm `BUG-xx` |
| `BLOCKED` | Không thực thi được: thiếu dữ liệu, môi trường lỗi, bị chặn bởi bug khác — ghi rõ lý do |
| `N/A` | Không áp dụng cho build/nền tảng này — ghi lý do |
| `NOT RUN` | Chưa chạy (hết thời gian, ngoài phạm vi đợt này) |

Quy tắc:
- **Không mark PASS khi spec không assert bước đó.** Test case ghi "Không kiểm chứng" / "Ẩn trong
  Page Object" thì phải tự kiểm bước đó hoặc mark theo phần đã kiểm và ghi chú phần còn hở.
- Lỗi chưa tái hiện ổn định → `BLOCKED` kèm ghi chú "nghi lỗi, chưa xác nhận", không mark `FAIL`.
- Mỗi trạng thái phải có: ngày chạy, môi trường (`ENV`, browser/viewport), bằng chứng (đường dẫn
  report/ảnh/log, HTTP status), người/agent chạy.

## Bước 3 — Rà soát test case còn thiếu

Đối chiếu checklist với: AC trong `requirements/REQ-xxx.md` hoặc mô tả Jira, mục "Ứng viên
automation", [edge-case-catalog](../qa-system-testing/references/edge-case-catalog.md),
[cross-portal-checklist](../qa-system-testing/references/cross-portal-checklist.md), và hành
vi thực tế quan sát được khi thực thi. Tối thiểu soát các nhóm:

- Mỗi AC có ít nhất 1 test case happy path và 1 negative.
- Validation & biên (EP/BVA), trạng thái rỗng/lỗi/loading, quyền truy cập.
- Bấm đúp / submit trùng, reload giữa chừng, back/forward, phiên hết hạn.
- Desktop và mobile web (hai test case riêng), dữ liệu bền vững sau reload.
- Hồi quy quanh phần code/bug vừa sửa.

Requirement im lặng về hành vi → không tự bịa Expected result: tạo test case với Expected result
"Cần xác nhận" và mở câu hỏi `Q-xxx`.

## Bước 4 — Bổ sung test case thiếu và chạy luôn

- Mã TC mới = mã lớn nhất hiện có trên toàn `test-cases/` + 1 (mã TC là duy nhất toàn thư mục).
- Đánh dấu nguồn gốc `[Bổ sung YYYY-MM-DD]` trong mô tả để reviewer thấy item nào mới.
- Thực thi test case mới như Bước 2 và mark trạng thái — không để test case bổ sung ở `NOT RUN`
  nếu thực thi được.

## Bước 5 — Ghi kết quả về nguồn

### `test-cases/REQ-xxx-*.md`
- Test case mới: thêm dòng vào **Bảng truy vết** đủ cột (TC, AC, Mô tả, Ưu tiên, Automation =
  `Có`/`manual`, Spec) và mục chi tiết `### TC-zzz` với bảng `| Bước | Thao tác | Kết quả mong đợi |`.
- Kết quả: thêm/cập nhật mục `## Kết quả thực thi` ở cuối file, đợt mới nhất nằm trên, giữ lịch sử:

  ```markdown
  ## Kết quả thực thi

  ### 2026-10-30 — ENV=staging, chromium 1920x1080, bởi Claude
  | Test case | Trạng thái | Bằng chứng | Ghi chú |
  |---|---|---|---|
  | TC-009 | PASS | playwright-report/index.html#... | |
  | TC-045 | FAIL | evidence/BUG-03.png | BUG-03 — [Bổ sung 2026-10-30] |
  ```
  Không ghi chữ `Có`/`manual` trong bảng kết quả (công cụ truy vết đọc hai giá trị này).
- Chạy `node scripts/qa-trace.js` sau khi sửa; không được phát sinh finding mới.

### Jira issue
Ghi lên Jira là thao tác ra bên ngoài: nếu yêu cầu của user chưa nói rõ "cập nhật Jira", hiển thị
bản xem trước (trạng thái từng item + test case bổ sung) và chờ user đồng ý trước khi ghi.
- ADF `taskItem`: chỉ chuyển `state` sang `DONE` khi `PASS`; trạng thái khác giữ `TODO` và chèn
  nhãn `[FAIL BUG-xx]`, `[BLOCKED: lý do]`, `[N/A: lý do]` vào đầu item.
- Bảng có cột Status/Kết quả: điền trạng thái vào cột đó.
- Test case bổ sung: thêm item/dòng mới cuối checklist với tiền tố `[Bổ sung]`.
- Sửa description phải giữ nguyên toàn bộ nội dung ADF khác (đọc → sửa đúng node → ghi lại).
  Checklist nằm trong custom field không sửa được qua API → đăng comment tổng hợp kết quả thay vì sửa.
- Luôn đăng 1 comment tóm tắt đợt chạy: số PASS/FAIL/BLOCKED/N/A/NOT RUN, danh sách BUG, môi trường.

## Bước 6 — Báo cáo

Trả lời ngắn gọn gồm: bảng tổng hợp trạng thái (đếm theo từng loại), danh sách test case bổ sung
(mã, AC, lý do thiếu), danh sách `BUG-xx`/`Q-xxx`, những gì chưa chạy được và vì sao, file/issue
đã cập nhật. Không báo "hoàn tất" khi còn item `NOT RUN` mà không nêu rõ.
