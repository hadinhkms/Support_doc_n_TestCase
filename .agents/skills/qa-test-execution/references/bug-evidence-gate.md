# Bug Evidence Gate — kiểm chứng trước khi báo bug

Bổ sung cho Rule 14. Tái hiện đủ 3/3 lần **chưa đủ** nếu cả 3 lần đều đo sai cùng một cách.
Trước khi đưa bất kỳ phát hiện nào vào bug draft hoặc báo cáo, phải qua đủ 4 cổng dưới đây.

## Cổng 1 — Đo đúng cái người dùng nhìn thấy (UI)
- Kết luận về giao diện (lặp chữ, thiếu chữ, sai thứ tự, ký tự thừa, layout) **bắt buộc có ảnh chụp
  vùng lỗi** (khoanh đỏ, có URL + thời điểm chụp). Không kết luận UI chỉ từ `innerText`, `textContent`,
  HTML nguồn hay curl.
- `innerText` / `textContent` / regex trên HTML lấy cả phần tử **ẩn với mắt**: `sr-only`,
  `visually-hidden`, kích thước 1×1px, `clip`, `opacity:0`, ngoài viewport, microdata/JSON-LD.
- Khi đọc text bằng script, chỉ lấy phần tử thấy được:
  ```js
  const visible = el => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false
      && r.width > 2 && r.height > 2 && cs.clip !== 'rect(0px, 0px, 0px, 0px)'
      && !/\b(sr-only|visually-hidden)\b/.test(el.className);
  };
  ```
- Ảnh và số liệu từ script **mâu thuẫn nhau** → ảnh thắng; dừng lại tìm nguyên nhân trước khi báo.
- Phần tử ẩn nhưng tồn tại (sr-only, schema) thì ghi riêng thành ghi chú a11y/SEO nếu thật sự có vấn đề,
  không gộp thành bug hiển thị.

## Cổng 2 — Đối chứng phải dùng cách đo độc lập
- So sánh với production / bản cũ / môi trường khác ("production cũng bị") phải dùng **ảnh chụp**,
  không dùng lại đúng script đã cho ra kết quả nghi ngờ. Cùng một phép đo sai sẽ cho cùng kết quả sai
  ở cả hai bên.
- Ghi rõ trong báo cáo: đối chứng bằng cách nào, URL nào, lúc nào.

## Cổng 3 — Expected result phải có nguồn
- Expected lấy từ: AC trên Jira/REQ, câu trả lời PO đã chốt (ghi ngày + nguồn), hoặc hành vi production
  đang chạy. **Không lấy từ giả định của test case** (các mục "Assumption", "Pending Qx").
- Test case còn `Pending Q…` mà kết quả khác giả định → mở/nhắc câu hỏi Q, **không** viết bug.
- Spec im lặng → Expected = "Cần xác nhận", không tự suy ra.

## Cổng 4 — Phân loại nguyên nhân trước khi gọi là bug
Trả lời được câu hỏi "lỗi này do đâu?" trước khi tạo bug:

| Nguyên nhân | Xử lý |
|---|---|
| Dữ liệu/cấu hình do người dùng nhập sai (vd. nhập Link cho mục breadcrumb cuối) | Ghi chú cho hướng dẫn sử dụng / đề xuất validate, hỏi PO trước khi gọi là bug |
| Hành vi đã có trước ticket (production cũng vậy, kiểm bằng ảnh) | Ghi "pre-existing", tách khỏi kết quả ticket |
| Script/test data/môi trường (cache, phiên hết hạn, 502) | Không phải bug sản phẩm |
| Code của ticket làm sai so với Expected có nguồn | Bug |

## Checklist trước khi gửi bug draft
- [ ] Có ảnh khoanh vùng lỗi (UI) hoặc request/response (API) cho kết quả thực tế
- [ ] Đã đọc lại ảnh: ảnh thật sự cho thấy đúng điều bug mô tả
- [ ] Expected có nguồn (AC / PO + ngày / production), không phải Assumption
- [ ] Đối chứng (nếu có) bằng cách đo độc lập, có URL + thời điểm
- [ ] Đã phân loại nguyên nhân theo Cổng 4
- [ ] Đã tái hiện theo Rule 14

## Ví dụ thực tế (JS-8930, 18/11/2026)
- Báo "breadcrumb mặc định lặp tên quận: `… / Hóc Môn / Hóc Môn`" và "production cũng y hệt".
  Nguyên nhân sai: đọc `ol.innerText`, trong đó có 1 `<li class="sr-only">` (1×1px) chứa bản có link
  phục vụ SEO. Ảnh chụp production và QC chỉ hiện `Trang Chủ / Việc Làm TP.HCM / Hóc Môn`.
  Tái hiện "3/3" và "production cũng bị" đều sai cùng một cách đo → vi phạm Cổng 1 và Cổng 2.
- BUG-01 (field DL trống phải lấy bù từ SEO Meta) dựa trên Assumption của test case; PO chốt là lấy theo
  cả bộ DL → huỷ bug (Cổng 3).
- BUG-02 (dư "/" cuối breadcrumb) do người dùng nhập Link cho mục cuối → PO xếp là lỗi setting, đưa vào
  hướng dẫn sử dụng; sau đó Dev đổi UX tách "Trang hiện tại" chỉ có Text (Cổng 4).
