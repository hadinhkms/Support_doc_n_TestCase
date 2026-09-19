# Quyết định đang chờ xác nhận

> File này được SINH RA từ `decisions.json` bằng `npm run decisions:render`.
> Đừng sửa tay — sửa `decisions.json`, hoặc xác nhận qua dashboard.

Lập ngày 2026-09-20. Nguồn: Audit đọc trực tiếp 3 repo: D:\_Script_automation, D:\_CarThings\Automation_Carthings, D:\_Automation-Project

| # | Quyết định | Đang chặn | Mức | Trạng thái |
|---|---|---|---|---|
| D-01 | Giữ qa-trace của Hub hay tools/qa của repo chuẩn làm analyzer duy nhất? | Lần sync đầu tiên xuống 2 satellite | Chặn | ⬜ chờ xác nhận |
| D-02 | Ai sở hữu CLAUDE.md, AGENTS.md, GEMINI.md, QA_AI_RULES.md? | Dọn 20 file at-risk ở Hub, và việc viết lại 13 rule QA | Chặn | ⬜ chờ xác nhận |
| D-03 | 8 mục ship mà Hub không hề có: hạ seed hay đưa framework lên Hub? | Tính đúng đắn của sync-manifest.json | Chặn | ⬜ chờ xác nhận |
| D-05 | URL môi trường test của Instructor Portal là gì? | 6 script TC-001..TC-006 của REQ-001 | Chặn | ⬜ chờ xác nhận |
| D-06 | Owner và status của REQ-001? | Script đầu tiên gắn tag @REQ-001 | Chặn | ⬜ chờ xác nhận |
| D-07 | Nhãn UI trong PRD ghi là đề xuất - có bắt buộc đúng nguyên văn không? | Cách viết assertion cho TC-001, TC-002, TC-003 | Chặn | ⬜ chờ xác nhận |
| D-08 | 10 spec company/admin: viết REQ hay ghi quyết định để ngoài gate? | Bật CI gate ở CarThings | Chặn | ⬜ chờ xác nhận |
| D-04 | TC-013: automation, ghi No kèm lý do, hay hạ xuống P2? | CI của repo chuẩn đang đỏ trên main | Gấp | ⬜ chờ xác nhận |
| D-09 | Git identity ở hai satellite đang là github-actions[bot] - có sửa không? | Truy vết tác giả của mọi commit sau này | Nên sớm | ⬜ chờ xác nhận |
| D-10 | Có bao giờ sync .github/workflows xuống satellite không? | Guard ở Hub | Nên sớm | ⬜ chờ xác nhận |
| D-11 | Vieclam24h có nằm trong đợt triển khai này không? | Phạm vi triển khai và việc viết lại rule AI | Nên sớm | ⬜ chờ xác nhận |

---

## D-01. Giữ qa-trace của Hub hay tools/qa của repo chuẩn làm analyzer duy nhất?

- Mức: **Chặn** · Đang chặn: Lần sync đầu tiên xuống 2 satellite
- Repo liên quan: `D:\_Automation-Project` · `D:\_CarThings\Automation_Carthings`

**Bối cảnh.** Hai tool cùng làm một việc (REQ -> AC -> TC -> spec) và đọc CÙNG một quy ước: requirements/REQ-xxx-<slug>.md, test-cases/ với TC-zzz - AC-yyy, tag @REQ-xxx. Module `scripts` của Hub chỉ loại trừ sync-satellites.js, sync-from-core.js, pre-sync-drift.js và hai file sync-manifest. qa-trace.js KHÔNG nằm trong danh sách loại trừ, nên lần sync thành công đầu tiên sẽ đẩy nó xuống cả CarThings lẫn Vieclam24h dù chưa ai quyết định. CarThings hiện đã có tools/qa và 5 script qa:* trỏ vào nó.

