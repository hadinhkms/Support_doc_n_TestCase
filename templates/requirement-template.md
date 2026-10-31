---
id: REQ-XXX
title: <Tên feature>
status: Draft
version: 1.0
risk: High
owner: <team/person>
slug: <slug>
test_cases: test-cases/REQ-XXX-<slug>.md
---

# REQ-XXX: <Tên feature>

- **Status**: Draft | Ready for Test | In Test | Done
- **Owner**: <team/person>
- **Version**: <version>
- **Risk**: High | Medium | Low
- **Related pages/modules**: <page, API, job>
- **Source**: Product requirement | Design | API contract | Inferred from automation
- **Page exposure**: Public | Customer | Authenticated | Admin
- **UI coverage**: Required | Exempt (reason: <...>)
- **XSS applicability**: Applicable | Exempt (reason: <...>)

## Business goal

<Người dùng nào cần gì và vì sao?>

## Coverage notes

| Aspect | Status | Notes |
|---|---|---|
| UI/UX Geometry | Required / Exempt | `expectNoHorizontalScroll`, `expectNoTextOverflow`, `expectNotOccluded`, `expectInteractiveA11y`, `expectResponsiveIntegrity` |
| XSS Security | Applicable / Exempt | `expectSafeXssRender` với `XSS_PAYLOADS` trên vùng hiển thị (hoặc lý do Exempt) |
| Idempotency | Required / Exempt | `expectIdempotentSubmit` / `expectIdempotentApiMutation` chống gửi trùng |
| State Persistence | Required / Exempt | `expectStatePersistence` kiểm chứng trạng thái bền vững sau `page.reload()` |

## Scope

### In scope

- <...>

### Out of scope

- <...>

## Actors and preconditions

- Actor/role: <...>
- Preconditions: <...>
- Test data: <...>

## Acceptance criteria

### AC-001: <Tên tiêu chí>

**Given** <precondition>
**When** <action>
**Then** <observable result>

## Rules and validation

| Field/rule | Valid | Invalid | Boundary | Expected | Test cases |
|---|---|---|---|---|---|
| <field chữ> | <...> | rỗng, chỉ khoảng trắng | `max`, `max+1` ký tự | Chặn ở `maxlength` hoặc báo lỗi tại trường | TC-0xx |
| <field số> | <...> | nhập chữ (`abc`), ký tự đặc biệt (`!@#`), số âm | `min-1`, `min`, `max`, `max+1` | Không nhận chữ / báo lỗi định dạng số | TC-0xx |

Cột `Test cases` là bắt buộc: `node tools/qa gaps` dùng cột này để biết dòng rule nào
chưa có case nào phủ. Để trống sẽ bị báo gap.

## Non-functional expectations

- Performance: <...>
- Accessibility: <...>
- UI/UX & Layout: <Không đè phần tử (overlap) khi hiện lỗi, không tràn ngang (horizontal overflow) ở Desktop/Mobile, text dài không tràn khung, nút submit chống double-click>
- Security/permission: <...>
- Browser/device: <...>

## Open questions and assumptions

- [ ] Q-001: <question> - Owner: <...> - Due: <date>

## Evidence and confidence

| Statement/rule | Evidence | Confidence | Status |
|---|---|---|---|
| <rule inferred from behavior> | `<spec path>` - `<test title/assertion>` | High | Confirmed / Inferred / Needs confirmation |

## Gaps found from automation

- Untested behavior: <...>
- Weak or missing assertion: <...>
- Hard-coded or unsafe test data: <...>
- Hidden dependency/setup: <...>

## Change log

| Version | Date | Change | Impacted AC/TC | Regression needed |
|---|---|---|---|---|
| 1.0 | <YYYY-MM-DD> | Bản đầu tiên | - | - |

ID (`REQ-xxx`, `AC-xxx`) không được đổi sau khi đã dùng trong test case hoặc script.
Thay đổi lớn -> tăng version, thêm dòng ở bảng trên và rà lại các TC bị ảnh hưởng.

## Related artifacts

- Test cases: `test-cases/<feature>.md`
- Automation: `playwright/tests/<domain>/<feature>.spec.ts`
