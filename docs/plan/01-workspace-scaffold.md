# Step 01 — Workspace Scaffold

**Goal:** a working monorepo with Next.js (from the official template), shadcn/ui, the full folder structure, strict TypeScript, lint with layer boundaries, and Vitest running smoke tests in every package. No game logic yet.

**Prerequisites:** Node LTS and npm installed. Working dir `D:\ayush-personal\scalesquad`.

---

## Tasks

### 1.1 Root workspace
1. Create root `package.json`: `private: true`, `workspaces: ["apps/*", "packages/*"]`, `engines.node` set to current LTS, root scripts (see plan README).
2. Add `.nvmrc`, `.editorconfig`, `.prettierrc`, `.prettierignore`.
3. Create `tsconfig.base.json` with:
   - `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`
   - `moduleResolution: "Bundler"`, `target: ES2022`, `isolatedModules`, `skipLibCheck`
   - path aliases: `@scalesquad/*` to `packages/*/src`

### 1.2 Next.js via template command
Run from repo root:

```bash
mkdir apps
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Then:
- Rename package to `@scalesquad/web`.
- Make `apps/web/tsconfig.json` extend `../../tsconfig.base.json`, keeping Next's required plugin/include settings.
- Remove boilerplate page content, demo assets, default styles beyond Tailwind base.
- Confirm `npm run dev -w @scalesquad/web` serves a blank page.

### 1.3 shadcn/ui

```bash
cd apps/web
npx shadcn@latest init
npx shadcn@latest add button card input select dialog badge table tabs alert separator skeleton tooltip dropdown-menu avatar scroll-area sonner label form
```

- Choose a neutral base color. Confirm components land in `apps/web/src/components/ui/`.
- Confirm `components.json` aliases use `@/components`, `@/lib/utils`.
- Add a throwaway smoke page that renders a Button and a Select to verify styles load, then delete it.

### 1.4 Folder structure
Create every folder below with a placeholder `index.ts` (or `.gitkeep` where no code yet).

```
apps/
  web/src/
    app/                      (routes, layouts)
    components/ui/            (shadcn)
    components/shared/        (app-wide components)
    features/{lobby,brief,repair,results,chat}/
    lib/{api,ws,nexconn}/
    auth/
  server/
    package.json  tsconfig.json
    src/{config,routes,controllers,services,repositories,middleware,ws,lib}/
    src/main.ts
    tests/
packages/
  sim/        src/ + tests via colocated *.test.ts
  scenario/   src/ + data/
  shared/     src/
  db/         prisma/ + src/
  nexconn/    src/
```

Each package:
- `package.json` name `@scalesquad/<name>`, `private: true`, `main`/`types` pointing to `src/index.ts`, `type: "module"`.
- `tsconfig.json` extending the base.
- `src/index.ts` exporting a stub.
- Declared workspace dependencies only where allowed (see 1.6).

### 1.5 Tooling
Install at root (dev):
- `typescript`, `tsx`, `prettier`, `eslint`, `typescript-eslint`, `eslint-plugin-boundaries`, `eslint-config-prettier`
- `husky`, `lint-staged` (pre-commit: eslint + prettier on staged files, typecheck affected). Hook only fires when commits happen.
- `zod` in shared, scenario, server.

Root `eslint.config.js` (flat config):
- `typescript-eslint` strict rules; `@typescript-eslint/no-explicit-any: error`; `no-console: error` (allow in `packages/sim/cli`).
- Boundaries rules (see 1.6).

### 1.6 Layer boundaries (enforced by lint)
Element types: `controller`, `service`, `repository`, `middleware`, `ws`, `route`, `lib`, `config`, plus packages `sim`, `scenario`, `shared`, `db`, `nexconn`, and `web`.

Allowed imports:
- `controller` → `service`, `shared`, `lib`
- `service` → `repository`, `sim`, `scenario`, `shared`, `nexconn` (interface), `lib`
- `repository` → `db`, `shared`, `lib`
- `route`/`ws` → `controller`, `middleware`, `shared`
- `sim` → `scenario`, `shared` only
- `scenario` → `shared` only
- `shared` → nothing internal
- `web` → `shared`, `scenario` types only (never `db`, `sim`, server code)
- Nothing imports `db` except `repository`.

Add a deliberate-violation test fixture that the lint run proves fails (kept out of the main lint path).

### 1.7 Vitest (unit tests are the priority)
Install: `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

- Root `vitest.config.ts` using `projects`: one per package/app.
  - `sim`, `scenario`, `shared`, `nexconn`, `server`: `environment: node`.
  - `web`: `environment: jsdom`, setup file for jest-dom, alias `@` to `apps/web/src`.
- Coverage: v8, reporters `text` + `lcov`, thresholds set per project (start low, raise each step to targets in README).
- Add smoke test in each project: imports the package index and asserts it loads.
- Scripts: `test`, `test:watch`, `test:cov`, `test:db` (filters `*.db.test.ts`).

### 1.8 Env and local infra
- `.env.example` with **names only**: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `APP_ORIGIN`, `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, `NODE_ENV`, `LOG_LEVEL`.
- `docker-compose.yml`: Postgres only, named volume, port bound to `127.0.0.1`, credentials from env.
- `.gitignore` already present; verify `.env*` ignored and `.env.example` tracked.

### 1.9 Docs
- Add `README.md` at repo root: prerequisites, install, run, test commands.
- Update `docs/architecture.md` if any path differs from what was scaffolded.

---

## Unit tests required this step
- One smoke test per project (7 total).
- A tiny utility test in `apps/web/src/lib/utils.test.ts` (shadcn `cn`) proving jsdom + alias config works.
- Lint boundary fixture: a file importing `db` from a controller must fail lint (verified once, then excluded).

## Security checks
- [ ] `.env`, `.env.local` ignored; `.env.example` has no values.
- [ ] No secrets in `components.json`, configs, or docker-compose (env substitution only).
- [ ] Postgres port bound to localhost only.
- [ ] `npm audit` reviewed after install; note any accepted advisories.
- [ ] Dependency versions pinned via committed `package-lock.json`.

## Exit criteria
- `npm install` at root succeeds, one lockfile.
- `npm run dev -w @scalesquad/web` renders a page.
- `npm run lint`, `typecheck`, `test`, `build` all pass.
- Boundary violation fixture fails lint as expected.
- Folder tree matches `docs/architecture.md` section 3.
