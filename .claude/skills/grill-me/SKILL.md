---
name: grill-me
description: >-
  Interactive interrogation and requirements elicitation workflow to probe architectural decisions, trade-offs, edge cases, and user expectations before implementation.
---

# Grill-Me Skill

This skill conducts deep, structured technical interrogations to uncover edge cases, architectural trade-offs, performance requirements, and system design specifications before writing production code.

## Workflow

1. **Deconstruct Requirements**: Identify ambiguous assumptions, unhandled failures, rate limits, data schemas, storage, and runtime constraints.
2. **Formulate High-Impact Questions**: Focus questions on decisions that have significant architectural impacts (e.g. crawler engine choice, concurrency, output format, proxying/anti-bot resilience, retry behavior).
3. **Present Options with Trade-Offs**: For each question, outline clear options, their pros/cons, and recommended paths.
4. **Synthesize Alignment**: Once responses are gathered, produce a concrete implementation plan reflecting all decisions.
