# Flow Capture Guide — bắt event Mixpanel khi chạy flow thật

Chỉ áp dụng khi flow đã build. Chạy trên môi trường test/staging; không dùng tài khoản thật
của người dùng cuối.

## 1. Request Mixpanel trông như thế nào

| Loại | Endpoint thường gặp | Ghi chú |
|---|---|---|
| Event | `api-js.mixpanel.com/track`, `api.mixpanel.com/track`, `api-eu.mixpanel.com/track` | Có thể batch nhiều event một request |
| User profile | `.../engage` | `$set`, `$set_once`, `$unset` |
| Group | `.../groups` | B2B group analytics |
| Proxy | Domain riêng do `api_host` cấu hình | Hỏi dev hoặc tìm `api_host` trong source/config |

Payload có thể là form `data=<base64 JSON>` (SDK cũ) hoặc JSON body (SDK mới, có thể kèm
`?verbose=1`). SDK có thể gửi trễ hoặc dùng `sendBeacon` khi rời trang, nên chờ batch flush.

## 2. Bắt bằng browser tích hợp (khám phá thủ công)

1. Mở URL test, đi từng bước flow.
2. Sau mỗi bước: `read_network_requests` với `urlPattern` = `mixpanel` (hoặc domain proxy).
3. Lấy body bằng `requestId`, decode base64 nếu cần.
4. Ghi vào bảng: `bước flow | event | thời điểm (trước/sau API success) | properties`.

## 3. Bắt bằng Playwright (lặp lại được, dùng cho TC)

Dùng helper `playwright/tests/support/mixpanel-capture.ts` (self-test: `deep-engine-tests/mixpanel-capture.spec.ts`):

```ts
import {
  startMixpanelCapture,
  expectMixpanelEvent,
  expectNoMixpanelEvent,
} from '../support/mixpanel-capture';

const capture = startMixpanelCapture(page); // gọi TRƯỚC khi thao tác
await signInPage.submit(user);
await expectMixpanelEvent(capture, 'Sign In Completed', {
  count: 1, // bắt bắn trùng (TR-21/22)
  properties: { method: 'password', user_id: expect.any(String) },
});
await expectNoMixpanelEvent(capture, 'Sign In Failed');
```

- Decode được form `data=<base64|JSON>`, JSON body/batch, GET `?data=`, và `sendBeacon`.
- Proxy `api_host`: truyền `{ hosts: ['track.example.com'] }` hoặc env `MIXPANEL_API_HOST`.
- `properties` là subset, áp cho MỌI event cùng tên; dùng `where` để lọc trước khi so.
- Không assert property động (`time`, `$insert_id`) bằng giá trị cố định; dùng `expect.any(...)`.
- SDK batch mặc định flush khoảng 5s: `timeoutMs` mặc định 10s. Môi trường test nên tắt
  batch (`batch_requests: false`) để test nhanh và ổn định.
- `capture.undecoded` liệt kê request khớp nhưng không đọc được body; khi khác rỗng, kết luận
  "không bắn" là chưa chắc chắn.

### Bài học từ pilot JS-8939

- **Đánh dấu theo bước**: lưu `capture.events.length` trước mỗi thao tác, sau đó lấy
  `events.slice(mark)` để biết chính xác bước nào bắn event nào. Đây là cách duy nhất phát hiện event
  bắn khi load trang (TR-24) hoặc bước không bắn gì (TR-04).
- **Lưu FULL properties** khi review thiết kế; lọc trước theo tên property sẽ bỏ sót `request_id`,
  `action`, object lồng nhau…
- **Ghi URL sau mỗi bước**: nhiều app chỉ "commit" filter khi bấm CTA cuối; reload trước đó sẽ mất lựa chọn.
- **Chạy spec pilot ngoài repo** (scratchpad, repo dự án khác): import `@playwright/test` bằng đường dẫn
  tuyệt đối tới `node_modules` của repo chứa helper, nếu không sẽ lẫn 2 bản Playwright ("No tests found").
- Repo dự án có sẵn env (ví dụ `core/config` của SV_Automation): lấy baseURL từ đó, không tự đoán domain.

## 4. Kiểm tra thêm trên Mixpanel

- `Get-Live-Events`: xác nhận event đã tới project đúng, kể cả event server-side.
- So `distinct_id` trước và sau login để kiểm `identify` (TR-40).
- Kiểm event có lọt vào project production khi chạy trên staging không (TR-61).

## 5. Bằng chứng ghi vào báo cáo

- Bước flow, request URL (che token), payload đã decode và che PII.
- Với `TR-BUG`: tái hiện ít nhất 2 lần ở trạng thái sạch theo mục 14 của workspace rules.
- Nếu không bắt được do adblock, consent banner chặn tracking hoặc proxy chưa biết: ghi
  `Not verified` kèm lý do, không kết luận "không bắn event".
