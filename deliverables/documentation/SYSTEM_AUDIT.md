# System Audit (§87)

Auditor stance: compare code against requirements; nothing counts as COMPLETE without a test. Per-ID results are in SYSTEM_REGISTRY.md (generated from MASTER_PROMPT.md, 516 legacy IDs + 65 expanded sections = 581 rows).

## Summary
| Status | Count | Meaning |
|---|---|---|
| COMPLETE | 282 | implemented, reachable, automated test evidence (prototype quality) |
| TESTING | 94 | implemented & reachable, no dedicated test |
| PARTIAL | 92 | gaps listed per row |
| SIMULATED | 8 | artifact-only vs simulated players |
| BLOCKED | 8 | payments / external approval |
| NOT_STARTED | 97 | — |

**Content counts vs §01 targets (reported separately from engine readiness):** classes 26/26 · skills 468/468 (templated) · base level cap 120 ✔ · ascension 3 ✔ · maps 9/150 · regions 1/25 · monsters 28/1,200 · items ≈200/5,000 · pets 12/350 · monster cards 28/1,200 · TCG cards 92/85 ✔ · starter decks 7/7 ✔ · NPCs 20/357 · quests 23/153 · daily dungeon types 5×10 ✔.

## Findings
**Critical** — none found that prevent starting or playing the game (E2E 27/27, 0 browser errors).

**High**
- H1 Snapshot scaling: measured 48 ms p95 tick at 100 players/map (TEST_REPORT). Remediation: delta + spatial hash.
- H2 Single-process economy authority; multi-process deployment would break invariants. Remediation: DB row locks / ownership leases.
- H3 Production gates missing: TLS/WSS, backups/PITR, monitoring, CI, admin MFA, security review.

**Medium**
- M1 RNG not cryptographic (must change before paid randomness; currently disabled).
- M2 Full-state resend per command (bandwidth).
- M3 Docker Compose not executed in this environment.
- M4 Skill kits templated; many class mechanics generic.
- M5 Several online equivalents missing (marriage, TCG PvP, friend presence).

**Low**
- L1 Partial Thai coverage of panel strings. L2 4 lint warnings. L3 World boss real-clock schedule not wired.

## Dead-button check
E2E step 21 opens all 22 menu windows. Buttons for disabled features (premium shop, payments, creator program) call real commands and show explicit "disabled by feature flag" messages — they are labelled, not silent.

## Security checks performed (evidence: multiplayer test)
Argon2id hashes, refresh rotation with reuse detection, login lockout, auth on REST/WS, character ownership on WS join, dev commands refused server-side, chat HTML escaping, malformed packet rejection, RBAC on admin routes, audited GM grants, no negative wallets, balanced ledger in DB, double-buy rejection.
