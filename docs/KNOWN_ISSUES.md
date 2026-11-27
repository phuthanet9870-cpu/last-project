# Known Issues & Limitations

## Severity: High
1. **Snapshot scaling (performance).** Snapshots send all visible entities in full at 10 Hz; measured tick p95 48 ms at 100 players in one map (budget 50 ms) and ~350 KB/s per client. Fix: delta snapshots, spatial hash AOI, binary encoding. Validated capacity ≈ 50/map.
2. **Single-process authority.** Economy/market state lives in one Node process (persisted to PostgreSQL after each economic command). Running two server processes against one DB would cause conflicts. Horizontal scaling requires ownership leases or moving market matching into DB transactions with row locks.
3. **Not production-ready.** No TLS/WSS termination, no CI/CD, no backups/PITR, no monitoring stack, no admin MFA. Release gates (§69) are not met.

## Severity: Medium
4. **Content is templated.** 468 skills come from 4 role kits × element/role transforms — distinct numbers and effects, but not 468 hand-designed abilities. Content counts are far below §01 targets (9 maps, 28 monsters, ~200 item definitions, 12 pets, 4 mounts, 92 TCG cards, 23 quests).
5. **Art is original procedural placeholder pixel art.** 4-direction character sprites (8-direction movement maps diagonals to side sprites). No equipment overlays. Production art needs an artist.
6. **Online feature gaps** (artifact has them simulated): marriage, friend presence, buy-order fills by real players beyond the shared book, TCG PvP, guild storage/war, party dungeons.
7. **Full player state is re-sent** to its owner after state-changing commands (≈20–60 KB). Acceptable for prototype, wasteful at scale.
8. **Docker Compose unverified** (no Docker daemon in the build environment).
9. **RNG**: seeded sfc32 held server-side; not a CSPRNG — must be replaced before any paid random rewards.

## Severity: Low
10. Thai translation covers UI keys and content names; many panel strings are English only.
11. Knockback/knockdown, durability/repair, fullscreen toggle, key remapping not implemented.
12. World boss schedule rotates by hour; configured Bangkok times are not wired to the real clock (artifact spawns every 4 minutes for testing).
13. Lint: 4 unused-variable warnings.

## Artifact mode specifics
- Other players, market traders, guild members, arena opponents and leaderboards are **SIMULATED** (labelled "·sim").
- Save data uses browser localStorage; if the sandbox blocks storage, use Export/Import save file.
- The developer testing panel is enabled by default in the artifact (add `?dev=0` to the URL to hide it). The server always rejects dev commands unless `DEV_COMMANDS=1`, non-production, admin role.