| Tiêu chí | qa-trace (Hub) | tools/qa (repo chuẩn) |
|---|---|---|
| Quy mô | 452 + 178 dòng, có 378 dòng unit test | 1.066 dòng, không có test nào |
| Cách đọc spec | Phân tích tĩnh bằng regex | Chạy npx playwright test --list (~3s, cần node_modules) |
| Chỉ soi phần vừa đổi | Có, --since=origin/main | Không |
| Bắt test không có assertion | Có | Không |
| Bắt định danh sai quy ước (TC-0001, tc-003) | Có | Không |
| Lệnh impact REQ-xxx | Không | Có |
| Bắt khai automation nhưng không có script | Không | Có |
| Kiểm tra bảng Rules and validation | Không | Có |
| Đã nằm trong kênh sync xuống satellite | Có | Không |

**Bằng chứng.**

- qa-trace không bị loại trừ khỏi sync nên sẽ tự xuống satellite — `D:\_Automation-Project\scripts\lib\sync-manifest.js - excludes của module scripts`
- CarThings đang dùng tools/qa cho 5 script qa:* — `D:\_CarThings\Automation_Carthings\package.json`
- tools/qa không có unit test nào — `D:\_Script_automation\tools\qa - chỉ có index.js, README.md, lib/`

**Lựa chọn.**

- **Giữ qa-trace, port tính năng thiếu, gỡ tools/qa khỏi CarThings** _(đề xuất)_ — tools/qa ở lại repo chuẩn như bản tham chiếu. Phải port 4 loại finding + lệnh impact sang qaTrace.js kèm unit test.
- **Giữ tools/qa, loại qa-trace khỏi sync** — Mất --since, mất phát hiện test không assertion, và phải viết unit test từ đầu cho tools/qa.
- **Giữ cả hai, phân vai rõ ràng** — Hai tool, hai định nghĩa qa:check. Phải ghi rõ tool nào phụ trách phần nào, nếu không sẽ lệch nhau.

**Đề xuất:** Giữ qa-trace, port tính năng thiếu, gỡ tools/qa khỏi CarThings. qa-trace có unit test, không phụ thuộc Playwright, có --since, và đã nằm sẵn trong kênh sync.

```
Chờ xác nhận. Chọn một:
  [ ] keep-qa-trace — Giữ qa-trace, port tính năng thiếu, gỡ tools/qa khỏi CarThings
  [ ] keep-tools-qa — Giữ tools/qa, loại qa-trace khỏi sync
  [ ] keep-both — Giữ cả hai, phân vai rõ ràng
Người xác nhận:            Ngày:
```

---

## D-02. Ai sở hữu CLAUDE.md, AGENTS.md, GEMINI.md, QA_AI_RULES.md?

- Mức: **Chặn** · Đang chặn: Dọn 20 file at-risk ở Hub, và việc viết lại 13 rule QA
- Repo liên quan: `D:\_Automation-Project` · `D:\_CarThings\Automation_Carthings` · `D:\_Script_automation`

**Bối cảnh.** Bốn file này đang bị ba nơi cùng nhận: nằm trong ROOT_FILES_TO_SYNC của Hub (Hub ghi đè), nằm nhóm ship trong sync-manifest.json của repo chuẩn, và chứa 45 dòng nội dung riêng của satellite. 45 dòng đó đang nằm trong danh sách at-risk của pre-sync-drift. Lần sync thành công đầu tiên sẽ xoá sạch chúng.

**Bằng chứng.**

- 45 dòng riêng của CarThings: CLAUDE.md 17, GEMINI.md 11, AGENTS.md 10, QA_AI_RULES.md 7 — `node scripts/pre-sync-drift.js tại Hub`
- Bốn file nằm trong ROOT_FILES_TO_SYNC — `D:\_Automation-Project\scripts\lib\sync-manifest.js`

**Lựa chọn.**

- **Hub sở hữu hoàn toàn, 45 dòng riêng chuyển sang file không được sync** _(đề xuất)_ — Cần chọn nơi chứa phần riêng (ví dụ .ai/local/ hoặc core/local/) trước khi dọn drift.
- **Bỏ 4 file khỏi ROOT_FILES_TO_SYNC, mỗi project tự giữ** — Rule AI sẽ lệch nhau giữa các project theo thời gian.

**Đề xuất:** Hub sở hữu hoàn toàn, 45 dòng riêng chuyển sang file không được sync. Giữ được rule chung nhất quán, phần riêng vẫn an toàn nếu để ở vùng không sync.

