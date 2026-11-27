# Hearthbound Online — Playable Build (Artifact / Offline Mode)

Open `index.html` in a modern browser (no server needed). Files: `index.html`, `game.js`, `styles.css`. All art and audio are generated in code; `assets/` is intentionally empty.

**What is simulated:** other players (·sim), market traders, auction bidders, exchange market makers, guild members, arena opponents, leaderboards and marriage partners run locally. This is **not** online multiplayer. Online multiplayer requires the server in `../online-game`.

## Controls
| Input | Action |
|---|---|
| WASD / arrows · touch joystick | Move (8 directions) |
| Left-click ground | Walk there (A* pathfinding) |
| Click monster / NPC | Select / talk (double-click monster to attack) |
| Space | Attack target (auto-targets nearest monster) |
| 1–8 | Skills on hotbar · Q / E potions |
| SET (left of the hotbar) | Switch between 3 hotbar sets · drag skills between slots or from the Skills window |
| F | Interact: talk, pick up loot, gather node, use portal |
| N | Throw Silk Net on a weakened capturable monster |
| Tab | Cycle targets · R ride mount · Z auto-battle |
| C I K J P O M G B H | Character, Bag, Skills, Quests, Pets, Social, Mail, Market, Hearthcards, Help |
| Enter | Chat (`/w` world, `/p` party, `/g` guild) |
| Esc | Close windows / Settings · `` ` `` Developer panel |

## First 10 minutes
1. Create a character (10 starter classes shown; "Show all 26 classes").
2. Talk to **Elder Rowan** (yellow !) → visit Pip → kill 5 Moss Slimes east of town.
3. Equip loot (double-click in Bag), refine at Brunhild, socket gems at Isolde.
4. Capture a pet, ride a mount, gather with tools, craft at Juno.
5. Dungeons (Warden Thorne / far NE of Whisperwood), World Boss (Sunken Crater via Amber Hills), Arena (Master Kaz), Hearthcards (Kit).

## Saving
Autosave every 15 s to browser storage when allowed. Settings → Save Data → **Export save file** / **Import save file** to keep progress anywhere.

## Developer Testing Panel
Press `` ` ``: change class, levels, EXP, gold/currencies, materials, items, skills, spawn monsters/bosses, change map, night/day, and one-click tests for refine, gems, stones, pets, farm, mounts, dungeon, PvP, market, auction, exchange, gacha (simulated currency), pass, events, card duel, mail, save/load, reset. The **System Registry** tab lists all 581 system IDs with status and evidence. Hide the panel with `?dev=0`.

## Skills (V4)
Press **K**. Each class has its own 18-skill tree in 3 Ascension stages. Skill points come from **job level**.
Click **+** on a node (or right-click / **−** to take it back) — changes stay *pending* until you press **Confirm**. **Undo** steps back, **Clear** drops all pending changes, **Auto Allocate** fills a draft from a recommended build. The table on the right compares your current rank with the next one using the same numbers combat uses. Your class gauge is shown on the HUD (e.g. Moon Oracle shows the moon phase).
