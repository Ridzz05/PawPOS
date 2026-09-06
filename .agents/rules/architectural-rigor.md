# Architectural Rigor & Zero-Hack Rule

Whenever generating, refactoring, or reviewing code in this workspace:

1. **Activate Standard**: Adhere strictly to `.agents/skills/architectural-rigor-and-zero-hacks/SKILL.md`.
2. **Zero-Hack Policy**:
   - Never inject hidden elements, dummy strings, or monkey-patches into production code to pass a test.
   - If a test fails, investigate whether the test matcher is outdated or if the component contract is flawed. Fix the root cause.
3. **Enterprise UI Quality**:
   - Zero glow, zero heavy shadows, zero clumsy background patches on dark mode.
   - Follow flat minimalist tokens (1px borders, high-contrast typography, native surfaces).
4. **Deep Reasoning Over Speed**:
   - Prioritize maintainability, system resilience, and clean types over hasty execution.
   - Never bypass TypeScript or invent loose production fallbacks.
