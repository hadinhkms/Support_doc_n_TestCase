# QA Hub Research & Improvement Roadmap

## Mục tiêu

Phát triển repository này như nguồn chuẩn dùng chung cho QA skills, quy trình và
tooling của nhiều repo sản phẩm. Không xem requirements, test cases hoặc app fixture
trong Hub là backlog hay thước đo coverage của các sản phẩm nhận.

## Phạm vi research

Đối chiếu repository hiện tại với:

- [Agent Skills Specification](https://agentskills.io/specification)
- [Vercel Skills CLI](https://github.com/vercel-labs/skills) và
  [agent compatibility matrix](https://github.com/vercel-labs/skills/blob/main/docs/agents.md)
- [Testomatio AI Skills](https://github.com/testomatio/skills), tập trung vào
  canonical skill source, plugin wrappers và workflow lifecycle
- [Microsoft Playwright CLI skill](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md)
  và [Playwright best practices](https://playwright.dev/docs/best-practices)
- Capability baseline hiện có tại
  [docs/testing-capability-inventory.md](../docs/testing-capability-inventory.md)

Research được thực hiện ngày 2026-11-06. Repo tham khảo là nguồn pattern, không phải
tiêu chuẩn cần sao chép nguyên trạng.

## Kết quả đối chiếu

### Điểm mạnh hiện có

- Có 7 skill QA theo chuẩn thư mục `.agents/skills/<name>/SKILL.md`; đây cũng là
  đường dẫn được Vercel Skills CLI liệt kê cho GitHub Copilot, Gemini CLI, Codex,
  Cursor và một số agent khác.
- Skills đã chia theo nhiệm vụ chuyên biệt; `qa-system-testing` điều phối sang các
  skill chuyên sâu thay vì gom mọi hướng dẫn vào một file duy nhất.
- Có tooling nội bộ cho traceability, drift, gaps, boundaries và code limits.
- Capability inventory đã phân biệt năng lực hiện có với năng lực đề xuất; visual
  regression và performance/workload không bị tuyên bố là đã triển khai.

### Khoảng trống có bằng chứng

1. **Onboarding và provenance của repo nhận chưa thành một quy trình dễ làm theo.**
   `AGENTS.md` nói skills được lấy từ bản đã commit/push trên `origin/main`, trong khi
   peers như Testomatio có lệnh cài/cập nhật rõ ràng. Cần chọn và tài liệu hóa một
   đường phát hành chuẩn; không nên để mỗi repo tự đoán cách copy/pin/update.
2. **Không có gate riêng kiểm tra chất lượng toàn bộ skills.** `npm run qa:check`
   kiểm tra boundary, traceability và limits của automation; chưa kiểm tra skill
   frontmatter, tham chiếu hỏng, lệnh không tồn tại hay portability của hướng dẫn.
   Agent Skills Specification và `skills-ref validate` cung cấp baseline có thể dùng
   làm mẫu cho gate này.
3. **`seed` trong manifest chưa khớp hành vi sync được tài liệu hóa.**
   [docs/hub-and-project-boundary.md](../docs/hub-and-project-boundary.md) ghi rõ seed
   chưa có cơ chế copy-if-missing trong sync. Đây là rủi ro ghi đè hoặc thiếu asset cho
   repo nhận, cần xử lý ở cơ chế sync của Hub hoặc đổi semantics/documentation.
4. **Cần kiểm chứng skill ở consumer, không chỉ ở Hub.** Unit tests và QA gates chạy
   tại Hub chưa chứng minh repo khác nhận đúng nội dung, links, helper/tool prerequisites
   và có thể chạy quy trình với layout riêng.
5. **Năng lực mở rộng đã được ghi nhận nhưng chưa có tiêu chí rollout.**
   Capability inventory đánh dấu visual regression là Proposed, performance/workload
   là Proposed và consumer-driven contract là Partial. Nên ưu tiên theo nhu cầu nhiều
   repo và có adapter tùy chọn; không mặc định thêm tool/chi phí vào mọi repo.

## Kế hoạch theo phase

### Phase 1 — Chuẩn hóa onboarding và nguồn phát hành

- [ ] Viết hướng dẫn cho repo nhận: cách lấy skills đã phát hành, chọn commit/tag,
  cập nhật, kiểm tra version/provenance và xử lý local overrides.
- [ ] Công bố ma trận agent được hỗ trợ, phân biệt:
  - skill format cơ bản dùng chung;
  - custom instructions/agent wrappers riêng theo nền tảng;
  - tính năng chưa được xác minh trên một agent.
- [ ] Quyết định giữ sync nội bộ làm đường chính, dùng `npx skills` làm phương án
  tùy chọn, hay phát hành qua cả hai. Đánh giá trên một repo consumer đại diện trước
  khi thay đổi cơ chế phân phối.
- [ ] Thêm smoke test ở repo consumer sạch để xác minh cài đặt/đồng bộ một skill,
  link tài nguyên và nguồn/version hiển thị đúng.

**Tiêu chí hoàn thành:** một người mới có thể làm theo một hướng dẫn duy nhất để lấy
đúng bản skill; có bằng chứng smoke test trong consumer; không vô tình lấy fixture
nghiệp vụ của Hub làm coverage sản phẩm.

### Phase 2 — Làm cho ranh giới `ship` / `seed` / `own` đúng với runtime

- [ ] Kiểm tra cơ chế sync thực tế tại Hub điều phối; không chỉ dựa vào manifest.
- [ ] Chọn một trong hai hướng cho `seed`: triển khai copy-if-missing có test, hoặc
  đổi tên/định nghĩa manifest và docs theo hành vi overwrite thực tế.
- [ ] Thêm test sync cho các điều kiện: `ship` cập nhật theo Hub; `seed` giữ bản project
  đã tùy chỉnh sau lần đầu; `own` không bị ghi đè.
- [ ] Chạy thử sync trên fixture consumer và xác nhận `npm run qa:boundary -- --strict`
  đạt sau sync.

**Tiêu chí hoàn thành:** semantics được kiểm thử tự động; project customization không
bị mất trong lần sync lặp lại.

### Phase 3 — Thêm QA gate cho skill catalog

- [ ] Tạo `skills:check` hoặc gate tương đương kiểm tra tên thư mục/frontmatter,
  giới hạn format theo Agent Skills Specification, các đường dẫn tương đối và file
  được tham chiếu có tồn tại.
- [ ] Phát hiện lệnh shell/npm và helper API được nêu trong skill nhưng không có ở
  repo sở hữu tương ứng; trường hợp là prerequisite bên ngoài phải khai rõ thay vì
  giả định có sẵn.
- [ ] Dùng `skills-ref validate` hoặc validator tương thích; pin version/tooling nếu
  được thêm làm dependency, hoặc giữ validator nội bộ zero-dependency.
- [ ] Chạy smoke test chọn lọc trên các agent mục tiêu (Copilot, Claude Code, Codex,
  Gemini CLI) cho discovery, không chỉ kiểm tra YAML tĩnh.
- [ ] Tích hợp gate vào CI khi script ổn định.

**Tiêu chí hoàn thành:** skill mới hoặc thay đổi có frontmatter sai, link hỏng, command
không hợp lệ hoặc mức tương thích chưa khai báo sẽ bị phát hiện trước khi phát hành.

### Phase 4 — Mở rộng coverage capability theo nhu cầu

- [ ] Phỏng vấn/thu thập nhu cầu từ các repo consumer, xếp ưu tiên theo tần suất,
  rủi ro sản phẩm, khả năng xác minh và chi phí duy trì.
- [ ] Đánh giá visual regression như năng lực opt-in: baseline governance, ổn định
  browser/OS/font, review pixel diff và cách chạy trong CI.
- [ ] Đánh giá performance/workload như adapter cho công cụ phù hợp với từng stack
  (ví dụ k6), với SLO do repo/service owner cung cấp; không suy ra ngưỡng chung.
- [ ] Đánh giá CDC/Pact hoặc contract broker chỉ khi consumer có producer-consumer
  thực tế và quyền sở hữu topology rõ.
- [ ] Giữ browser AI/visual agent ở chế độ exploratory/opt-in; test regression cốt lõi
  tiếp tục ưu tiên assertion xác định, độc lập và hướng người dùng.
- [ ] Rà lại tỷ lệ Test Pyramid 70/20/10 trong skill: coi là heuristic khởi đầu, không
  áp thành quota cứng nếu dữ liệu rủi ro/chi phí của repo không ủng hộ.

**Tiêu chí hoàn thành:** mỗi capability mới có owner, consumer pilot, cost/risk,
validation strategy và điều kiện bật/tắt; không thêm dependency bắt buộc khi chưa có
nhu cầu được xác nhận.

## Thứ tự ưu tiên đề xuất

1. Phase 1 — release/onboarding/provenance: giải quyết trực tiếp mục tiêu dùng chung.
2. Phase 2 — seed/ship correctness: bảo vệ thay đổi của repo nhận khỏi sync sai.
3. Phase 3 — kiểm chứng skill catalog trong CI: ngăn regression của Hub.
4. Phase 4 — capability extensions: chỉ triển khai theo bằng chứng từ consumer.

## Ngoài phạm vi của roadmap này

- Không mở rộng hoặc sửa REQ-001 sign-in như một yêu cầu sản phẩm của Hub.
- Không chuyển tất cả Playwright/MCP/AI visual tools thành dependency mặc định.
- Không tuyên bố tương thích đa agent chỉ từ việc frontmatter hợp lệ; cần kiểm tra trên
  từng agent được công bố hỗ trợ.
- Không sync hoặc sửa repo consumer khi chưa có yêu cầu và quyền truy cập phù hợp.
