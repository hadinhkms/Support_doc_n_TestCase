# PHASE 5: NAVIGATION ASSERTION HEURISTIC VÀ GRADUATION

> Thuộc [Plan 13 v1.2](../13_SELF_EVOLVING_QA_SKILL_AND_SELECTIVE_LEARNING_PLAN.md). Chốt contract sau Phase 1; có thể phát triển độc lập Phase 2–4, tích hợp trước nghiệm thu.

## 1. File thay đổi

- tools/qa/lib/sources.js: callback boundary/scanner/navigation metadata.
- tools/qa/lib/sources.test.js: parser/scanner fixtures.
- tools/qa/lib/commands.js: finding minor spec-chi-assert-url.
- tools/qa/lib/commands.test.js: finding/filter/strict regression.

Không copy regex v1.1: bỏ expect không parse được biến unknown thành URL-only; slice tới test kế tiếp có thể lấy hook/test khác.

## 2. Analysis contract

Trả {kind: navigation-only | mixed | none | unknown, matchers, reason}. Compatibility flag onlyNavigationAssert chỉ true khi navigation-only. False không chứng minh business assertion đủ mạnh.

Xác định đúng callback từ vị trí Playwright list bằng delimiter scanner theo brace/paren/string/comment/template; không dựa indentation test kế tiếp. Node core scanner không là TypeScript AST đầy đủ: regex literal/template interpolation/syntax không hỗ trợ chắc chắn => unknown. Không lấy assertion từ hook hoặc test khác.

Bỏ comment/string/template text giả; hỗ trợ multiline, expect.soft, not/resolves/rejects. Chỉ toHaveURL/toHaveTitle trên page hoặc alias page fixture nhận diện được mới là navigation. Locator/custom receiver không rõ => unknown.

Có >=1 assertion parse được và tất cả matcher URL/Title, không có expect/verification call chưa giải quyết => navigation-only. Có UI/data matcher => mixed nhưng không tuyên bố đủ nghiệp vụ. Không assertion/helper verification => none. Helper/custom expect/poll/configure/dynamic call chưa hỗ trợ => unknown, giữ reason cho semantic audit.

Call tùy ý có thể che assertion: khi không xác định được phải unknown thay vì đoán. Định nghĩa whitelist thao tác Playwright không chứa assertion (ví dụ page.goto, locator.fill/click) có test; không coi mọi call là helper khiến URL-only rule vô hiệu. Giới hạn scanner phải nêu trong README; không kéo dependency AST hoặc phân tích liên module vào MVP. Giữ assertionCount/findMissingAwaits cũ trừ khi có regression test chứng minh sửa cần thiết.

## 3. Finding và graduation

Gaps chỉ phát minor khi test thật, không skipped/@wip, trong filter, navigation-only. Finding có file:line, TC/title, matcher evidence. Action: đối chiếu expected TC, bổ sung assertion đúng kết quả nghiệp vụ nếu TC yêu cầu; không khuyên thêm visibility bất kỳ để hết warning.

Navigation thuần có thể đúng expected nên không nâng major hoặc làm strict fail chỉ vì finding này. Unknown giữ trong metadata/report audit, không máy móc đổi thành thiếu assertion.

PA-01 chỉ được graduate một phần. Giữ trong catalog, thêm comment metadata staticRule: spec-chi-assert-url và coverage: partial (parser Phase 1 chấp nhận). Learner không reject mọi semantic lesson tương ứng vì static rule tồn tại. Retire hoàn toàn cần chứng minh coverage và review riêng, không tự gỡ để lấy slot.

## 4. Test matrix

| ID | Expected |
|---|---|
| S01 | Chỉ URL/Title hoặc cả hai trên page => navigation-only |
| S02 | URL + UI/data => mixed; zero assertion => none |
| S03 | Multiline/soft/not/resolves/rejects parse đúng |
| S04 | Comment/string/template giả không đếm; syntax mơ hồ unknown |
| S05 | Hai test liên tiếp, nested callback, hook trước/sau, sâu indentation không lẫn body |
| S06 | Helper/custom expect/matcher/poll/configure/dynamic => unknown nếu chưa hỗ trợ |
| S07 | Locator/custom receiver toHaveTitle không bị coi chắc là page navigation |
| S08 | Gaps kind/severity/where đúng; mixed/none/unknown không gắn nhầm |
| S09 | Wip/skip/fixme/ignore và req/domain/tag filters được tôn trọng |
| S10 | Strict minor-only exit 0, major vẫn exit 1; missing-await/assertionCount regression không đổi |

Parser tests kèm integration fixture spec -> inventory -> gaps, không chỉ truyền object flag true để test lại if. Không cần app thật; verify dùng Playwright list đúng repo fixture.

## 5. Nghiệm thu

npm test PASS matrix S01–S10 và test cũ. npm run qa:check root + npm run verify trong playwright exit 0 sau xử lý đúng baseline. Không sửa spec mẫu chỉ để mất warning. Công bố unknown/false-positive limits và giữ PA-01 cho semantic audit.
