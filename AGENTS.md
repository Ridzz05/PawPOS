# AGENTS.md — Guidelines for PawPOS AI Assistant

## Core Directive: Architectural Rigor & Zero-Hack Standard
Every code generation, modification, and architectural proposal in this repository MUST strictly follow:
`[.agents/skills/architectural-rigor-and-zero-hacks/SKILL.md](file:///.agents/skills/architectural-rigor-and-zero-hacks/SKILL.md)`

### Key Principles:
1. **Zero-Hack Policy**: Never use hidden DOM hacks, fake string nodes, or monkey-patches just to pass tests or rush builds. Fix the root cause at the architectural level.
2. **Deep Reasoning First**: Deconstruct requirements, consider edge cases, and design clean state models before generating code.
3. **Enterprise Minimalist UI**: Strictly zero-glow aesthetics, clean 1px borders, harmonious dark/light mode tokens, and professional asset presentation.
4. **Reliability for Active Client Lead**: Ensure zero regressions on cashier workflows (cart, splits, shifts, and stock ledger).
