# Exploratory Session Report — <SES-yyyymmdd-nn>

## 1. Thông tin session

| Mục | Giá trị |
|---|---|
| Charter | Khám phá `<vùng>` với `<tài nguyên>` để phát hiện `<rủi ro>` |
| REQ liên quan | `REQ-xxx` (hoặc "Chưa có") |
| Người/agent thực hiện | |
| Ngày, thời lượng | `<yyyy-mm-dd>`, `<phút>` |
| Môi trường / build | `<ENV>`, commit `<sha>` |
| Vai trò / tài khoản test | `<role>` (không ghi credential) |
| Browser / viewport | |
| Heuristic & tour đã dùng | vd `SFDPOT: D, O, T`, `Saboteur tour` |
| Tỉ lệ thời gian | Thiết lập `x%` / Thăm dò `y%` / Điều tra bug `z%` |

## 2. Phát hiện

| Mã | Loại | Oracle bị vi phạm | Mô tả ngắn | Bằng chứng | Tái hiện |
|---|---|---|---|---|---|
| BUG-xx | BUG | Claims (`AC-002`) | | ảnh khoanh đỏ, HTTP status, log | 3/3 |
| SUS-01 | SUSPECT | Product | | | 1/3 — cần probe |
| Q-xxx | Câu hỏi | Users vs Claims | | | — |

## 3. Độ phủ

- **Đã thử**: <các chiều SFDPOT, dữ liệu, vai trò, luồng đã đi>
- **Chưa thử / còn hở**: <ghi rõ, không viết "không còn bug">

## 4. Đề xuất

- **TC mới cần thêm**: `TC-xxx` — <mô tả>, nên automation: Có/Không
- **Bài học cho Selective Learning**: <mẫu lỗi khái quát được, nếu có>
- **Charter đề xuất tiếp theo**: <1–3 charter>
