# Research Notes — RES-16

> VERIFIED · 2026-11-03 · Đã được QC/UAT review; source và đề xuất trong phạm vi repo đã được đối chiếu với evidence package.
> Research Gate: CONDITIONAL PASS trong scope plan; Phase 0 và phase đích đã được review bằng repo validation.
> Không coi desk research lượt trước là thay thế trusted evidence package của production app.

## Nguồn nội bộ
- .github/copilot-instructions.md: rule test/traceability/false-positive/line budget.
- docs/qa-research-references.md: danh mục nguồn ngoài theo yêu cầu workspace.
- .agents/skills: qa-system-testing, qa-logic-gaps, qa-api-testing, qa-ui-review, qa-test-execution.
- playwright/tests/support/evidence.ts: journey capture và ảnh khoanh vùng.
- playwright/tests/fixtures/runtime-trap*.ts: capture và redaction hiện hữu.
- playwright/tests/support/api-guards.ts: required fields/type mức đầu và security guards.
- playwright/tests/support/resilience-guards.ts: network recovery và action timing budget.
- playwright/tests/a11y/login.a11y.spec.ts: axe + keyboard đã có.
- playwright/deep-engine-tests: HM controlled fault/regression probes đã có.
- docs/flaky-test-policy.md, docs/test-data-management.md: nền quản trị hiện hữu.
- .github/workflows/playwright.yml: blob/HTML, shard, helper runtime checks, priority gate.
- _Plan_implement/plan-13*, plan-14*, plan-15*: reuse; nhãn hoàn thành không tự là evidence hiện tại.
- Baseline: 5f3124ef6e60e5f6a8e5670b5d2cdb5ee28a6f02; có user changes.
- Ghim path:line/hash và diff identity của từng finding khi làm formal R3.

## Nguồn Master Process đã tham chiếu
- D:/_Master_process/AGENTS.md, 00_CORE_PROCESS_GUIDE.md, 03_ACCEPTANCE_GATES.md.
- docs/RISK_CLASSIFICATION.md; config/research-policy.json.
- templates/plan/overview.template.md, phase.template.md và plan/README.md.
- prompts/01_A1_BA_Discovery_Plan.prompt.md, 17_Research_Investigation.prompt.md.
- prompts/19_Plan_Standardization.prompt.md chỉ tham khảo cấu trúc, không phải đang chuẩn hóa plan cũ.
- Skills principal-ba và technical-lead: scope, dependencies, split, no self-signoff.

## Nguồn chính thức đã đọc trong research của chat
| ID | Nguồn | Điều hỗ trợ | Confidence |
|---|---|---|---|
| RES-16-S1 | [Playwright Visual](https://playwright.dev/docs/test-snapshots) | Screenshot baseline/diff và môi trường rendering | HIGH |
| RES-16-S2 | [Playwright Accessibility](https://playwright.dev/docs/accessibility-testing) | Axe integration và giới hạn scan tự động | HIGH |
| RES-16-S3 | [k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | Metrics thành pass/fail thresholds | HIGH |
| RES-16-S4 | [fast-check](https://fast-check.dev/docs/introduction/) | Generated input và shrink counterexample | HIGH |
| RES-16-S5 | [Stryker](https://stryker-mutator.io/docs/) | Mutation để đánh giá khả năng bắt lỗi | HIGH |
| RES-16-S6 | [OWASP ASVS](https://asvs.owasp.org/) | Danh mục kiểm soát bảo mật kiểm chứng được | HIGH |
| RES-16-S7 | [Pact](https://docs.pact.io/getting_started/how_pact_works) | Consumer/provider contract verification | HIGH |
| RES-16-S8 | [Playwright CLI](https://github.com/microsoft/playwright-cli) | Tham khảo workflow agent, không thay Playwright suite | HIGH |
| RES-16-S9 | [Playwright MCP](https://github.com/microsoft/playwright-mcp) | Tham khảo browser tooling theo danh mục repo | HIGH |

## Phân biệt fact và đề xuất
- FACT: repo có axe, keyboard test, runtime trap, API guards và HM fault probes.
- INFERENCE: evidence manifest/replay/trust có thể tăng khả năng tiếp quản; cần pilot đo.
- PROPOSAL: tên skill, tên module, schema, phases và bộ negative controls trong plan.
- UNKNOWN: app pilot, artifact service/retention, SLO, runner compatibility và topology.
- Không có runtime benchmark hay kiểm chứng compatibility dependency trong lượt này.

## Alternatives và rủi ro cần đưa vào formal R3
| Quyết định | Alternatives | Chốt khi nào |
|---|---|---|
| Evidence storage | CI artifacts; object storage; restricted internal store | Phase 0 theo access/retention/quota |
| Visual | Native Playwright; dịch vụ managed nếu scale cần | Phase 3 theo noise/cost |
| Load | k6; công cụ đã dùng tại target | Phase 4 spike + owner SLO |
| Properties | fast-check; deterministic vectors cho invariant nhỏ | Phase 5 runner compatibility |
| Mutation | Engine hỗ trợ runner thật; HM probes mở rộng | Phase 5 benchmark |
| Contracts | Schema validation; consumer-driven Pact nếu deploy độc lập | Phase 7 topology |

Không đánh đồng checksum với chữ ký, local receipt với trusted CI, hoặc harness pass với app pass.

