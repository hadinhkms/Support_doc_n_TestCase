# Test Cases: REQ-XXX <Tên feature>

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-XXX | AC-001 | TC-001 | Yes / Candidate / No | `tests/<domain>/<feature>.spec.ts` | P1 |

## Test data and environment

- Environment: <URL/name>
- User/role: <...>
- Seed data: <...>
- Cleanup: <...>

## Test cases

### TC-001: <Mục tiêu kiểm thử>

- Type: Functional | Validation | Boundary | Security | Accessibility | Regression
- Priority: P0 | P1 | P2 | P3
- Technique: <EP/BVA/Decision table/State transition/Error guessing>
- Automation: Yes | Candidate | No
- Tags: `@smoke @p0 @security @a11y` (khớp với Priority ở trên)
- Preconditions: <...>
- Test data: <...>

| Step | Action | Expected result |
|---|---|---|
| 1 | <action cụ thể> | <kết quả quan sát được> |
| 2 | <action cụ thể> | <kết quả quan sát được> |

## Case không automation

Mọi case `Automation: No` phải có một dòng ở đây. Không để trống lý do.

| Test case | Lý do | Bù đắp bằng gì |
|---|---|---|
| TC-0xx | <CAPTCHA/OTP thật, cần con người đánh giá, chi phí bảo trì > giá trị> | <test thủ công theo chu kỳ, monitoring, test ở tầng API> |

## Coverage notes

- Positive: <...>
- Negative: <...>
- Boundary: <...>
- Permission/state: <...>
- Uncovered risk: <...>