```
Chờ xác nhận. Chọn một:
  [ ] hub-owns — Hub sở hữu hoàn toàn, 45 dòng riêng chuyển sang file không được sync
  [ ] project-owns — Bỏ 4 file khỏi ROOT_FILES_TO_SYNC, mỗi project tự giữ
Người xác nhận:            Ngày:
```

---

## D-03. 8 mục ship mà Hub không hề có: hạ seed hay đưa framework lên Hub?

- Mức: **Chặn** · Đang chặn: Tính đúng đắn của sync-manifest.json
- Repo liên quan: `D:\_Script_automation` · `D:\_Automation-Project`

**Bối cảnh.** sync-manifest.json khai 9 mục ship, nhưng Hub chỉ có tools/visual_compare.html. Tám mục sau không tồn tại ở Hub nên không bao giờ được ship: templates, docs, tools/qa, tools/boundary, .github/ISSUE_TEMPLATE, .github/pull_request_template.md, playwright/eslint.config.mjs, .github/copilot-instructions.md. Manifest đang mô tả một thực tế không có.

**Bằng chứng.**

- Hub tools/ chỉ có visual_compare.html; không có templates/ hay qa.config.json — `ls D:\_Automation-Project\tools`
- MODULES_TO_SYNC = dashboard, core, bin, scripts, ai, tools — `D:\_Automation-Project\scripts\lib\sync-manifest.js`

**Lựa chọn.**

- **Hạ 8 mục xuống seed ngay, đưa lên Hub sau như bước riêng** _(đề xuất)_ — Manifest nói đúng sự thật ngay hôm nay. Việc đưa lên Hub phụ thuộc D-01, D-02 và việc dọn drift.
- **Đưa framework lên Hub trước, giữ nguyên nhóm ship** — Phải làm sau khi dọn xong drift và thêm SEED mode, nếu không sync sẽ đè cấu hình riêng của satellite.

**Đề xuất:** Hạ 8 mục xuống seed ngay, đưa lên Hub sau như bước riêng. Rẻ, làm được ngay, và không phụ thuộc quyết định nào khác.

```
Chờ xác nhận. Chọn một:
  [ ] demote-seed — Hạ 8 mục xuống seed ngay, đưa lên Hub sau như bước riêng
  [ ] move-to-hub — Đưa framework lên Hub trước, giữ nguyên nhóm ship
Người xác nhận:            Ngày:
```

---

## D-05. URL môi trường test của Instructor Portal là gì?

- Mức: **Chặn** · Đang chặn: 6 script TC-001..TC-006 của REQ-001
- Repo liên quan: `D:\_CarThings\Automation_Carthings`

**Bối cảnh.** pages/InstructorPortalPage.js:67 hard-code https://instructor-dev.carthings.vn/login. Đây là suy luận từ code, chưa ai xác nhận đó là môi trường QA chính thức. Sai đích thì cả sáu test assert vào nhầm hệ thống, rồi gate sẽ cưỡng chế chính cái sai đó.

**Bằng chứng.**

- URL nằm cứng trong page object — `D:\_CarThings\Automation_Carthings\pages\InstructorPortalPage.js:67`
- Requirement ghi rõ đây là giả định chưa xác nhận — `requirements/REQ-001-entry-points.md - Q-002 và bảng Evidence`

**Lựa chọn.**

- **Đúng là instructor-dev.carthings.vn** — Đưa URL ra biến môi trường rồi viết test.
- **URL khác (ghi vào ô ghi chú)** — Phải sửa page object trước khi viết test mới.

**Không đề xuất.** Không đoán thay. Cần người biết hạ tầng xác nhận.

```
Chờ xác nhận. Chọn một:
  [ ] confirm-dev — Đúng là instructor-dev.carthings.vn
  [ ] other-url — URL khác (ghi vào ô ghi chú)
Cần điền thêm: URL đúng:            | Cần VPN/tài khoản riêng không:
Người xác nhận:            Ngày:
```

---

## D-06. Owner và status của REQ-001?

- Mức: **Chặn** · Đang chặn: Script đầu tiên gắn tag @REQ-001
- Repo liên quan: `D:\_CarThings\Automation_Carthings`

