# Release Acceptance — §69 gate review (v0.14.0-seed, 2026-11-27)

**Verdict: NOT production-ready. GAME COMPLETE is not declared.** Several §69 gates fail or were not run. This file records the evidence for each gate and what would close it.

| §69 gate | Status | Evidence / gap |
|---|---|---|
| All required system IDs COMPLETE with proof | **FAIL** | Registry (581 IDs): COMPLETE 485 · TESTING 2 (implemented, no dedicated test) · PARTIAL 52 · NOT_STARTED 31 · BLOCKED 8 · SIMULATED 3. See `docs/SYSTEM_REGISTRY.md`. |
| Optional systems complete or explicitly deferred/disabled with approval | **PARTIAL** | Paid shop/top-up/payments are disabled by feature flag (BLOCKED: need a payment provider plus legal review). Creator program, Discord link, licensed lyrics and donor ranking are NOT_STARTED and have **not** been approved as deferred. |
| No critical/high unresolved security or integrity issue | **PASS (internal review only)** | Found and fixed in this phase: IP spoofing via an unconditional `trustProxy` (could bypass the login rate limit). The ledger reconciles with 0 unbalanced transactions. Admin TOTP MFA, CSP/HSTS and the production config guard are in place. **No external penetration test or threat-model review.** |
| Approved final assets and localization | **FAIL** | All art and audio are procedural placeholders (original, not production art). UI is Thai/English; content text is partly bilingual. Nothing has been approved. |
| Load and soak tests at launch capacity | **PARTIAL** | Load: 250 players, p95 tick 47.1 ms (budget 50), single process, movement + chat only. **Soak test (hours, with combat) not run.** Recommended cap: 200 per process. |
| Restore drill | **PASS (dev data)** | `scripts/backup-drill.mjs`: dump → restore → verify all tables, migrations and ledger; `docs/backup-drill-last.json`. Production-size RTO has not been measured. |
| Monitoring and operational runbooks | **PARTIAL** | `/metrics`, `/readyz`, alert rules and `docs/OPERATIONS_RUNBOOK.md` exist. No Prometheus/Alertmanager/log shipping has been deployed. |
| Moderation/support | **PARTIAL** | Reports, sanctions (mute/suspend/ban), appeals, audit log and GM grants exist. No support ticketing. |
| Legal/privacy/payment review | **NOT RUN** | Needs humans: terms, privacy policy (PDPA), age rating, payment and gacha regulations. Real payments stay disabled. |
| Staging signoff | **NOT RUN** | No staging environment. The Docker image and compose/TLS stack are written but not built (no Docker daemon in the dev container). CI is written but has not run on GitHub. |
| Explicit authorization for production | **NOT GIVEN** | Nothing was deployed. |

## Automated evidence in this release
- **Type and lint:** typecheck 0 errors; lint 0 errors (3 warnings).
- **Unit tests:** 120 (114 game-core incl. the coverage suite + 6 server security tests, including RFC 6238/4226 vectors).
- **Artifact E2E:** 39/39 steps with real UI in headless Chromium, 0 browser errors.
- **Multiplayer integration:** 29/29 steps with real WebSocket clients, PostgreSQL and Redis. Covers:
  - auth, MFA and trade
  - market, PvP, guild/war, wedding and raid entry
  - rankings and the worker job
  - HTTP hardening
- **Online browser E2E:** 3/3, with console/CSP errors captured.
- **Load test:** 100 and 250 clients.
- **Backup/restore drill:** passed.
- **Production startup guard:** observed refusing weak settings and starting with hardened ones.

## Content counts (computed from the code registry)
- **Maps:** 18 (field zones cover Lv1–120).
- **Classes:** 26 × 18 skills = 468 skill IDs.
- **Monsters:** 57 (34 normal, 11 elite, 1 rare, 4 dungeon/raid bosses, 7 world-boss variants).
- **Quests:** 47 (main chain to the Lv115 raid finale).
- **NPCs:** 26.
- **Dungeons:** 54 (3 story + 50 daily floors + 1 raid).
- **TCG:** 100 collectible cards.
- **Items:** 263, in 7 equipment tiers.
- **Live events:** 3 weekly rotating events.

## Repair plan to reach a release
1. Get approvals: decide which optional systems are formally deferred (creator program, Discord, payments).
2. Final art and audio pipeline, plus full content localization.
3. Staging environment:
   - build and scan the image
   - run CI on GitHub
   - issue real TLS certificates
   - deploy Prometheus/Alertmanager and log shipping
4. Run a soak test (4–8 h with combat and economy activity) on production-sized hardware. Measure RTO on a production-size dump.
5. Get an external security review/pen test, then a legal/privacy/payment review.
6. Write dedicated tests for the 2 remaining TESTING systems and finish the 52 PARTIAL ones (see the registry evidence column).
7. Staging signoff, then explicit production authorization.
