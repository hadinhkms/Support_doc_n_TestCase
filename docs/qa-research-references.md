# Kho Lưu Trữ Tham Khảo Nghiên Cứu Kỹ Năng & Kiến Trúc Kiểm Thử (QA Research References)

Tài liệu này lưu trữ danh mục các repository GitHub public trọng tâm về **Agentic QA Skills**, **AI Web/Visual Testing**, **DOM & Accessibility Testing**, và **Kiến trúc Kiểm thử Hệ thống (System Testing & Architecture)**. Đây là nguồn chuẩn để tra cứu, đối chiếu, trích xuất mẫu (patterns) và nghiên cứu chuyên sâu khi người dùng yêu cầu AI Agent nghiên cứu (research) các thông tin, kỹ năng hoặc công cụ liên quan đến QA/Automation.

---

## 1. Nhóm Repo SKILL.md & MCP (Dạy AI Agent kỹ năng Testing)

Dành cho việc xây dựng Agentic Workflow (với Antigravity, Claude Code, Cursor, Copilot...) và nạp "kỹ năng" kiểm thử chuẩn chỉnh để AI viết test chuyên nghiệp, không tạo selector dễ gãy (brittle selectors) và tương tác với browser qua giao thức MCP:

### 1.1. [`testdino-hq/playwright-skill`](https://github.com/testdino-hq/playwright-skill)
- **URL**: https://github.com/testdino-hq/playwright-skill
- **Trọng tâm**: Bộ sưu tập hơn 70+ hướng dẫn thực chiến được đóng gói chuẩn cấu trúc `SKILL.md`.
- **Năng lực cốt lõi**:
  - Dạy AI Agent và QA engineer các quy tắc vàng khi viết Playwright: chọn locator bền vững (`getByRole`, `getByLabel`), chống flaky test.
  - Hướng dẫn kiểm thử visual regression, accessibility, xử lý iframe/shadow DOM.
  - Quy trình chuyển đổi test case manual sang automation script chuẩn chỉ.

