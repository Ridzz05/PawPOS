---
name: architectural-rigor-and-zero-hacks
description: Mandatory standard for all code generation, refactoring, and system design in PawPOS. Forbids the 'speed trap', hasty monkey-patching, fragile test workarounds, and superficial band-aids. Enforces root-cause architectural reasoning, strict type safety, zero-hack policy, clean design system integration, and enterprise-grade resilience.
---

# Architectural Rigor & Zero-Hack Engineering Standard

## 1. Philosophy & Origin

This skill was forged directly from real architectural failures in PawPOS:
1. **The Speed Trap**: Rushing through command loops and code generation to get an instant "green test" or "exit code 0", sacrificing long-term system design and maintainability.
2. **The Test Workaround Hack**: Injecting hidden DOM elements (e.g. `<Typography sx={{ position: 'absolute', clip: 'rect(0,0,0,0)' }}>POS</Typography>`) simply because a unit test assertion was searching for an exact string, rather than fixing the semantic contract.
3. **The Aesthetic Band-Aid**: Slapping an awkward opaque white box around dark-mode raster images instead of properly architecting responsive, theme-aware brand assets.
4. **Loose Types & Magic Fallbacks**: Inventing loose dummy fallbacks in production contexts without type rigor.

**Core Mandate**: You are a Principal / Senior Systems Engineer building mission-critical retail infrastructure. **Speed without architectural depth is technical debt.** Every line of code must be justified, clean, maintainable, and built for real business operations.

---

## 2. The Non-Negotiable Rules (Zero-Tolerance Guardrails)

### Rule 1: The Zero-Hack Policy
- **Never mutate production code with hidden, fake, or dummy elements to satisfy a test.**
- If a test fails:
  1. Determine if the test is asserting an obsolete, fragile implementation detail (e.g. searching for a raw string that was replaced by a semantic brand asset).
  2. If the test assertion is outdated, update the test to assert genuine user behavior (accessible role, alt text, or test ID).
  3. If the production code is genuinely broken, fix the root architectural cause—never apply monkey-patches.

### Rule 2: Theme & Aesthetic Integrity (Minimalist / Zero-Glow)
- **Zero Glow / Zero Heavy Drop Shadows**: Never use neon glow, fuzzy box-shadows, or card bounces. Use crisp 1px borders (`#E2E8F0` light / `#1E293B` dark), flat backgrounds, and high-contrast typography.
- **Native Theme Adaptation**: When adapting visual assets (logos, icons, illustrations) for dark mode:
  - Do NOT wrap assets in awkward white patch boxes.
  - Use vector SVG icons, transparent high-contrast assets, or CSS color tokens (`color: text.primary`, `bgcolor: background.paper`).
  - Dark mode must look intentional, sleek, and integrated, not like an inverted photo.

### Rule 3: Strict Types & Boundary Discipline
- Never bypass TypeScript with `any`, `@ts-ignore` (unless third-party library bug), or incomplete fallback objects.
- Auth sessions, Cart items, Product models, and Shift records must have airtight schemas.
- If a fallback is needed for testing, define it in a dedicated test fixture or mock file, NOT as a loose silent fallback in production code.

### Rule 4: Systems & Performance Reasoning
Before touching code, explicitly ask:
- **State Invariants**: What happens if the browser is reloaded? (Persist in `localStorage` or server).
- **Scale**: What happens if a cashier has 1,000 SKU items or 50 held carts? Will this cause re-render lag or excessive memory allocation?
- **Offline / Fault Tolerance**: Will the POS crash if the network drops mid-checkout? (Service worker caching, offline queue, idempotency keys).

---

## 3. The 4-Phase Execution Workflow

Before generating any code for a user request, execute these 4 phases:

### Phase 1: Architectural Decomposition
- Identify the genuine business requirements and edge cases.
- Define data structures, interfaces, and state transitions.
- Identify potential trade-offs between rendering performance, memory, and UX.

### Phase 2: Implementation with Clean Composition
- Keep components focused (Single Responsibility Principle).
- Separate presentation (dumb UI) from orchestration (custom hooks/API logic).
- Use design tokens from `theme.ts` consistently.

### Phase 3: Self-Adversarial Review (Doubt-Driven Review)
Ask yourself before presenting the solution:
1. *"Did I cut any corners or leave any temporary hacks?"*
2. *"Is there any code here that I would be embarrassed to show in a Senior Staff review?"*
3. *"Will this code break when the active client lead tests it on an iPad or mobile terminal?"*

### Phase 4: True Verification
- Verify that automated unit tests pass because the **behavior** is correct, not because the tests were cheated.
- Run production build (`tsc -b && vite build`) with zero warnings and zero type errors.
- Confirm visual fidelity on both Light and Dark mode.

---

## 4. Anti-Pattern Hall of Fame (What to Immediately Reject)

| Anti-Pattern | Why It Is Dangerous | Correct Approach |
| :--- | :--- | :--- |
| **Hidden DOM hacks to satisfy assertions** | Corrupts DOM semantics, confuses screen readers, creates brittle tests. | Fix test matcher to query accessible role, aria-label, or test ID. |
| **Opaque white boxes around dark-mode logos** | Looks amateurish, breaks dark-mode immersion, feels like a cheap patch. | Use clean transparent PNG/SVG with appropriate contrast or native SVG paths. |
| **Unbounded state loops** | Freezes cashier terminal when catalog grows. | Use `useMemo`, filter indexing, or virtualized lists. |
| **Silent mock fallbacks in production hooks** | Masks missing Context providers in production runtime, hiding bugs. | Provide explicit error boundaries or properly structured Provider hierarchies. |
| **Chasing speed over reasoning** | Leads to bug whack-a-mole, regressions, and lost client trust. | Pause, reason deeply, design cleanly, execute once. |
