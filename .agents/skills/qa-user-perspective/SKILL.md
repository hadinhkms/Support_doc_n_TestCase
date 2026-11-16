---
name: qa-user-perspective
description: >-
  Đánh giá design và flow từ góc nhìn người dùng cuối: đặt mình vào vai một persona có mục tiêu
  cụ thể, đi qua design (Figma/prototype), bản build hoặc mô tả flow trong REQ, rồi đưa ra
  QUAN ĐIỂM ĐÁNH GIÁ: chỗ nào gây khựng, phải đoán, thừa bước, câu chữ khó hiểu, thiếu trạng
  thái, khó tự sửa sai — và đề xuất cách làm phù hợp nhất với người dùng cuối. Khi requirement
  chưa nói chi tiết, đề xuất được viết thành "Expected đề xuất" để PO/BA chọn đưa vào. Kích
  hoạt khi người dùng muốn "đặt mình vào người dùng", "góc nhìn người dùng", "review design",
  "review flow", "đánh giá trải nghiệm", "user journey", "persona", "usability", "dễ dùng
  không", "người dùng cuối có hiểu không". Skill chỉ đánh giá và đề xuất; KHÔNG viết test case
  hay Playwright spec.
---

# QA User Perspective — Đánh giá Design & Flow từ góc nhìn người dùng cuối

Use the skill copy selected in the current workspace. When working in another
repository, follow that repository's local QA instructions and tools; do not assume
the Hub is installed at a fixed machine path.

Vai trò: **Người đại diện cho người dùng cuối trong buổi review design/flow**. Các skill khác
hỏi "sản phẩm có làm đúng spec không". Skill này hỏi **"với người dùng thật, design và flow này
đã là cách tốt nhất chưa — và nếu chưa thì nên thế nào"**.

**Đầu ra là quan điểm đánh giá và đề xuất**, không phải test case. Skill không sửa
`test-cases/` hay `playwright/tests/`. Khi requirement im lặng, đề xuất được viết thành
**Expected đề xuất** để PO/BA quyết định có đưa vào requirement hay không; test case lấy
expected từ requirement đã duyệt, qua các skill viết test case.

## Định tuyến

| Tình huống | Skill |
|---|---|
| Viết/bổ sung test case, mark checklist | [qa-test-execution](../qa-test-execution/SKILL.md), [qa-system-testing](../qa-system-testing/SKILL.md) Pha 02 |
| Review PRD/SRS tìm lỗ hổng logic, phân quyền | [qa-system-testing](../qa-system-testing/SKILL.md) Pha 01 |
| Săn bug tiềm ẩn, phá thử tính năng | [qa-exploratory](../qa-exploratory/SKILL.md) |
| Lỗi layout, responsive, a11y kỹ thuật trong mã frontend | [qa-ui-review](../qa-ui-review/SKILL.md) |

## Bước 0 — Nguồn đánh giá và phạm vi

- Đọc `AGENTS.md` và `.github/copilot-instructions.md` của repo đích.
- Đánh giá trên nguồn người dùng đưa; có nhiều nguồn thì ưu tiên: (1) bản build chạy được
  (local/test/staging) → đi flow thật; (2) Figma/prototype → đi qua frame và prototype link,
  xem đủ các variant/state; (3) chỉ có REQ/user story → đi flow trên giấy. Ghi rõ nguồn trong
  report; đánh giá trên giấy không kết luận được về tốc độ, animation hay thông báo lỗi thật.
- Requirement/AC liên quan (nếu có) dùng ở **Bước 4** để phân loại: phần đã quy định → góp ý
  đổi spec, phần im lặng → Expected đề xuất. Khi đi flow ở Bước 2 thì **gác kiến thức spec
  sang một bên**, chỉ dùng điều persona biết; nếu đã đọc spec trước, ghi rõ trong report.
- Không thao tác trên production, không dùng credential thật ngoài `requireEnv()`.

## Bước 1 — Chọn persona và mục tiêu

