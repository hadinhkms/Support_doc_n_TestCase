# Flaky Test Policy

## Vấn đề

`retries: 2` trên CI giúp build không đỏ vì lý do vặt, nhưng đồng thời **che giấu** test không ổn định. Một test pass ở lần retry vẫn là một test đang hỏng.

## Định nghĩa

Test được coi là **flaky** khi cho kết quả khác nhau trên cùng một commit và cùng môi trường. Playwright đánh dấu mục này là `flaky` trong report khi test fail rồi pass ở retry.

## Quy trình xử lý

1. **Phát hiện.** Mỗi lần merge report, rà mục `flaky` trong HTML report (artifact `playwright-html-report`).
2. **Ghi nhận trong 24h.** Mở issue dùng template `Flaky test`, gắn nhãn `flaky`, đính kèm trace của lần fail.
3. **Phân loại nguyên nhân** — không được bỏ qua bước này:

   | Nguyên nhân | Dấu hiệu | Cách sửa |
   |---|---|---|
   | Lỗi thật, không tất định | Fail theo thời điểm, theo thứ tự chạy | Sửa app, không sửa test |
   | Chờ sai | Dùng `waitForTimeout`, assert ngay sau `click` | Dùng assertion web-first |
   | Dữ liệu đụng nhau | Fail khi chạy song song, pass khi chạy đơn | Áp `docs/test-data-management.md` |
   | Locator không ổn định | Fail sau khi UI đổi nhỏ | Áp `docs/selector-convention.md` |
   | Hạ tầng | Timeout mạng, môi trường sập | Sửa môi trường, không sửa test |

4. **Sửa hoặc quarantine trong 3 ngày làm việc.** Nếu chưa sửa được:

   ```ts
   // QUARANTINE - issue #123 - owner: @qa-an - review lai: 2026-10-05
   test('TC-0xx - ...', { tag: ['@wip'] }, async () => { ... });
   ```

   Tag `@wip` bị loại khỏi `npm run test:regression` và khỏi gate của PR, nhưng **vẫn chạy ở nightly** để không bị quên.

5. **Hạn quarantine tối đa 2 tuần.** Quá hạn: hoặc sửa, hoặc xoá test và ghi lại rủi ro chưa được phủ vào mục `Uncovered risk` của file test case. Không để test bị tắt vô thời hạn.

## Cấm

- `test.skip()` không kèm comment lý do + issue.
- Tăng `timeout` để "chữa" flaky mà chưa phân loại nguyên nhân.
- Tăng `retries` quá 2.
- Xoá test vì hay fail mà không ghi lại rủi ro tương ứng.

## Ngưỡng cảnh báo

- Một test flaky ≥ 2 lần trong 10 lần chạy gần nhất -> bắt buộc mở issue.
- Tỷ lệ flaky toàn bộ suite > 2% -> dừng thêm test mới, ưu tiên ổn định hoá.
