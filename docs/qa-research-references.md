# Kho Lưu Trữ Tham Khảo Nghiên Cứu Kỹ Năng & Kiến Trúc Kiểm Thử (QA Research References)

Tài liệu này lưu trữ danh mục các repository GitHub public trọng tâm về **Agentic QA Skills** và **System Testing & Architecture** để tra cứu, đối chiếu và nghiên cứu nhanh khi nâng cấp bộ quy chuẩn QA hoặc AI Skills của workspace.

---

## 1. Nhóm Repo "Skills" cho AI Coding & QA Agents (Agentic QA Skills)

Dành cho việc nghiên cứu mẫu `SKILL.md`, prompt, hoặc workflow giúp AI Agent đóng vai trò Senior QA (phân tích requirement, thiết kế test case, kiểm thử toàn hệ thống):

### 1.1. [`testomatio/skills`](https://github.com/testomatio/skills)
- **URL**: https://github.com/testomatio/skills
- **Trọng tâm**: Bộ Agent Skills chuyên sâu cho quy trình QA và quản lý kiểm thử thực chiến từ bước BA đến QA.
- **Các kỹ năng tiêu biểu cần tham khảo**:
  - `qa-requirement-reviewer` & `detect-product-mismatches`: Đối chiếu code, tài liệu requirement và issue để tìm điểm mâu thuẫn hoặc logic chưa được định nghĩa.
  - `qa-thinking` & `qa-split-testing-levels-pyramid`: Phân tích edge cases, negative flows, và phân bổ kịch bản test theo mô hình Test Pyramid (Unit, Integration, E2E).
  - `qa-lead-strategy-advisor`: Đánh giá độ trưởng thành của quy trình QA trong dự án và lên roadmap kiểm thử.

### 1.2. [`FlorianBruniaux/claude-code-ultimate-guide`](https://github.com/FlorianBruniaux/claude-code-ultimate-guide)
- **URL Repo**: https://github.com/FlorianBruniaux/claude-code-ultimate-guide
- **URL Thư mục QA Skills (`examples/skills/qa`)**: https://github.com/FlorianBruniaux/claude-code-ultimate-guide/tree/main/examples/skills/qa
- **Trọng tâm**:
  - Chuẩn hóa `SKILL.md` theo chế độ **Diff-aware** (tự động nhận diện phạm vi ảnh hưởng từ `git diff` để xác định route/API cần test).
  - Phân loại mức độ ưu tiên (`Quick`, `Standard`, `Exhaustive`).
  - Quy trình **Fix-and-verify loop** kết hợp với Playwright hoặc MCP browser tools.

### 1.3. [`tugkanboz/awesome-ai-testing`](https://github.com/tugkanboz/awesome-ai-testing)
- **URL**: https://github.com/tugkanboz/awesome-ai-testing
- **Trọng tâm**: Danh sách tổng hợp các công cụ và framework kiểm thử thế hệ mới ứng dụng AI/LLM:
  - Tự động sinh test data theo schema (Snowfakery, Synthesized).
  - Tạo API test & mock từ real traffic (Keploy).
  - Self-healing automation và kiểm thử hệ thống dựa trên giao thức MCP.

---

## 2. Nhóm Repo về Chiến Lược & Kỹ Năng Kiểm Thử Hệ Thống (System Testing & Architecture)

Dành cho việc tham khảo kiến trúc kiểm thử toàn diện của các tập đoàn công nghệ lớn (Functional, Non-functional, Chaos Engineering, Testing in Production):

### 2.1. [`abhivaikar/howtheytest`](https://github.com/abhivaikar/howtheytest)
- **URL**: https://github.com/abhivaikar/howtheytest
- **Trọng tâm**: Tổng hợp hơn 800 tài liệu và case study từ Netflix, Uber, Slack, Atlassian, GitLab... về cách vận hành E2E testing, Contract testing cho Microservices, Load testing, và kiểm thử trên môi trường Production (Observability, Chaos Engineering).