**Bối cảnh.** requirements/REQ-001-entry-points.md có owner: chưa gán và status: Draft. Rule requirement-draft-nhung-da-co-script bắn MAJOR ngay khi có script gắn @REQ-001. Nếu lật status SAU khi viết script, gate sẽ đỏ đúng lúc vừa làm xong việc. Phải lật trước.

**Bằng chứng.**

- Front matter đang là owner: chưa gán, status: Draft — `requirements/REQ-001-entry-points.md`
- Rule requirement-draft-nhung-da-co-script là mức major — `tools/qa/README.md - bảng finding của drift`

**Lựa chọn.**

- **Chuyển sang Ready for Test và gán owner** _(đề xuất)_ — Viết script được ngay sau đó.
- **Giữ Draft** — Chưa được viết script gắn @REQ-001, nếu không gate sẽ đỏ.

**Đề xuất:** Chuyển sang Ready for Test và gán owner. PRD baseline đã chốt (§25 ghi rõ không còn open question), nên requirement không có lý do ở Draft.

```
Chờ xác nhận. Chọn một:
  [ ] ready — Chuyển sang Ready for Test và gán owner
  [ ] keep-draft — Giữ Draft
Cần điền thêm: Owner REQ-001:
Người xác nhận:            Ngày:
```

---

## D-07. Nhãn UI trong PRD ghi là đề xuất - có bắt buộc đúng nguyên văn không?

- Mức: **Chặn** · Đang chặn: Cách viết assertion cho TC-001, TC-002, TC-003
- Repo liên quan: `D:\_CarThings\Automation_Carthings`

**Bối cảnh.** PRD §5 (Confluence 8880213 v13) đặt tên cột là 'Label UI đề xuất' cho ba nhãn: Đăng nhập bằng Carthings, Tham gia Company bằng mã mời, Đăng nhập Instructor Portal. Nếu nhãn là bắt buộc, test assert nguyên văn chuỗi. Nếu chỉ là gợi ý, test phải assert theo vai trò và ngữ nghĩa. Hai cách cho ra hai script khác hẳn nhau, và assert nguyên văn một nhãn chỉ là gợi ý sẽ thành test giòn.

**Bằng chứng.**

- Cột nhãn trong PRD ghi là đề xuất — `Confluence page 8880213 v13, §5 bảng Entry Point`

**Lựa chọn.**

- **Nhãn bắt buộc đúng nguyên văn** — Test assert chuỗi. Đổi chữ trên UI là test đỏ, đúng ý đồ.
- **Nhãn chỉ là gợi ý, test theo vai trò và ngữ nghĩa** — Test bền hơn nhưng không bắt được việc đổi nhãn gây hiểu nhầm.

**Không đề xuất.** Phụ thuộc ý định của PO, không suy ra được từ tài liệu.

```
Chờ xác nhận. Chọn một:
  [ ] exact — Nhãn bắt buộc đúng nguyên văn
  [ ] semantic — Nhãn chỉ là gợi ý, test theo vai trò và ngữ nghĩa
Người xác nhận:            Ngày:
```

---

## D-08. 10 spec company/admin: viết REQ hay ghi quyết định để ngoài gate?

- Mức: **Chặn** · Đang chặn: Bật CI gate ở CarThings
- Repo liên quan: `D:\_CarThings\Automation_Carthings`

**Bối cảnh.** CarThings có 10 test e2e thuộc admin./company./carthings.vn. Không test nào mang mã TC-xxx nên drift báo 11 MAJOR test-khong-co-ma-tc. Bật gate mà chưa xử lý là gate đỏ vĩnh viễn ngay ngày đầu, và một gate luôn đỏ thì sau hai tuần cả đội bỏ qua nó.

**Bằng chứng.**

- 11 finding test-khong-co-ma-tc — `node tools/qa drift tại CarThings`
- Các spec thuộc luồng company/admin, không thuộc phạm vi PRD Instructor Portal — `tests/e2e/*.spec.js`

**Lựa chọn.**

- **Ghi quyết định thành văn bản để 10 spec ngoài phạm vi gate đợt này, kèm hạn rà lại** _(đề xuất)_ — Gate bật được ngay cho phần Instructor Portal. Cần cơ chế scope (ignoreSpecs) trong qa.config.json.
- **Viết REQ cho luồng company/admin trước khi bật gate** — Đầy đủ hơn nhưng tốn vài ngày đọc ngược từ script.

