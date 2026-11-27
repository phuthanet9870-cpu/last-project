# Known Issues & Limitations

## Severity: High
1. **Capacity ceiling.** After delta snapshots + spatial AOI (v0.2.0), one map instance holds 250 players within budget (p95 46 ms). 500+ untested; combat-heavy load untested; JSON (not binary) encoding.
2. **Single-process authority.** Economy/market state lives in one Node process (persisted to PostgreSQL after each economic command). Running two server processes against one DB would cause conflicts. Horizontal scaling requires ownership leases or moving market matching into DB transactions with row locks.
3. **Not production-ready.** No TLS/WSS termination, no CI/CD, no backups/PITR, no monitoring stack, no admin MFA. Release gates (§69) are not met.

## Severity: Medium
4. **Content is templated.** 468 skills come from 4 role kits × element/role transforms — distinct numbers and effects, but not 468 hand-designed abilities. Content counts are far below §01 targets (9 maps, 28 monsters, ~200 item definitions, 12 pets, 4 mounts, 92 TCG cards, 23 quests).
5. **Art is original procedural placeholder pixel art.** 4-direction character sprites (8-direction movement maps diagonals to side sprites). No equipment overlays. Production art needs an artist.
6. **Online feature gaps:** engagement/wedding ceremony, ranked TCG vs real players (friendly PvP duels work), guild storage/war, real buy-order fills beyond the shared book.
7. **Full player state is re-sent** to its owner after state-changing commands (≈20–60 KB). Acceptable for prototype, wasteful at scale.
8. **Docker Compose unverified** (no Docker daemon in the build environment).
9. **RNG**: seeded sfc32 held server-side; not a CSPRNG — must be replaced before any paid random rewards.

## Severity: Low
- Guild war winner on a 0:0 Siege score is decided by the arena tie-break rule (the test war ran only 3 s, so no objective play happened). Guild kick/transfer/disband are implemented but not covered by an automated test. The artifact guild is single-player (members and rival guilds are simulated).
- Wedding guests online must be in the plaza and near the aisle to receive cake; there is no RSVP/invitation list, scheduled booking or wedding photo.
- Membership bonuses read the wall clock (not the injected test clock).
- New-zone balance (Lv30–90) follows the existing HP/ATK formulas but has not been play-tested; the E2E dungeon run uses the dev `weaken` op. Solo simulation: a Lv90 priest with an Astral staff needs ~2.5 min of auto-attacks for the Abyssal Kraken. No content beyond Lv~90 yet (cap 120); no raids.
10. Thai translation covers UI keys and content names; many panel strings are English only.
11. Fullscreen toggle and key remapping not implemented. Projectiles are not blocked by walls (they fly over terrain).
12. World boss schedule rotates by hour; configured Bangkok times are not wired to the real clock (artifact spawns every 4 minutes for testing).
13. Lint: 4 unused-variable warnings.

## Artifact mode specifics
- Other players, market traders, guild members, arena opponents and leaderboards are **SIMULATED** (labelled "·sim").
- Save data uses browser localStorage; if the sandbox blocks storage, use Export/Import save file.
- The developer testing panel is enabled by default in the artifact (add `?dev=0` to the URL to hide it). The server always rejects dev commands unless `DEV_COMMANDS=1`, non-production, admin role.
