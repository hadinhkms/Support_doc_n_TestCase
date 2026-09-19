# REQ-XXX: <Tên feature>

- Status: Draft | Ready for Test | In Test | Done
- Owner: <team/person>
- Version: <version>
- Risk: High | Medium | Low
- Related pages/modules: <page, API, job>
- Source: Product requirement | Design | API contract | Inferred from automation

## Business goal

<Người dùng nào cần gì và vì sao?>

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
| <field> | <...> | <...> | <...> | <...> | TC-0xx |

Cột `Test cases` là bắt buộc: `node tools/qa gaps` dùng cột này để biết dòng rule nào
chưa có case nào phủ. Để trống sẽ bị báo gap.

## Non-functional expectations

- Performance: <...>
- Accessibility: <...>
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