**Đề xuất:** Ghi quyết định thành văn bản để 10 spec ngoài phạm vi gate đợt này, kèm hạn rà lại. Có giá trị ngay mà không tạo ra một núi việc dọn dẹp chặn đường.

```
Chờ xác nhận. Chọn một:
  [ ] out-of-scope — Ghi quyết định thành văn bản để 10 spec ngoài phạm vi gate đợt này, kèm hạn rà lại
  [ ] write-reqs — Viết REQ cho luồng company/admin trước khi bật gate
Cần điền thêm: Hạn rà lại:
Người xác nhận:            Ngày:
```

---

## D-04. TC-013: automation, ghi No kèm lý do, hay hạ xuống P2?

- Mức: **Gấp** · Đang chặn: CI của repo chuẩn đang đỏ trên main
- Repo liên quan: `D:\_Script_automation`

**Bối cảnh.** npm run qa:check exit 1, finding duy nhất là p0-p1-con-dang-candidate: TC-013 là P1 nhưng còn Candidate. Vì job e2e khai needs [quality, traceability] nên job e2e CHƯA TỪNG CHẠY kể từ khi workflow được thêm. Lối tắt đáng chú ý: rule chỉ bắn vào dòng P0/P1 còn Candidate. TC-009 là P1 với Automation No và không bị bắt. Nên ghi TC-013 thành No kèm lý do sẽ xanh gate ngay mà không phải hạ một P1 thật xuống P2.

**Bằng chứng.**

- qa:check exit 1, một finding duy nhất là TC-013 — `node tools/qa gaps --strict tại D:\_Script_automation`
- job e2e phụ thuộc job traceability — `.github/workflows/playwright.yml - needs: [quality, traceability]`
- TC-009 là P1 Automation No và không bị flag — `test-cases/REQ-001-sign-in.md`

**Lựa chọn.**

- **Ghi No kèm lý do ở mục Case không automation** _(đề xuất)_ — Xanh gate ngay, giữ priority trung thực, vẫn ghi lại quyết định.
- **Viết script automation cho TC-013** — Tốt nhất về chất lượng nhưng CI còn đỏ cho tới khi script xong.
- **Hạ xuống P2 kèm giải thích** — Xanh gate nhưng làm sai lệch mức ưu tiên thật của case.

**Đề xuất:** Ghi No kèm lý do ở mục Case không automation. Rẻ nhất, xanh gate ngay, và không phải nói dối về priority.

```
Chờ xác nhận. Chọn một:
  [ ] mark-no — Ghi No kèm lý do ở mục Case không automation
  [ ] automate — Viết script automation cho TC-013
  [ ] demote-p2 — Hạ xuống P2 kèm giải thích
Người xác nhận:            Ngày:
```

---

## D-09. Git identity ở hai satellite đang là github-actions[bot] - có sửa không?

- Mức: **Nên sớm** · Đang chặn: Truy vết tác giả của mọi commit sau này
- Repo liên quan: `D:\_CarThings\Automation_Carthings` · `D:\_SieuVietGroup`

**Bối cảnh.** git config --local --get user.name ở cả hai repo đều trả về github-actions[bot]. 10/10 commit gần nhất của CarThings mang tên bot, kể cả bd65bd0 là commit cài framework QA. Hệ quả: mất dấu vết ai làm gì và git blame vô dụng.

**Bằng chứng.**

- user.name là github-actions[bot] ở cả hai satellite — `git config --local --get user.name`
- 10/10 commit gần nhất của CarThings mang tên bot — `git log --format=%an -10`

**Lựa chọn.**

- **Đổi về người thật ở cả hai repo** _(đề xuất)_ — Commit sau này truy vết được. Commit cũ giữ nguyên.
- **Cố ý để bot** — Cần ghi rõ lý do, nếu không người sau sẽ tưởng là lỗi cấu hình.

**Đề xuất:** Đổi về người thật ở cả hai repo. Chi phí gần bằng 0, lợi ích là truy vết được trách nhiệm.