### 1.2. [`microsoft/playwright-cli`](https://github.com/microsoft/playwright-cli)
- **URL Repo**: https://github.com/microsoft/playwright-cli
- **URL Thư mục Skill**: [`skills/playwright-cli/SKILL.md`](https://github.com/microsoft/playwright-cli/blob/main/skills/playwright-cli/SKILL.md)
- **Trọng tâm**: Bộ skill chính chủ từ đội ngũ Microsoft Playwright giúp AI Agent điều khiển trình duyệt qua CLI.
- **Năng lực cốt lõi**:
  - Tự động chụp snapshot cây DOM và Accessibility tree dạng text nhỏ gọn cho LLM.
  - Khám phá trang web tự động (exploration), ghi nhận tương tác người dùng.
  - Tự động sinh test script (test generation) và tự sửa lỗi test khi selector/UI thay đổi (self-healing).

### 1.3. [`microsoft/playwright-mcp`](https://github.com/microsoft/playwright-mcp)
- **URL**: https://github.com/microsoft/playwright-mcp
- **Trọng tâm**: Model Context Protocol (MCP) server chính thức của Playwright.
- **Năng lực cốt lõi**:
  - Cho phép AI Agent mở trực tiếp trình duyệt và tương tác theo thời gian thực (real-time browsing).
  - Trực quan hóa giao diện, phát hiện các phần tử bị che khuất (occluded elements), sai lệch z-index.
  - Chạy các lệnh click, fill, scroll và thu thập phản hồi mạng trực tiếp trong vòng lặp agentic loop.

### 1.4. [`lambdatest/agent-skills`](https://github.com/lambdatest/agent-skills)
- **URL Repo**: https://github.com/lambdatest/agent-skills
- **URL Thư mục Skill**: [`playwright-skill/SKILL.md`](https://github.com/lambdatest/agent-skills/blob/main/playwright-skill/SKILL.md)
- **Trọng tâm**: Cung cấp bộ khung quyết định (decision tree) cho AI trong thiết lập và vận hành test automation.
- **Năng lực cốt lõi**:
  - Tự động quyết định kiến trúc dự án test phù hợp (Page Object Model, test runner config).
  - Thiết lập kịch bản E2E đa trình duyệt (Chromium, Firefox, WebKit, Mobile Viewports).
  - Mock API responses và chiến lược xử lý visual regression trên hạ tầng cloud/song song.

### 1.5. [`testomatio/skills`](https://github.com/testomatio/skills)
- **URL**: https://github.com/testomatio/skills
- **Trọng tâm**: Bộ Agent Skills chuyên sâu cho quy trình QA và quản lý kiểm thử thực chiến từ bước BA đến QA.
- **Năng lực cốt lõi**:
  - `qa-requirement-reviewer` & `detect-product-mismatches`: Đối chiếu code, tài liệu requirement và issue để tìm điểm mâu thuẫn hoặc logic chưa được định nghĩa.
  - `qa-thinking` & `qa-split-testing-levels-pyramid`: Phân tích edge cases, negative flows, và phân bổ kịch bản test theo mô hình Test Pyramid (Unit, Integration, E2E).
  - `qa-lead-strategy-advisor`: Đánh giá độ trưởng thành của quy trình QA trong dự án và lên roadmap kiểm thử.

### 1.6. [`FlorianBruniaux/claude-code-ultimate-guide`](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)
- **URL Repo**: https://github.com/FlorianBruniaux/claude-code-ultimate-guide
- **URL Thư mục QA Skills (`examples/skills/qa`)**: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/tree/main/examples/skills/qa
- **Trọng tâm**: Chuẩn hóa `SKILL.md` theo chế độ **Diff-aware** (`git diff`) kết hợp vòng lặp **Fix-and-verify loop**.
- **Năng lực cốt lõi**:
  - Tự động nhận diện phạm vi ảnh hưởng từ diff mã nguồn để xác định route/API cần test.
  - Phân loại mức độ ưu tiên (`Quick`, `Standard`, `Exhaustive`).
  - Vòng lặp tự động sửa lỗi và xác minh lại qua Playwright/MCP browser tools.

### 1.7. [`tugkanboz/awesome-ai-testing`](https://github.com/tugkanboz/awesome-ai-testing)
- **URL**: https://github.com/tugkanboz/awesome-ai-testing
- **Trọng tâm**: Danh mục tổng hợp các công cụ và framework kiểm thử thế hệ mới ứng dụng AI/LLM.
- **Năng lực cốt lõi**:
  - Tự động sinh test data theo schema (Snowfakery, Synthesized).
  - Tạo API test & mock từ real traffic (Keploy).
  - Self-healing automation và kiểm thử hệ thống dựa trên giao thức MCP.

---

## 2. Nhóm Repo AI Visual & Agentic Web Testing (Kiểm thử Thị giác & Ngữ cảnh)

Các thư viện mã nguồn mở giải quyết bài toán AI nhìn nhận giao diện như mắt người (bắt lỗi đè chữ, lệch khung, kiểm tra trạng thái hiển thị tự nhiên) kết hợp trực tiếp trong luồng code Playwright:

### 2.1. [`web-infra-dev/midscene`](https://github.com/web-infra-dev/midscene) (Midscene.js)
- **URL**: https://github.com/web-infra-dev/midscene
- **Trọng tâm**: GUI Agent mã nguồn mở dùng Multimodal LLM (hỗ trợ Gemini Flash, GPT-4o, Qwen-VL, UI-TARS) để nhìn ảnh chụp màn hình và kiểm thử.
- **Năng lực cốt lõi**:
  - Nhúng trực tiếp vào Playwright qua plugin hoặc SDK.
  - Cung cấp hàm `aiAssert("Thông báo lỗi hiển thị rõ ràng bên dưới ô email và không bị đè chữ")` để thẩm định giao diện trực quan mà không cần selector phức tạp.
  - Hỗ trợ `aiAction` và `aiQuery` để tự động hóa thao tác phức tạp trên canvas hoặc giao diện không có accessibility tree rõ ràng.

### 2.2. [`browserbase/stagehand`](https://github.com/browserbase/stagehand)
- **URL**: https://github.com/browserbase/stagehand
- **Trọng tâm**: SDK kết hợp giữa code Playwright truyền thống và AI linh hoạt.
- **Năng lực cốt lõi**:
  - Giữ các bước cố định bằng code Playwright tiêu chuẩn để đảm bảo tốc độ và tính tất định.
  - Với vùng giao diện động, phức tạp hoặc hay thay đổi, cung cấp 3 hàm AI nguyên bản:
    - `act()`: Thực hiện hành vi dựa trên ngôn ngữ tự nhiên.
    - `extract()`: Trích xuất dữ liệu có cấu trúc từ trang web theo schema.
    - `observe()`: Quan sát và lập kế hoạch các hành động khả thi trên màn hình hiện tại.

### 2.3. [`zerostep-ai/zerostep`](https://github.com/zerostep-ai/zerostep)
- **URL**: https://github.com/zerostep-ai/zerostep
- **Trọng tâm**: Tích hợp hàm `ai()` trực tiếp vào Playwright test script.
- **Năng lực cốt lõi**:
  - Viết các bước kiểm thử và xác nhận trạng thái hiển thị bằng ngôn ngữ tự nhiên: `await ai('Click the checkout button', { page, test })`.
  - Phù hợp khi cần kiểm tra nhanh các luồng UI động, trang dynamic canvas hoặc luồng nghiệp vụ thay đổi liên tục trước khi ổn định bộ selector truyền thống.

---

## 3. Nhóm Repo Kiểm thử DOM, Accessibility & Visual Regression (Code Test)

Dành cho việc bắt các lỗi kỹ thuật nền tảng: độ tương phản màu kém, thiếu nhãn ngữ nghĩa (aria-label), lỗi DOM tree, hoặc lệch pixel giao diện bằng code kiểm thử tự động:

### 3.1. [`dequelabs/axe-core-npm`](https://github.com/dequelabs/axe-core-npm) (đặc biệt gói `@axe-core/playwright`)
- **URL**: https://github.com/dequelabs/axe-core-npm
- **Trọng tâm**: Tiêu chuẩn vàng trong kiểm thử tự động Accessibility (WCAG 2.0 / 2.1 / 2.2).
- **Năng lực cốt lõi**:
  - Quét toàn bộ cây DOM trong vài mili-giây qua `AxeBuilder`.
  - Bắt lỗi chữ trùng màu nền (low contrast ratio), thiếu thuộc tính accessibility (`aria-*`, `alt`), thẻ HTML sai ngữ nghĩa.
  - Phát hiện các phần tử tương tác bị ẩn hoặc khóa sai quy cách gây cản trở screen readers và bàn phím.

### 3.2. [`lost-pixel/lost-pixel`](https://github.com/lost-pixel/lost-pixel)
- **URL**: https://github.com/lost-pixel/lost-pixel
- **Trọng tâm**: Công cụ Visual Regression Testing mã nguồn mở (giải pháp thay thế miễn phí cho Percy / Chromatic).
- **Năng lực cốt lõi**:
  - Tự động chụp và so sánh ảnh giao diện từ Playwright, Storybook, Ladle hoặc trang web thật.
  - Phát hiện sai lệch bố cục (pixel diff), vỡ layout sau các bản cập nhật CSS/design system.
  - Tích hợp mượt mà vào luồng GitHub Actions CI/CD với chi phí tự lưu trữ (self-hosted).

### 3.3. [`microsoft/playwright`](https://github.com/microsoft/playwright) (thư mục `examples/`) & [`DevExpress/testcafe`](https://github.com/DevExpress/testcafe)
- **URL Playwright Repo**: https://github.com/microsoft/playwright
- **URL Playwright Examples**: https://github.com/microsoft/playwright/tree/main/examples
- **URL TestCafe**: https://github.com/DevExpress/testcafe
- **Trọng tâm**: Kho mẫu kiểm thử chuyên sâu chính thức về các kịch bản trình duyệt phức tạp.
- **Năng lực cốt lõi**:
  - Mẫu giả lập trạng thái mạng (offline, 3G throttling, route aborting, mock REST/GraphQL).
  - Giả lập thiết bị di động (mobile emulation, geolocation, permissions, color scheme).
  - Kiểm tra kích thước khung nhìn (viewport testing), chụp ảnh so sánh tự nhiên với `expect(page).toHaveScreenshot()`.

---

## 4. Nhóm Repo "Bách khoa toàn thư" (Tư duy, Checklist & Best Practices)

Tài liệu toàn diện để xây dựng quy chuẩn kiểm thử (SOP), checklist kiểm thử UI/UX, thiết kế mẫu mã (Test Patterns) hoặc đào tạo đội ngũ QA/Automation:

### 4.1. [`goldbergyoni/javascript-testing-best-practices`](https://github.com/goldbergyoni/javascript-testing-best-practices)
- **URL**: https://github.com/goldbergyoni/javascript-testing-best-practices
- **Trọng tâm**: Kho tàng toàn diện nhất (hơn 24.000+ stars) về tư duy kiểm thử hiện đại trên nền tảng JavaScript/TypeScript & Web.
- **Năng lực cốt lõi**:
  - Phân tích kiến trúc bài test sạch (Golden Rules of Testing, AAA pattern, Test Anatomy).
  - Chiến lược kiểm thử UI component, Integration và E2E testing.
  - Tối ưu hóa CI/CD để chống flaky tests và giảm thiểu cảnh báo giả (zero false alarms).

### 4.2. [`TheJambo/awesome-testing`](https://github.com/TheJambo/awesome-testing) & [`ZoranPandovski/awesome-testing-tools`](https://github.com/ZoranPandovski/awesome-testing-tools)
- **URL Awesome Testing**: https://github.com/TheJambo/awesome-testing
- **URL Awesome Testing Tools**: https://github.com/ZoranPandovski/awesome-testing-tools
- **Trọng tâm**: Hai danh mục bách khoa toàn thư tổng hợp đầy đủ công cụ, thư viện, sách và tài liệu chuẩn mực về kiểm thử phần mềm.
- **Năng lực cốt lõi**:
  - Bao phủ toàn diện: Functional, Visual UI, Usability, Accessibility, Security (OWASP), Performance & Load Testing.
  - Phân loại công cụ chi tiết theo ngôn ngữ, nền tảng và phương pháp luận kiểm thử.

### 4.3. [`atinfo/awesome-test-automation`](https://github.com/atinfo/awesome-test-automation)
- **URL**: https://github.com/atinfo/awesome-test-automation
- **Trọng tâm**: Danh mục chuyên sâu về các mẫu thiết kế kiến trúc tự động hóa (Test Design Patterns) và framework cho Web.
- **Năng lực cốt lõi**:
  - Các mẫu thiết kế kinh điển: Page Object Model (POM), Screenplay Pattern, Fluent Interface, Appium/Playwright abstractions.
  - So sánh các bộ khung tự động hóa kiểm thử theo từng hệ sinh thái ngôn ngữ (Node.js/TypeScript, Python, Java, C#).

---

## 5. Nhóm Repo Chiến Lược & Kiến Trúc Kiểm Thử Hệ Thống (System Testing, Chaos & SRE)

Dành cho việc tham khảo kiến trúc kiểm thử toàn diện của các tập đoàn công nghệ lớn (Distributed Systems, Microservices, Resilience, Chaos Engineering):

### 5.1. [`abhivaikar/howtheytest`](https://github.com/abhivaikar/howtheytest)
- **URL**: https://github.com/abhivaikar/howtheytest
- **Trọng tâm**: Tổng hợp hơn 800 tài liệu và case study từ Netflix, Uber, Slack, Atlassian, GitLab...
- **Năng lực cốt lõi**: Vận hành E2E testing quy mô lớn, Contract testing cho Microservices, Load testing, và kiểm thử trên môi trường Production (Observability, Chaos Engineering).

### 5.2. [`kamranahmedse/developer-roadmap`](https://github.com/kamranahmedse/developer-roadmap) (Nhánh `/qa`)
- **URL Repo**: https://github.com/kamranahmedse/developer-roadmap
- **URL QA Roadmap**: https://roadmap.sh/qa
- **Trọng tâm**: Bản đồ toàn cảnh kỹ năng của kỹ sư QA hiện đại từ nền tảng thiết kế test case (Black-box, White-box) đến CI/CD, Security và Performance testing.

### 5.3. [`dastergon/awesome-sre`](https://github.com/dastergon/awesome-sre) & [`dastergon/awesome-chaos-engineering`](https://github.com/dastergon/awesome-chaos-engineering)
- **URL Awesome SRE**: https://github.com/dastergon/awesome-sre
- **URL Awesome Chaos Engineering**: https://github.com/dastergon/awesome-chaos-engineering
- **Trọng tâm**: Kiểm thử độ tin cậy toàn hệ thống (System Reliability), giả lập sự cố sập dịch vụ, nghẽn mạng, lỗi DB để đánh giá khả năng tự phục hồi (Resilience & Fault Tolerance).

---

## 6. Gợi Ý Chọn Nhanh Theo Mục Đích Nghiên Cứu (Quick Recommendation Guide)

Khi người dùng đưa ra một yêu cầu cụ thể, ưu tiên tra cứu và đề xuất theo ma trận sau:

1. **Nạp kỹ năng cho AI Agent viết/sửa code test Playwright chuẩn chỉ:**
   👉 Kéo ngay `testdino-hq/playwright-skill` và `microsoft/playwright-cli` (`skills/playwright-cli/SKILL.md`).
2. **Cho AI tương tác trực tiếp, quan sát DOM và duyệt web thời gian thực:**
   👉 Tích hợp `microsoft/playwright-mcp`.
3. **Dùng AI thị giác (Visual LLM) bắt lỗi giao diện (đè chữ, lệch khung, sai trạng thái):**
   👉 Nhúng `web-infra-dev/midscene` (dùng `aiAssert`) vào bộ Playwright sẵn có.
4. **Viết test thích ứng linh hoạt với vùng giao diện động hay thay đổi:**
   👉 Dùng `browserbase/stagehand` (`act`, `extract`, `observe`) hoặc `zerostep-ai/zerostep` (`ai()`).
5. **Kiểm thử Accessibility (A11y) & Chuẩn hóa ngữ nghĩa HTML/DOM:**
   👉 Tích hợp `dequelabs/axe-core-npm` (`@axe-core/playwright`).
6. **Kiểm thử Visual Regression mã nguồn mở (so sánh ảnh layout diff):**
   👉 Dùng `lost-pixel/lost-pixel` kết hợp `toHaveScreenshot()` của Playwright.
7. **Xây dựng tiêu chuẩn, SOP và checklist kiểm thử cho dự án:**
   👉 Tham khảo `goldbergyoni/javascript-testing-best-practices` kết hợp với `@axe-core/playwright`.
8. **Thiết kế kiến trúc code automation (POM, Screenplay Pattern):**
   👉 Tham khảo `atinfo/awesome-test-automation`.
9. **Thiết kế kiến trúc kiểm thử toàn hệ thống & Chaos/Reliability:**
   👉 Tra cứu `abhivaikar/howtheytest`, `dastergon/awesome-sre`, và `dastergon/awesome-chaos-engineering`.

---

## 7. Bảng Tra Cứu Nhanh Chi Tiết (Comprehensive Quick Lookup Table)

| Tên Repository | Link GitHub | Nhóm Phân Loại | Phù hợp nhất khi muốn research... |
|---|---|---|---|
| `testdino-hq/playwright-skill` | https://github.com/testdino-hq/playwright-skill | 1. SKILL.md & MCP | 70+ quy tắc vàng Playwright: locator bền vững, chống flaky, visual & a11y rules cho AI. |
| `microsoft/playwright-cli` | https://github.com/microsoft/playwright-cli | 1. SKILL.md & MCP | Skill chính chủ Microsoft: điều khiển browser qua CLI, DOM snapshots, self-healing test. |
| `microsoft/playwright-mcp` | https://github.com/microsoft/playwright-mcp | 1. SKILL.md & MCP | Giao thức MCP mở browser cho AI: nhìn giao diện, phát hiện phần tử bị che, tương tác real-time. |
| `lambdatest/agent-skills` | https://github.com/lambdatest/agent-skills | 1. SKILL.md & MCP | Cây quyết định (decision tree) cho AI: setup kiến trúc test, cross-browser, mock API. |
| `testomatio/skills` | https://github.com/testomatio/skills | 1. SKILL.md & MCP | Kỹ năng AI review requirement, phát hiện logic mismatch, phân bổ Test Pyramid. |
| `FlorianBruniaux/claude-code-ultimate-guide` | https://github.com/FlorianBruniaux/claude-code-ultimate-guide | 1. SKILL.md & MCP | Kỹ năng Diff-aware QA (`git diff`), chia mode Quick/Standard/Exhaustive, Fix-and-verify loop. |
| `tugkanboz/awesome-ai-testing` | https://github.com/tugkanboz/awesome-ai-testing | 1. SKILL.md & MCP | Danh mục công cụ AI testing, sinh test data thông minh, mock traffic, self-healing. |
| `web-infra-dev/midscene` | https://github.com/web-infra-dev/midscene | 2. AI Visual & Agentic | Multimodal GUI Agent kiểm thử bằng mắt người: dùng `aiAssert` bắt lỗi đè chữ, vỡ layout. |
| `browserbase/stagehand` | https://github.com/browserbase/stagehand | 2. AI Visual & Agentic | SDK kết hợp Playwright code với AI qua bộ ba hàm `act()`, `extract()`, `observe()`. |
| `zerostep-ai/zerostep` | https://github.com/zerostep-ai/zerostep | 2. AI Visual & Agentic | Nhúng hàm `ai()` viết kịch bản test và assert trực quan bằng ngôn ngữ tự nhiên. |
| `dequelabs/axe-core-npm` | https://github.com/dequelabs/axe-core-npm | 3. DOM & A11y & Visual | Chuẩn kiểm thử Accessibility tự động (`@axe-core/playwright`), bắt lỗi tương phản, aria. |
| `lost-pixel/lost-pixel` | https://github.com/lost-pixel/lost-pixel | 3. DOM & A11y & Visual | Visual Regression Testing open-source cho Playwright & Storybook (thay thế Percy). |
| `microsoft/playwright` (`examples/`) | https://github.com/microsoft/playwright | 3. DOM & A11y & Visual | Mẫu kiểm thử nâng cao: network conditions, mobile emulation, toHaveScreenshot. |
| `DevExpress/testcafe` | https://github.com/DevExpress/testcafe | 3. DOM & A11y & Visual | Tham khảo cơ chế auto-waiting, xử lý đa cửa sổ và kiểm thử trình duyệt thực tế. |
| `goldbergyoni/javascript-testing-best-practices` | https://github.com/goldbergyoni/javascript-testing-best-practices | 4. Bách khoa & Best Practices | Kho tàng 24k+ stars: chuẩn mực cấu trúc test JS/TS, UI component, E2E, CI/CD chống false alarms. |
| `TheJambo/awesome-testing` | https://github.com/TheJambo/awesome-testing | 4. Bách khoa & Best Practices | Thư viện toàn diện: Functional, Usability, Security, Performance, Load testing. |
| `ZoranPandovski/awesome-testing-tools` | https://github.com/ZoranPandovski/awesome-testing-tools | 4. Bách khoa & Best Practices | Danh bạ công cụ test automation, performance, API và test management. |
| `atinfo/awesome-test-automation` | https://github.com/atinfo/awesome-test-automation | 4. Bách khoa & Best Practices | Chuyên sâu về design patterns (POM, Screenplay) và framework kiểm thử cho Web. |
| `abhivaikar/howtheytest` | https://github.com/abhivaikar/howtheytest | 5. System Testing & Chaos | Case studies thực tế từ Big Tech: Netflix, Uber, Slack về E2E, Contract & Chaos testing. |
| `kamranahmedse/developer-roadmap` | https://roadmap.sh/qa | 5. System Testing & Chaos | Bản đồ kỹ năng QA chuẩn hóa: Black-box/White-box, CI/CD, Security, Performance. |
| `dastergon/awesome-sre` | https://github.com/dastergon/awesome-sre | 5. System Testing & Chaos | Nghiên cứu tiêu chuẩn độ tin cậy, observability và vận hành hệ thống phân tán. |
| `dastergon/awesome-chaos-engineering` | https://github.com/dastergon/awesome-chaos-engineering | 5. System Testing & Chaos | Thiết kế kịch bản giả lập lỗi mạng, sập dịch vụ, fault injection và self-recovery. |