Đọc [references/personas-and-heuristics.md](references/personas-and-heuristics.md) mục 1.
Chọn **1–3 persona** khác nhau rõ rệt (ví dụ người dùng mới + người quen tay đang vội + mobile).
Ưu tiên persona của dự án; không có thì dùng persona chuẩn và ghi là **persona giả định**.

Mỗi persona có một mục tiêu bằng lời người dùng, không bằng tên màn hình:

> Là `<persona>`, trong `<bối cảnh>`, tôi muốn `<việc cần xong>` để `<lý do>`.

## Bước 2 — Đi flow trong vai persona

1. **Bắt đầu từ điểm vào thật** (email, thông báo, trang chủ, link chia sẻ), không nhảy thẳng
   vào màn hình đích.
2. **Chỉ dùng điều persona biết**: không dựa vào kiến thức nội bộ, tên field kỹ thuật, ghi chú
   của designer/dev.
3. **Ở mỗi bước, hỏi 4 câu cognitive walkthrough** (reference mục 2), ghi câu trả lời "Không".
4. **Ghi tín hiệu ma sát quan sát được** (reference mục 3): số bước, chỗ lạc, chỗ chờ không
   phản hồi, chữ phải đoán nghĩa, thông tin phải nhập lại, lỗi không chỉ cách sửa.
5. **Đi cả nhánh không suôn sẻ** như người thật gặp: nhập sai, đổi ý giữa chừng, quay lại,
   dữ liệu rỗng, mạng chậm, không có quyền.

Gặp hành vi **sai spec, lỗi hệ thống hay mất dữ liệu** trên bản build: không phải quan điểm
đánh giá — ghi vào mục "Nghi bug, ngoài phạm vi" của report và chuyển cho
[qa-exploratory](../qa-exploratory/SKILL.md) hoặc quy trình báo bug (cổng mục 14 của workspace).
Skill này không gắn nhãn `BUG`.

## Bước 3 — Đánh giá design và flow

Soát theo reference: **mục 4** (10 heuristic Nielsen) và **mục 6** (checklist design: phân cấp
thị giác, câu chữ, trạng thái, nhất quán, mobile, hành động nguy hiểm). Chỉ ghi điểm có bằng
chứng cụ thể (frame/màn, bước, nguyên văn chữ, ảnh).

Agent không có cảm xúc: nhận định "khó hiểu", "rối" phải gắn tín hiệu quan sát được, ví dụ
"nút chính ghi `Tiếp tục` nhưng thực tế gửi đơn", "6 bước để đổi 1 trường". Ghi cả **điểm
làm tốt** để team giữ lại khi sửa.

## Bước 4 — Đưa ra quan điểm và đề xuất

Mỗi phát hiện gồm: **vấn đề → ai bị ảnh hưởng → mức độ (0–4, reference mục 5) → đề xuất phù
hợp nhất với người dùng cuối → lý do**. Phân loại:

| Loại | Khi nào | Cách viết |
|---|---|---|
| `UXF-xx` góp ý | Design/flow đúng spec nhưng chưa tối ưu cho người dùng | Đề xuất cụ thể + lý do; nhiều phương án thì xếp hạng và nói rõ chọn phương án nào |
| `EXP-xx` Expected đề xuất | Requirement chưa nói chi tiết (thông báo lỗi, trạng thái rỗng, loading, giới hạn, hành vi khi huỷ…) | Viết thành câu expected kiểm chứng được, ví dụ: "Khi mất mạng lúc gửi, giữ nguyên dữ liệu đã nhập và hiện `Không gửi được, vui lòng thử lại` kèm nút Thử lại" |
| `SPEC-xx` góp ý đổi spec | Spec/AC đã quy định nhưng chính điều đó gây ma sát | Nêu AC hiện tại, đề xuất thay thế, tác động nếu giữ nguyên |
| `Q-xxx` câu hỏi | Cần thông tin nghiệp vụ mới quyết được (luật, chính sách, dữ liệu) | Câu hỏi cho PO/BA/Designer kèm phương án gợi ý |

