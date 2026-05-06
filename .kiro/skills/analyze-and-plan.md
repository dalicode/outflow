# Skill: Analyze and Plan for Coder Agent

## Purpose

This skill defines the two-phase workflow used when a user requests a code change:

1. **Analysis phase** — read the relevant files, understand the current state, identify the root cause or design approach, and present findings to the user before touching any code.
2. **Planning phase** — produce a detailed, file-level implementation plan that a coder agent can execute without ambiguity.

Never skip the analysis phase. Never implement before the user has confirmed the plan.

---

## Phase 1: Analysis

### When triggered
- User says "analyze", "analyze only", "look at", "investigate", "what is happening", "why is X broken", or asks a question about existing behavior before requesting a change.
- User describes a problem or desired change without explicitly asking for implementation.

### What to do

1. **Read all relevant files** before forming any opinion. Use `readFile`, `readMultipleFiles`, `grepSearch`, and `readCode` to gather the full picture. Do not guess based on partial information.

2. **Trace the data flow** end-to-end:
   - Where does the data come from? (DB query, hook, prop)
   - How is it transformed? (utility function, useMemo, derived state)
   - Where is it rendered? (component, JSX block)
   - What are the side effects? (state updates, URL params, history)

3. **Identify the exact root cause** — not a symptom. State it precisely:
   - Which file, which function, which line
   - What condition causes the bug or undesired behavior
   - What the correct behavior should be

4. **Present findings clearly:**
   - State what you read and what you found
   - Explain the root cause in plain terms
   - If there are multiple options for fixing it, present them with tradeoffs
   - Do NOT implement anything yet

5. **Ask for confirmation** if the approach is unclear or there are meaningful tradeoffs between options.

### Analysis output format

```
## Analysis

**Root cause:** [precise description of what is wrong and where]

**Data flow:**
- [step 1]
- [step 2]
- [step 3]

**Options:**
- **Option A** — [description, tradeoffs]
- **Option B** — [description, tradeoffs]

**Recommendation:** [which option and why]
```

---

## Phase 2: Implementation Plan

### When triggered
- User says "write a detailed implementation plan", "create a plan for a coder agent", "plan this", or confirms an option from the analysis phase.
- User explicitly asks for a plan without wanting immediate implementation.

### What to do

1. **Re-read the files** that will be changed if not already in context. Plans must be based on the actual current file content, not memory.

2. **Produce an exact, file-level plan** with:
   - Every file that changes, listed explicitly
   - Every import to add or remove
   - Every interface/type change
   - Every function/component change with before/after code blocks
   - Exact placement instructions ("after X block", "before Y closing tag", "replace lines Z–W")
   - No vague instructions like "update the component" — always show the exact change

3. **Include verification steps** at the end:
   - `npm run build` — must pass with zero TypeScript errors
   - `npx vitest run` — all tests must pass
   - Manual smoke check items specific to the change

4. **State what does NOT change** — explicitly list files and components that are intentionally untouched, to prevent a coder agent from making unnecessary changes.

### Plan output format

The plan must be presented in two clearly separated sections:

**Section 1 — Summary** (brief, conversational): 1–3 sentences explaining what the plan does and why. This is the context for the user.

**Section 2 — Coder Agent Plan** (the copyable block): Wrap the entire detailed plan in a single fenced markdown code block so it can be copied as one unit and pasted directly to a coder agent. Use plain text inside the block (no nested markdown fences).

Example structure:

```
[1–3 sentence summary for the user]

---

CODER AGENT PLAN
================

Implementation Plan: [Feature/Fix Name]

Files to edit: [list]
Files to delete: [list, if any]
Files unchanged: [list of intentionally untouched files]

---

File: [path/to/file.tsx]

Change 1 — [description]

Before:
  [code]

After:
  [code]

Change 2 — [description]

Before:
  [code]

After:
  [code]

---

Verification

  npm run build
  npx vitest run

Manual check:
- [specific behavior to verify]
- [specific behavior to verify]
```

The fenced block must contain everything a coder agent needs — file paths, exact before/after code, verification commands — with no information left outside it.

---

## Rules

- **Never implement during analysis.** If the user says "analyze only", produce only Phase 1 output.
- **Never skip reading files.** Plans based on assumed file content will be wrong.
- **Be exact.** Vague plans ("update the props", "fix the condition") are not useful to a coder agent. Show the actual code.
- **One change at a time.** If a request involves multiple independent changes, split them into numbered steps so a coder agent can execute and verify each one before moving to the next.
- **Flag test changes.** If a code change will break existing tests, call it out explicitly and include the test fix in the plan.
- **No scope creep.** The plan covers exactly what was requested. Do not add "while we're here" changes unless the user asks.
