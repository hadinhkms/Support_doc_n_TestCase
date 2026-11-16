# User Perspective Review — <UPR-yyyymmdd-nn>

## 0. Tóm tắt cho PO / Designer

1. <ý quan trọng nhất — vấn đề + đề xuất>
2.
3.

## 1. Thông tin đánh giá

| Mục | Giá trị |
|---|---|
| Design / flow được đánh giá | |
| REQ liên quan | `REQ-xxx` (hoặc "Chưa có") |
| Nguồn đánh giá | Bản build chạy thật / Figma (link, version) / Chỉ REQ (giấy) |
| Môi trường / build | `<ENV>`, commit `<sha>` (bỏ trống nếu không có build) |
| Thiết bị / viewport / mạng | vd `iPhone 13 viewport, Slow 3G` |
| Người/agent thực hiện, ngày | |

## 2. Persona và mục tiêu

| Persona | Nguồn persona | Mục tiêu (JTBD) | Kết quả |
|---|---|---|---|
| `P-NEW` | Giả định / tài liệu dự án | Là ..., tôi muốn ... để ... | Hoàn thành / Có khó khăn / Bỏ cuộc |

## 3. Bản đồ flow

| Bước | Màn / frame | Persona làm gì | Walkthrough Q1–Q4 "Không" | Tín hiệu ma sát |
|---|---|---|---|---|
| 1 | | Mở email xác nhận, bấm link | — | |
| 2 | | | Q3: nút ghi `Proceed` không rõ dẫn đi đâu | phải đoán nghĩa |

Tổng: `<n>` bước, `<n>` chỗ lạc/quay lại, state còn thiếu trong design: `<loading, rỗng, lỗi...>`.

## 4. Điểm làm tốt (nên giữ)

-

## 5. Quan điểm đánh giá và đề xuất

| Mã | Loại | Mức (0–4) | Màn / bước | Persona | Vấn đề + bằng chứng | Đề xuất phù hợp nhất với người dùng | Lý do | Ảnh hưởng hệ thống |
|---|---|---|---|---|---|---|---|---|
| UXF-01 | Góp ý | 3 | | `P-NEW` | Nguyên văn chữ, ảnh | | H9 — lỗi không chỉ cách sửa | Không |
| SPEC-01 | Góp ý đổi spec | | | | `AC-002` hiện quy định ... | Thay bằng ... | | Thấp — debounce 300 ms |
| Q-xxx | Câu hỏi | — | | | | Phương án gợi ý: A (khuyên dùng) / B | | Cần dev đánh giá |

## 6. Expected đề xuất (requirement chưa nói chi tiết — chờ PO/BA duyệt)

Ảnh hưởng hệ thống: `Giảm tải` / `Không` / `Thấp` / `Cần dev đánh giá` (ước lượng của QA).

| Mã | Tình huống | Expected đề xuất | Lý do cho người dùng | Ảnh hưởng hệ thống |
|---|---|---|---|---|
| EXP-01 | Danh sách chưa có dữ liệu | Khi ... thì ... và người dùng thấy `<nguyên văn>` để ... | | Không |

## 7. Nghi bug, ngoài phạm vi

Hành vi sai spec, lỗi hệ thống, mất dữ liệu gặp khi đi flow — chuyển sang qa-exploratory /
quy trình báo bug, không gắn nhãn `BUG` ở đây.

| Bước / màn | Hiện tượng | Bằng chứng |
|---|---|---|

## 8. Phạm vi và giới hạn

- **Đã đọc spec trước khi đi flow?** Có / Không
- **Đã đánh giá**: <persona, thiết bị, flow, frame>
- **Chưa đánh giá được**: <vd chưa có build, prototype thiếu nhánh lỗi, chưa thử screen reader thật>
- Đây là đánh giá đại diện, không thay cho research với người dùng thật.
