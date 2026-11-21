# ScaleSquad — Instructions for Codex and other agents

Follow `CLAUDE.md` in this directory: it is the project's agent rulebook (stack,
layers, security, coding standards, working agreements). It points to the sources
of truth: `docs/scalesquad-deep-design.md` (game rules), `docs/architecture.md`
(technology and structure) and `docs/plan/*` (step plans).

## Asking questions: use the manager bridge, not the user

A manager agent answers project questions on the owner's behalf. When you need a
decision or clarification, do not stop to ask the user. Use this file protocol:

1. Pick an id: `YYYYMMDD-HHMMSS-short-slug` (for example `20261107-142530-push-schema`).
2. Write the question to `.agent-bridge/questions/<id>.md.tmp`, then rename it to
   `.agent-bridge/questions/<id>.md` (the rename makes the file appear complete).
   Include:
   - **Question**: one decision per file, stated plainly.
   - **Context**: the task, plan step, and files involved (paths).
   - **Options**: what you are considering, with your recommendation.
   - **Blocking**: what you cannot continue without the answer.
3. Poll for `.agent-bridge/answers/<id>.md` every 30 seconds, for up to 20 minutes.
   Continue with independent, non-conflicting work while you wait.
4. Read the answer's first line:
   - `STATUS: ANSWERED` — follow the decision in the file.
   - `STATUS: ESCALATED` — the decision belongs to the owner (new dependency,
     cost, credentials, production identifiers, game rules, or weakening
     security). Ask the user directly, quoting the manager's summary.
5. If no answer arrives within 20 minutes, ask the user directly.

Never put secrets, tokens, passwords or `.env` values in question files.
`.agent-bridge/` is git-ignored; do not commit it.
