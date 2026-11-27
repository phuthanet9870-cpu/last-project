/**
 * Versioned configuration registry (§66). All numbers here are ASSUMPTIONS for a new game,
 * tunable without touching engine code. Engines read from CONFIG, never hardcode.
 */
export const ELEMENTS = ['neutral', 'fire', 'water', 'earth', 'wind', 'ice', 'light', 'dark', 'spirit'] as const;
export type Element = (typeof ELEMENTS)[number];

// Attacker row × defender column. Original balanced matrix (docs/COMBAT_FORMULAS.md).
// Cycle: fire>ice>wind>earth>water>fire (2x forward, 0.5x reverse). light<->dark mutual 2x. spirit resists physical-elements slightly, strong vs spirit.
const M: Record<Element, Partial<Record<Element, number>>> = {
  neutral: { spirit: 0.5 },
  fire: { fire: 0.5, ice: 2, water: 0.5, earth: 1, wind: 1 },
  water: { fire: 2, water: 0.5, earth: 0.5 },
  earth: { water: 2, earth: 0.5, wind: 0.5 },
  wind: { earth: 2, wind: 0.5, ice: 0.5 },
  ice: { wind: 2, ice: 0.25, fire: 0.5 },
  light: { dark: 2, light: 0.25, spirit: 1 },
  dark: { light: 2, dark: 0.25, spirit: 1 },
  spirit: { spirit: 2, neutral: 0.5 },
};
export function elementMultiplier(att: Element, def: Element): number {
  return M[att][def] ?? 1;
}

export const CONFIG = {
  version: '0.11.0-seed',
  /** Wedding ceremony phase length (gathering → vows → rings → celebration). Server may override via WEDDING_PHASE_MS. */
  weddingPhaseMs: 12_000, weddingCost: 5000,
  levelCap: 120,
  ascensionTiers: 3,
  ascensionLevelReq: [60, 90, 120],
  extendedMasteryCap: 200,
  statPointsPerLevel: 3,
  skillPointsPerLevel: 1,
  critMultiplier: 1.5,
  critCapPercent: 50,
  hitMin: 0.05, hitMax: 0.98,
  damageVariance: 0.08,
  pvpDamageMultiplier: 0.6,
  globalCooldownMs: 400,
  refineSuccess: [100, 100, 100, 100, 100, 85, 75, 65, 55, 45, 40, 35, 30, 25, 20, 18, 15, 12, 10, 8],
  refineDowngradeChance11to15: 0.3,
  refineGoldCost: (lvl: number) => 200 + lvl * lvl * 150,
  refineOreCost: (lvl: number) => 1 + Math.floor(lvl / 4),
  refinePityPerFail: 2, // +2% per consecutive failure (cap at +20%)
  refinePityCap: 20,
  gemSocketUnlock: [5, 10, 15, 20],
  marketFeeBps: 500, // 5%
  marketSlots: 12,
  auctionMinIncrementBps: 500,
  auctionAntiSnipeMs: 30_000,
  exchangeFeeBps: 100,
  crystalHoldMs: 72 * 3600_000, // Crystal bought on the exchange is held before it can be re-sold (§37 holding period)
  exchangeTick: 1,
  exchangeMinLot: 1,
  farmBaseCapacity: 12, farmMaxCapacity: 60,
  feederBaseSlots: 4, feederMaxSlots: 20,
  farmMaxAccumulationMs: 12 * 3600_000,
  farmExpPerMinute: 4,
  partyMax: 6, raidMax: 8, // a party converted to a raid group (partyRaid) holds up to raidMax
  inventoryBaseSlots: 60,
  gachaPity: 50,
  gachaRates: [ { rarity: 'mythic', weight: 0.6 }, { rarity: 'legendary', weight: 2.4 }, { rarity: 'epic', weight: 12 }, { rarity: 'rare', weight: 35 }, { rarity: 'uncommon', weight: 50 } ],
  dayLengthMs: 8 * 60_000,
  respawnMs: 5000,
  eloK: 32,
  seasonDays: 28, seasonEpoch: Date.UTC(2026, 0, 1),
  tcgDeckSize: 20, tcgMaxCopies: 2, tcgStartHand: 4, tcgMaxMana: 10, tcgHeroHp: 25,
  worldBossTimes: ['12:30', '18:30', '21:00', '23:30'],
  pvpTimes: ['13:00', '20:00', '22:00'],
  resetTimezone: 'Asia/Bangkok',
  featureFlags: {
    realPayments: false, paidRandomRewards: false, raid: true, housing: true, breeding: false, guildWar: false, crossWorldTransfer: false, devPanel: true,
  },
};
export type Config = typeof CONFIG;

/** requiredExp(L) = floor(100 * L^2.2) — EXP needed to go from L to L+1. */
export function requiredExp(level: number): number {
  return Math.floor(100 * Math.pow(level, 2.2));
}
export function requiredJobExp(level: number): number { return Math.floor(60 * Math.pow(level, 1.9)); }
export function requiredMasteryExp(m: number): number { return Math.floor(2_000_000 + m * 150_000); }
