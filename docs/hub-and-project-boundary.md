# Ranh giới Hub và Project

## Mô hình

```
        Hub (_Automation-Project)
        build dashboard + prompt + tooling
                    |
                    | sync một chiều
                    v
   +----------------+----------------+
   |                |                |
Vieclam24h      CarThings        project kế tiếp
mỗi nơi giữ business riêng của mình
```

Hub **không** giữ business. Business là requirement, test case, page object, test data
và spec của từng sản phẩm cụ thể. Hub chỉ giữ thứ dùng chung được cho mọi sản phẩm.

## Ba nhóm

Khai báo trong [`sync-manifest.json`](../sync-manifest.json), kiểm tra bằng `npm run qa:boundary`.

| Nhóm | Hub làm gì | Project được sửa không | Ví dụ |
|---|---|---|---|
| `ship` | Ghi đè mỗi lần sync | **Không.** Muốn đổi thì đổi ở Hub | `templates/`, `docs/`, `tools/qa/`, `eslint.config.mjs` |
| `seed` | Chỉ copy khi project chưa có | **Có.** Sửa thoải mái | `playwright.config.ts`, `tests/fixtures/`, `tests/api/` |
| `own` | Không bao giờ đụng vào | **Có.** Của project | `requirements/`, `test-cases/`, `tests/pages/`, `tests/data/` |

### Vì sao cần nhóm `seed`

Ban đầu tôi định chỉ có hai nhóm. Nhưng `tests/fixtures/test-fixtures.ts` import từ
`tests/pages/`. Nếu ship fixtures (Hub ghi đè) mà không ship pages (business), mọi lần sync
sẽ ghi đè fixtures bằng bản trỏ tới page object không tồn tại ở project đó.

Nên fixtures là **bản khởi tạo**: Hub cấp một lần, project sửa để khai báo page object của
chính mình, Hub không đụng lại nữa. Quy tắc chung: **file nào import từ nhóm `own` thì
không thể ở nhóm `ship`.**

## Hai lớp bảo vệ

### 1. Ở Hub — chặn lúc sync

`scripts/lib/sync-manifest.js` (nguồn dùng chung của `sync-satellites.js` và
`pre-sync-drift.js`) có `FORBIDDEN_SYNC_MODULES` và ném lỗi nếu ai đó vô tình
thêm thư mục business vào danh sách sync:

```js
const FORBIDDEN_SYNC_MODULES = ['data', 'tests', 'pages', 'requirements', 'test-cases'];
```

Guard bắt cả trường hợp lồng nhau (`{ src: 'docs/requirements' }`), không chỉ so sánh bằng.

### 2. Ở project — chặn lúc CI

`npm run qa:boundary --strict` đối chiếu manifest với thực tế và fail khi:

| Vấn đề | Nghĩa |
|---|---|
| `path-khong-ton-tai` | Manifest đã cũ so với repo |
| `path-o-nhieu-nhom` | Một path khai ở hai nhóm, mâu thuẫn |
| `own-nam-trong-ship` | Business nằm trong thư mục bị ghi đè — sẽ mất dữ liệu |
| `chua-phan-loai` | Có người thêm thư mục mà quên khai |
| `lech-voi-forbidden-cua-hub` | Hai bên đang nói khác nhau |

Mục `own` khai `hubModule` để nói nó tương ứng với module nào bên Hub. Không suy ra từ
đường dẫn: `playwright/tests/pages` có segment đầu là `playwright`, nhưng thứ Hub cấm là
`pages`.

## Thêm thư mục mới

1. Quyết định nhóm: nó có business không? Project có cần sửa không?
2. Khai vào `sync-manifest.json` kèm `reason`.
3. Nếu là `own`, thêm `hubModule` và đảm bảo Hub đã cấm module đó.
4. Chạy `npm run qa:boundary`.

Quên bước 2 thì CI báo `chua-phan-loai`. Đó là chủ ý — im lặng cho qua sẽ dẫn tới
business bị ghi đè sau vài tháng.

## Điều chưa làm được

- **Chưa có cơ chế `seed` thật.** Hub hiện chỉ có `MODULES_TO_SYNC` (luôn ghi đè). Muốn
  nhóm `seed` hoạt động đúng thì `sync-satellites.js` cần thêm chế độ "copy nếu thiếu".
  Hiện tại nhóm `seed` mới chỉ là khai báo ý định, chưa được máy thi hành.
- **Đường về từ project lên Hub vẫn cụt.** Project học được gì không gửi ngược lên được;
  sync là một chiều.
