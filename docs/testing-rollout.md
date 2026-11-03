# Testing Rollout & Evidence Readiness

## Mục tiêu

Phase 8 tập trung vào việc đưa kiểm thử vào sử dụng thực tế mà không biến các retry, artifact thiếu hoặc report stale thành tín hiệu xanh giả.

## Quy tắc rollout

1. Chỉ chấp nhận `pass` khi có bằng chứng đầy đủ: run ID, revision, artifact hoặc trace, và kết quả từng attempt.
2. `retry-only pass` không được coi là evidence hợp lệ cho rollout.
3. Report bị `quarantine`, hết hạn hoặc thiếu artifact phải được xem là chặn gate.
4. Một run chỉ được approve nếu không có false-positive risk và không có dấu hiệu flaky.

## Dữ liệu cần theo dõi

- `firstAttempt`: lần chạy đầu tiên có thành công không.
- `retryCount`: số lần chạy lại.
- `flaky`: đánh dấu fail rồi pass trên cùng commit/môi trường.
- `quarantined`: test hoặc report đã bị tắt tạm thời và cần owner xử lý.
- `artifactPath` / `tracePath` / `reportPath`: bằng chứng cần tải để tái hiện.
- `reproducible`: báo cáo đã được lặp lại từ recipe thực tế.

## Chỉ số chốt

- `firstAttemptPass`: số run pass ở lần đầu.
- `retriedPass`: số run pass sau retry.
- `flaky`: số trường hợp fail → pass hoặc report bị đánh dấu flaky.
- `quarantined`: số evidence bị quarantine hoặc hết hạn.
- `missingArtifact`: số run không có artifact/trace cần thiết.
- `evidenceMissing`: số run không có đủ evidence để kiểm tra.

## Kết luận rollout

Một rollout chỉ được phép tiếp tục khi tất cả các tiêu chí sau đều đúng:

- không có `retry-only pass`
- không có artifact thiếu
- không có evidence thiếu
- không có flaky
- không có quarantine/cảnh báo stale
- report có thể tái hiện từ recipe

## Mẫu JSON tiện dụng

```json
{
  "scope": "phase-8-rollout",
  "owner": "@qa",
  "startedAt": "2026-11-02T10:00:00Z",
  "notes": "Healthy control plus fault-injection replay",
  "summary": {
    "totalRuns": 3,
    "firstAttemptPass": 2,
    "retriedPass": 0,
    "flaky": 0,
    "quarantined": 0,
    "missingArtifact": 0,
    "evidenceMissing": 0,
    "readyForRollout": true
  }
}
```

## Ghi chú

Bản này là định nghĩa vận hành cho Phase 8, không thay thế requirement nghiệp vụ của từng app. Nó chỉ chuẩn hóa việc chốt rollout dựa trên evidence chân thực, không dựa trên các pass ẩn sau retry.
