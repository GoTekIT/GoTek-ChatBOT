---
name: project-context
description: Load GoTek Chatbot architecture, current status, handoff, constraints and verification protocol before changing the project.
---

# Activation

Use when starting a session, taking over, implementing, fixing bugs, refactoring, reviewing architecture or continuing unfinished work. Portable across coding agents; paths are relative to repository root. This protocol does not itself authorize external actions.

# Mandatory reading order

1. README.md
2. docs/00-START-HERE.md
3. AGENTS.md
4. docs/PROJECT-STATUS.md
5. docs/HANDOFF.md
6. docs/ARCHITECTURE.md
7. docs/SYSTEM-FLOW.md

Then read only task-relevant docs/source. Treat current source and verified behavior as authoritative; reference documents can be stale. Label unknown facts `UNKNOWN / NEEDS VERIFICATION`.

# Before coding

Identify requested change; inspect implementation and affected modules; check known issues and unfinished work; identify tests and dependencies; avoid assumptions. Preserve pre-existing changes. Establish disjoint ownership before parallel edits; serialize shared database suites and git operations.

# During coding

Follow existing architecture, style and tenant boundaries. Make minimal coherent changes. Preserve required compatibility, protect secrets, do not silently change business logic. Add/update meaningful tests. No automatic production deploy or customer messaging.

# Before claiming completion

Verify build, typecheck, lint if available, relevant tests and manual flow. If a command is unavailable/not run/fails, report exactly that; never invent scripts. GoTek currently has build/test and `npx tsc --noEmit`, no lint script. Distinguish mocked transport tests from real API receipt and product acceptance.

# Documentation synchronization

Review changes for necessary updates to docs/PROJECT-STATUS.md, HANDOFF.md, ARCHITECTURE.md, SYSTEM-FLOW.md, API.md, DATABASE.md, KNOWN-ISSUES.md, TODO.md and CHANGELOG.md. Update only affected files; keep one current source of truth and links to evidence.

# Stopping mid-task

Mandatory: update docs/HANDOFF.md with goal, completed work, current code state, relevant files, known issue, exact next step, commands already run and commands still needed. Preserve unfinished code and identify any required credentials/decisions without recording secrets.

# Definition of Done

DONE requires implemented code, relevant validation, no known blocking error, synchronized docs and updated status. Otherwise use DONE BUT NEEDS VERIFICATION or IN PROGRESS. TODO is required but unimplemented; FUTURE / OPTIONAL is outside current committed scope. Never mark whole H/E module complete based only on a file, build or narrow test.
