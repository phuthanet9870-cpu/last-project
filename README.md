# Hearthbound Online

Original cozy-fantasy 2D pixel MMORPG — **playable prototype** (not production-ready; see docs/PROGRESS.md and docs/KNOWN_ISSUES.md).

- **Play offline / artifact mode** (no install): open `deliverables/playable-artifact/index.html`. Other players are simulated.
- **Play online (real multiplayer):** needs PostgreSQL + Redis.

```bash
pnpm install
```
```bash
docker compose up -d postgres redis
```
```bash
pnpm game:start
```
→ http://localhost:2567/ (Online Mode) · admin http://localhost:2567/admin/

| Command | Purpose |
|---|---|
| `pnpm dev` | client dev server (offline mode) at http://localhost:5173 |
| `pnpm build` | typecheck + build client |
| `pnpm test` / `pnpm lint` / `pnpm typecheck` | unit tests / lint / types |
| `pnpm test:e2e` | Playwright E2E of the playable build |
| `pnpm test:multiplayer` | two real WebSocket clients vs running server |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm server` / `pnpm worker` | server pieces |
| `pnpm package` | rebuild `deliverables/` and `releases/*.zip` |

Docs: `docs/` (GDD, TDD, registry of 581 system IDs, audit, test report, decisions, deployment). Master requirements: `MASTER_PROMPT.md`.