### 2.2. [`TheJambo/awesome-testing`](https://github.com/TheJambo/awesome-testing)
- **URL**: https://github.com/TheJambo/awesome-testing
- **Trọng tâm**: Kho tài nguyên toàn diện bao phủ mọi ngóc ngách của kiểm thử phần mềm (từ API contract testing, gRPC coverage, webhook debugging cho đến tài liệu thiết kế hệ thống chịu lỗi).

### 2.3. [`kamranahmedse/developer-roadmap`](https://github.com/kamranahmedse/developer-roadmap) (Nhánh `/qa`)
- **URL Repo**: https://github.com/kamranahmedse/developer-roadmap
- **URL QA Roadmap**: https://roadmap.sh/qa
- **Trọng tâm**: Bản đồ toàn cảnh các kỹ năng của kỹ sư QA hiện đại, từ nền tảng thiết kế test case (Black-box, White-box), kiểm thử hệ thống, tích hợp CI/CD, đến Security và Performance testing.

### 2.4. [`dastergon/awesome-sre`](https://github.com/dastergon/awesome-sre) & [`dastergon/awesome-chaos-engineering`](https://github.com/dastergon/awesome-chaos-engineering)
- **URL Awesome SRE**: https://github.com/dastergon/awesome-sre
- **URL Awesome Chaos Engineering**: https://github.com/dastergon/awesome-chaos-engineering
- **Trọng tâm**: Kiểm thử độ tin cậy toàn hệ thống (System Reliability), giả lập sự cố sập dịch vụ, nghẽn mạng hoặc lỗi database để đánh giá khả năng phản ứng và tự phục hồi (Resilience & Fault Tolerance).

---

## 3. Bảng Tra Cứu Nhanh Theo Mục Đích Nghiên Cứu

| Tên Repository | Link GitHub | Trọng tâm chính | Phù hợp nhất khi muốn research... |
|---|---|---|---|
| `testomatio/skills` | https://github.com/testomatio/skills | AI Agent QA Workflows | Tích hợp kỹ năng review requirement, sinh test case và rà soát độ phủ vào AI Agent. |
| `FlorianBruniaux/claude-code-ultimate-guide` | https://github.com/FlorianBruniaux/claude-code-ultimate-guide/tree/main/examples/skills/qa | Diff-aware QA Skill & Fix-Verify Loop | Thiết kế quy trình kiểm thử theo `git diff`, chia mode `Quick`/`Standard`/`Exhaustive` kết hợp Playwright/MCP. |
| `tugkanboz/awesome-ai-testing` | https://github.com/tugkanboz/awesome-ai-testing | AI Testing Tools & MCP | Tìm công cụ tự động hóa kiểm thử, tạo mock/seed data thông minh và self-healing. |
| `abhivaikar/howtheytest` | https://github.com/abhivaikar/howtheytest | Kiến trúc & Văn hóa QA thực chiến | Học hỏi chiến lược System Testing, Microservices & E2E từ các công ty Big Tech. |
| `TheJambo/awesome-testing` | https://github.com/TheJambo/awesome-testing | Công cụ & Thư viện Testing | Tra cứu nhanh các tool phục vụ API, Load, Security và UI Automation. |
| `kamranahmedse/developer-roadmap` | https://github.com/kamranahmedse/developer-roadmap (`https://roadmap.sh/qa`) | Bản đồ kỹ năng QA toàn diện | Rà soát danh mục kỹ năng Black-box/White-box, System, CI/CD, Security, Performance. |
| `dastergon/awesome-sre` | https://github.com/dastergon/awesome-sre | Site Reliability Engineering | Nghiên cứu tiêu chuẩn độ tin cậy, observability và vận hành hệ thống lớn. |
| `dastergon/awesome-chaos-engineering` | https://github.com/dastergon/awesome-chaos-engineering | Chaos Engineering & Fault Injection | Thiết kế kịch bản giả lập lỗi mạng, sập dịch vụ, lỗi DB và kiểm chứng khả năng tự phục hồi. |
