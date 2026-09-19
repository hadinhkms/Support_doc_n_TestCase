# Selector Convention

## Thứ tự ưu tiên

Chọn locator theo thứ tự sau, chỉ xuống bậc dưới khi bậc trên không khả thi:

| Bậc | Cách dùng | Khi nào |
|---|---|---|
| 1 | `getByRole('button', { name: 'Sign in' })` | Mặc định cho mọi phần tử tương tác. Trùng với cách screen reader nhìn thấy trang. |
| 2 | `getByLabel('Email')` | Input có `<label>`, `aria-label` hoặc `aria-labelledby`. |
| 3 | `getByPlaceholder`, `getByText`, `getByAltText`, `getByTitle` | Khi không có role/label ổn định. `getByText` chỉ dùng cho nội dung tĩnh. |
| 4 | `getByTestId('order-row')` | Khi không có ngữ nghĩa a11y, hoặc text thay đổi theo i18n/nội dung. |
| 5 | `locator('[data-state="open"]')` | Chỉ cho thuộc tính trạng thái do app chủ động expose. |

Thuộc tính test id được cấu hình trong `playwright/playwright.config.ts`:

```ts
use: { testIdAttribute: 'data-testid' }
```

Nếu app dùng tên khác (`data-test`, `data-qa`), sửa đúng một chỗ này.

## Cấm

- CSS theo layout: `.btn-primary`, `#root > div:nth-child(3)`, `.css-1x2y3z` (class sinh bởi CSS-in-JS).
- XPath theo vị trí: `//div[2]/span[1]`.
- Selector dựa vào thứ tự DOM trừ khi thứ tự chính là thứ đang kiểm thử (vd: sắp xếp bảng).
- `page.$`, `page.$$`, `$eval` (ElementHandle API đã lỗi thời).
- `waitForSelector`, `waitForTimeout` — dùng assertion web-first thay thế.

ESLint chặn các mục trên: xem `playwright/eslint.config.mjs`. Chạy `npm run lint`.

## Xử lý khi trùng nhiều phần tử

Thu hẹp bằng scope thay vì thêm index:

```ts
// Không nên
page.locator('.row').nth(2).getByRole('button');

// Nên
page.getByRole('row', { name: 'ORD-1042' }).getByRole('button', { name: 'Cancel' });
```

Chỉ dùng `.first()` / `.nth()` khi vị trí là một phần của yêu cầu nghiệp vụ, và ghi comment giải thích.

## Đặt tên test id

`<khu-vuc>-<doi-tuong>-<vai-tro>`, kebab-case, ổn định và không chứa dữ liệu động:

- `login-email-input`
- `order-table-row`
- `order-row-cancel-button`

Không nhúng id bản ghi vào test id (`order-1042-row`); dùng test id chung rồi lọc theo nội dung.

## Yêu cầu gửi dev

Khi không có locator ổn định, đừng tự chế CSS. Ghi vào mục `Open questions` của requirement và yêu cầu dev thêm `data-testid` hoặc accessible name. Đây là gap của sản phẩm, không phải của test.
