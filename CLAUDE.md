# Project Conventions

## Language

- Source code: English (identifiers, comments, docs)
- Agent communication: Korean

## Stack

- **Runtime**: Node.js (ESM)
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest
- **Linting**: ESLint + TypeScript-ESLint
- **Formatting**: Prettier

## Code Style

- No semicolons
- Single quotes
- Trailing commas
- 100 char line width
- 2-space indentation

## TypeScript Rules

- Strict mode enabled (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- No `any` — use `unknown` and narrow explicitly
- Prefer `const` over `let`; avoid `var`
- Export types explicitly with `export type`

## Testing

- Test files colocated with source: `src/foo.test.ts` alongside `src/foo.ts`
- Test naming (Korean): "무엇을 하면 어떤 결과가 나온다"
- AAA pattern: Arrange → Act → Assert
- Test user-observable behavior, not implementation details

## Project Structure

```
src/         # Source code
dist/        # Compiled output (gitignored)
agents/      # Agent AGENTS.md, SOUL.md, etc.
```

## Commits

- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`
- Keep commits small and focused
- Co-author line for agent commits:
  `Co-Authored-By: Paperclip <noreply@paperclip.ing>`

## Agents

Agent config files live under `agents/<agent-name>/`. Do not modify another
agent's directory without explicit instruction from that agent or the CEO.
