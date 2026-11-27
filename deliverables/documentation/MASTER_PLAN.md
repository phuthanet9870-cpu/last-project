# Master Plan & Document Map

The master prompt (MASTER_PROMPT.md, unchanged copy at repo root) is the requirement source. Phases and next work: PROGRESS.md.

§70 lists 37 working documents. To avoid empty files, several are consolidated; every named deliverable maps to a real location:

| Required document | Location |
|---|---|
| MASTER_PLAN, PROGRESS, DECISIONS, CHANGELOG, SYSTEM_AUDIT, SYSTEM_REGISTRY, TEST_PLAN→TEST_REPORT, KNOWN issues | docs/ (same names; TEST_PLAN + LOAD_TEST_REPORT → TEST_REPORT.md) |
| GAME_DESIGN_DOCUMENT, GAME_BALANCE, ECONOMY_DESIGN, ART_GUIDELINES | GAME_DESIGN_DOCUMENT.md (balance values in ASSUMPTIONS.md; art = procedural pixel art in apps/game-client/src/art.ts) |
| TECHNICAL_DESIGN_DOCUMENT, SERVER_ARCHITECTURE, GAME_LOOP, ENTITY_MODEL, NETWORK_PROTOCOL, API_SPECIFICATION, SECURITY_MODEL, OFFLINE_PROCESSING | TECHNICAL_DESIGN_DOCUMENT.md |
| COMBAT_ENGINE, COMBAT_FORMULAS, FORMULA_REGISTRY, MONSTER_AI | ASSUMPTIONS.md + packages/game-core/src/{combat,stats,effects,world}.ts |
| DATABASE_SCHEMA, ER_DIAGRAM, TRANSACTION_RULES | database/migrations/001_init.sql + TECHNICAL_DESIGN_DOCUMENT.md (Persistence) + DECISIONS ADR-005/006 |
| ECONOMY_ENGINE, ORDER_MATCHING_ENGINE | packages/game-core/src/economy.ts, market.ts (+ unit tests) |
| CONTENT_PIPELINE, CONTENT_CONFIGURATION | packages/game-core/src/config.ts, content.ts (versioned registry) |
| UI_UX_SPECIFICATION | PLAYABLE_README.md (controls) + apps/game-client/src/{ui,panels}.ts |
| DEPLOYMENT_GUIDE, ADMIN_GUIDE, RELEASE_CHECKLIST | DEPLOYMENT_GUIDE.md (admin + production checklist sections) |
| SYSTEM_DEPENDENCIES | §58 dependency order followed; see PROGRESS phase table |
