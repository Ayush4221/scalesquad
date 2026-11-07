# Project flow

One root package and lockfile. Application code stays in `src`; all tests and
helpers stay in root `tests`. Public files and build configuration stay at the
root as Next.js expects. No nested packages or repeated source roots.

## Request flow

`Page / component → HTTP router → controller → service → repository → Prisma`

- `src/app`: standard Next.js App Router pages, layouts and Auth.js route.
- `src/features`: product screens and interactions, grouped by auth/lobby/repair/chat/results.
- `src/components`: reusable UI and shared display pieces.
- `src/shared/dtos`: request/response types shared across layers.
- `src/shared/validations`: reusable strict zod input schemas.
- `src/server/routes`: HTTP dispatch, session checks, limits and response headers.
- `src/server/controllers`: validate input, call a service, shape the response.
- `src/server/services`: authorization, game rules, passwords and session behavior.
- `src/server/repositories`: database reads and transactions; the only Prisma access layer.
- `src/db/prisma`: schema and migration history.

`src/server/main.ts` wires these dependencies and starts Next.js, HTTP and WS.
Views never import repositories or Prisma. Services do not know about HTTP/WS.
ESLint checks the dependency direction.

## Public home

Guests arriving at `/` see the public Incident Brief home page before any account
form. It explains the game, roles and playbook; its main actions lead to
`/register` and `/signin`. Authenticated visitors still continue to `/play`.
The account pages' brand link returns to the home URL.

`src/features/landing` owns the server-rendered page, navigation action and small
client mission preview. The preview has fixed initial content, cancellable
timers, pause/replay controls and manual scenes for reduced-motion users. It does
not run the simulator, call game APIs or expose private scenario evidence.

## Signup and login

`SignupForm / LoginForm / ChangePasswordForm → authController → AuthService → UserAuthRepository / SessionWriteRepository`

Signup hashes the password and creates the account. Login checks the hash and
creates a database session. No mail sender, token service or verification step
sits between signup and play. Password change requires a session and the current
password. Detailed policy and limits are in `auth.md`.

Signup and login share `AuthLayout`, `AuthStory` and scoped `auth.module.css`.
`SignupForm` and `LoginForm` reuse `FormField`/`PasswordInput` controls and shared
request schemas. Client validation is a usability check; the controller and
service still validate and enforce policy.

## Game and live updates

`PlayLobby / MatchShell → gameController or wsController → game services → match repository`

Services check membership, host/editor role and phase before changing a match.
Updates pass through the room gateway to authorized sockets. Private evidence
uses its own owner-bound fetch and is never broadcast.

`src/scenario` supplies validated scenario values. `src/sim` is the pure,
deterministic simulation engine. The run service delegates simulation to a worker
and persists immutable input snapshots/results before notifying players.

`src/nexconn` isolates the external chat provider. `src/pwa` owns installation,
cache privacy and optional notifications. Push setup is separate from login.

## Tests

- `tests/shared`, `scenario`, `sim`: contracts and pure deterministic rules.
- `tests/server`: service, controller, HTTP, WebSocket and security behavior.
- `tests/db`: real Postgres transactions, sessions and constraints.
- `tests/web`: component behavior.
- `tests/e2e`: three-player browser flows and the ignored common credentials file.

See `e2e.md` for commands, browser projects and GitHub Actions.
