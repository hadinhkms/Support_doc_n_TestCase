# Test Data Management

## Nguyên tắc

1. **Mỗi test tự tạo dữ liệu của mình.** Không dùng chung bản ghi giữa các test — chạy song song sẽ đụng nhau.
2. **Tạo dữ liệu qua API/fixture, không qua UI.** UI chỉ dùng để kiểm chứng UI. Seed qua UI làm test chậm và fail vì lý do không liên quan.
3. **Dữ liệu phải duy nhất theo lần chạy.** Dùng `uniqueEmail()` trong `playwright/tests/data/users.ts` thay vì hằng số.
4. **Cleanup phải idempotent.** Xoá thứ đã bị xoá không được làm fail teardown (xem `ApiClient.deleteUser`).
5. **Không hard-code credential.** Tất cả đi qua `requireEnv()` — thiếu biến thì fail nhanh kèm hướng dẫn, không chạy tiếp với giá trị giả.

## Ba loại dữ liệu

| Loại | Ví dụ | Cách quản lý |
|---|---|---|
| Tài khoản cố định | user admin, user viewer | Biến môi trường / secret. Tạo sẵn ở môi trường test, không xoá. |
| Dữ liệu sinh theo test | đơn hàng, bản ghi mới | Seed bằng API trong fixture, cleanup ở teardown. |
| Hằng số nghiệp vụ | mã lỗi, giá trị biên | Khai báo trong `tests/data/`, dùng chung giữa test case và script. |

## Mẫu seed + cleanup

```ts
test('TC-0xx - ...', async ({ api, page }) => {
  const email = uniqueEmail('viewer');
  const userId = await api.createUser({ email, password: 'Str0ng!Pass', role: 'viewer' });

  try {
    // ... phần kiểm chứng
  } finally {
    await api.deleteUser(userId); // idempotent
  }
});
```

Khi dùng nhiều lần, chuyển thành fixture có teardown trong `tests/fixtures/test-fixtures.ts`:

```ts
seededUser: async ({ api }, use) => {
  const email = uniqueEmail();
  const id = await api.createUser({ email, password: 'Str0ng!Pass', role: 'viewer' });
  await use({ id, email });
  await api.deleteUser(id);
},
```

## Cô lập khi chạy song song

`fullyParallel: true` nghĩa là các test trong cùng file cũng chạy song song. Vì vậy:

- Không dùng biến module-level để chia sẻ state giữa test.
- Không sửa dữ liệu dùng chung (cấu hình hệ thống, feature flag toàn cục). Nếu buộc phải, đánh dấu `test.describe.serial` và ghi rõ lý do.
- Nếu app có khái niệm tenant/workspace, mỗi worker nên chạy trên một tenant riêng.

## Reset môi trường

Không tin vào trạng thái sạch của môi trường. Test phải:

- Tự tạo precondition cần thiết.
- Không giả định danh sách rỗng hoặc số lượng bản ghi cố định.
- Assert theo bản ghi mình tạo (lọc theo id/email duy nhất), không theo `nth(0)`.

## Dữ liệu nhạy cảm

- Không commit email/số điện thoại/thẻ thật.
- Dùng domain `example.com` cho email giả.
- Không log giá trị password; `requireEnv` chỉ báo tên biến bị thiếu, không in giá trị.
- Trace và video có thể chứa dữ liệu nhạy cảm — artifact CI đặt `retention-days` ngắn và repo phải ở chế độ private nếu môi trường test có dữ liệu thật.
