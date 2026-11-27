# api-server

The REST control plane (auth, characters, rankings, admin, payments stub) is implemented with Fastify **inside** `game-server/src/main.ts` (modular monolith, ADR-004). It shares the process with the WebSocket game loop. Routes: see `documentation/TECHNICAL_DESIGN_DOCUMENT.md`.