```
Chờ xác nhận. Chọn một:
  [ ] fix — Đổi về người thật ở cả hai repo
  [ ] keep — Cố ý để bot
Cần điền thêm: Tên + email dùng:
Người xác nhận:            Ngày:
```

---

## D-10. Có bao giờ sync .github/workflows xuống satellite không?

- Mức: **Nên sớm** · Đang chặn: Guard ở Hub
- Repo liên quan: `D:\_Automation-Project`

**Bối cảnh.** CarThings đang có 2 workflow riêng (playwright.yml, discord-run-playwright.yml). Thêm .github/workflows vào MODULES_TO_SYNC sẽ ghi đè CI riêng của project. Nguy hơn: sync-satellites.yml mà lọt xuống một satellite sẽ cho satellite đó quyền ghi đè vào satellite còn lại.

**Bằng chứng.**

- CarThings có 2 workflow riêng — `ls D:\_CarThings\Automation_Carthings\.github\workflows`
- Hub có sync-satellites.yml chạy sync tự động — `D:\_Automation-Project\.github\workflows\sync-satellites.yml`

**Lựa chọn.**

- **Không bao giờ sync, thêm guard chặn hẳn** _(đề xuất)_ — Giống cách assertNoForbiddenModules đang chặn requirements/test-cases.
- **Sync có chọn lọc từng file** — Phải ghi rõ file nào, và guard vẫn phải chặn sync-satellites.yml.

**Đề xuất:** Không bao giờ sync, thêm guard chặn hẳn. CI là thứ mỗi project tự quyết theo môi trường và secret của mình.

```
Chờ xác nhận. Chọn một:
  [ ] never — Không bao giờ sync, thêm guard chặn hẳn
  [ ] selective — Sync có chọn lọc từng file
Người xác nhận:            Ngày:
```

---

## D-11. Vieclam24h có nằm trong đợt triển khai này không?

- Mức: **Nên sớm** · Đang chặn: Phạm vi triển khai và việc viết lại rule AI
- Repo liên quan: `D:\_SieuVietGroup`

**Bối cảnh.** D:\_SieuVietGroup là satellite thứ hai trong SATELLITES của Hub. Nó chưa có requirements/, test-cases/, qa.config.json hay script qa:* nào, nhưng nhận mọi thứ trong MODULES_TO_SYNC và ROOT_FILES_TO_SYNC. Nếu viết lại 13 rule QA rồi sync, Vieclam24h sẽ nhận một bộ rule mô tả framework chưa hề được cài ở đó.

**Bằng chứng.**

- Vieclam24h chưa có gì của framework — `ls D:\_SieuVietGroup - không có requirements/, test-cases/, qa.config.json`
- Nó vẫn nằm trong SATELLITES nên vẫn nhận sync — `D:\_Automation-Project\scripts\lib\sync-manifest.js`

**Lựa chọn.**

- **Chỉ CarThings đợt này, Vieclam24h sau** _(đề xuất)_ — Rule AI phải viết sao cho không gây hiểu nhầm ở repo chưa cài.
- **Cả hai cùng lúc** — Phải audit Vieclam24h trước, tốn thêm thời gian.

**Đề xuất:** Chỉ CarThings đợt này, Vieclam24h sau. CarThings đã có PRD, có môi trường test và đã cài sẵn. Vieclam24h chưa audit lần nào.

```
Chờ xác nhận. Chọn một:
  [ ] carthings-first — Chỉ CarThings đợt này, Vieclam24h sau
  [ ] both — Cả hai cùng lúc
Người xác nhận:            Ngày:
```

---

## Thứ tự bắt buộc

- D-04 xanh lại CI của repo chuẩn - việc rẻ nhất, làm được ngay
- D-02 phải xong TRƯỚC khi dọn 20 file at-risk ở Hub, nếu không sync đầu tiên xoá mất 45 dòng riêng của satellite
- D-01 phải xong TRƯỚC lần sync đầu tiên, nếu không qa-trace.js tự xuống cả hai satellite
- D-06 phải xong TRƯỚC khi viết script @REQ-001 đầu tiên, nếu không gate đỏ ngay khi làm xong
- D-05 và D-07 phải xong TRƯỚC khi viết TC-001..TC-006

