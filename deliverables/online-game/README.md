# Hearthbound Online — Online Game (Mode B)

Real multiplayer: authoritative Node.js game server (Fastify REST + WebSocket) running the same `game-core` engine as the artifact, PostgreSQL persistence, Redis presence/rate limits, BullMQ worker, admin dashboard.

Folders: `game-client/` (browser client source), `game-server/` (REST + WS + game loop; the REST "api-server" lives here — see `api-server/README.md`), `game-core/` (shared engine), `admin-dashboard/`, `worker/`, `database/migrations/`.

The runnable monorepo is the repository root (this folder is a packaged copy). From the repository root:
```bash
pnpm install
```
```bash
docker compose up -d postgres redis
```
```bash
pnpm game:start
```
Then open http://localhost:2567/ → **Online Mode** → Register → create character → Enter world. Open a second browser profile to see real multiplayer. Admin: http://localhost:2567/admin/ (set `ADMIN_USERNAME`/`ADMIN_PASSWORD` in `.env` first).

Verified: two real clients see each other, movement/combat/chat, party with consent, item↔gold trading, market escrow + purchase, ranked 1v1 arena with Elo, reconnect persistence, admin RBAC + audited grants (see documentation/TEST_REPORT.md). Validated capacity ≈ 50 players per map instance on one process.