### Cân bằng: thuận tiện cho người dùng và không ảnh hưởng hiệu năng hệ thống

Mỗi đề xuất phải qua **hai câu hỏi**, ghi kết quả vào cột "Ảnh hưởng hệ thống" của report:

1. **Có thuận tiện hơn cho người dùng không?** Gồm cả **hiệu năng cảm nhận**: người dùng thấy
   phản hồi ngay chưa (skeleton, loading, cập nhật lạc quan, hiện kết quả từng phần).
2. **Có làm tăng tải hệ thống không?** Số request, khối lượng dữ liệu tải về, truy vấn nặng,
   polling, kết nối giữ mở, việc tính toán trên thiết bị yếu.

Đọc [references/personas-and-heuristics.md](references/personas-and-heuristics.md) mục 8.
Đề xuất làm tăng tải thì **không bỏ, mà kèm cách làm nhẹ** (debounce, phân trang/tải dần,
cache, xử lý nền, giới hạn tần suất) và ghi mức ảnh hưởng: `Giảm tải` / `Không` / `Thấp` /
`Cần dev đánh giá`. Đây là **ước lượng của QA**, không phải số đo: không khẳng định chắc chắn
về hiệu năng; đề xuất nào không chắc thì chọn `Cần dev đánh giá`. Đề xuất bớt bước, bớt request
ghi `Giảm tải`.

Nguyên tắc cho đề xuất:
- **Ưu tiên quy ước người dùng đã quen** (nền tảng, sản phẩm phổ biến cùng loại, các màn khác
  trong chính sản phẩm) hơn cách làm mới lạ.
- **Câu chữ đề xuất viết nguyên văn**, bằng ngôn ngữ người dùng, nói cái gì sai và sửa thế nào.
- **Comment và report viết thẳng như người trong team**: nêu sự việc, một đề xuất duy nhất kèm
  lý do; không văn máy, không nước đôi, không cảm tính ("tưởng", "cảm giác"), không sến. Theo
  mục "Giọng văn khi viết comment, bug, report" trong `.github/copilot-instructions.md` và reference mục 9.
- `EXP` và `SPEC` là **đề xuất chờ duyệt** (PO/BA; góp ý thuần design thì thêm Designer).
  Skill không tự ghi vào requirement. Khi người dùng yêu cầu đưa vào, chỉ ghi vào mục
  `Open questions` của requirement dưới dạng assumption cần xác nhận, kèm nguồn là report này
  (đúng mục 2 của `.github/copilot-instructions.md`); thành AC/expected chính thức khi đã duyệt.

## Bước 5 — Report

Dùng [templates/user-perspective-review.md](templates/user-perspective-review.md). Bắt buộc có: nguồn
đánh giá, persona và mục tiêu, bản đồ flow có điểm ma sát, kết quả từng persona (hoàn thành /
có khó khăn / bỏ cuộc), điểm làm tốt, phát hiện kèm đề xuất, bảng **Expected đề xuất**, mục
**nghi bug ngoài phạm vi** (nếu có) và phần **chưa đánh giá được**. Mở đầu report bằng **tóm tắt 3–5 ý quan trọng nhất** cho PO/Designer.

## Nguyên tắc

- **Mục tiêu trước màn hình**: bắt đầu từ việc người dùng muốn xong, không từ tính năng.
- **Bằng chứng, không cảm tính**: mỗi nhận định gắn bước/frame và tín hiệu quan sát.
- **Đề xuất phải dùng được**: cụ thể tới mức designer sửa được hoặc BA chép được thành expected.
- **Không thay PO/BA/Designer quyết định**: đưa quan điểm và phương án; quyết định thuộc về họ.
- **Walkthrough không thay user research**: phát hiện quan trọng nên được kiểm lại với người
  dùng thật hoặc dữ liệu analytics ([qa-tracking-analytics](../qa-tracking-analytics/SKILL.md)).
