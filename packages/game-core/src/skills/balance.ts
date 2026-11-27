/**
 * Per-class damage scale applied to every damaging skill's base power (and normal attack) of that class.
 * Produced by the calibration pass in scripts/gen-skill-docs.ts (--calibrate) from the headless combat simulation.
 * INITIAL BALANCE — SIMULATION_ONLY / NEEDS_BALANCING. 1 = unchanged.
 */
export const CLASS_POWER_SCALE: Record<string, number> = {
 "vanguard": 2.34,
 "blade_sentinel": 0.64,
 "rune_knight": 1.58,
 "wild_archer": 2,
 "falcon_scout": 1.29,
 "shadow_rogue": 0.55,
 "phantom_dancer": 3.1,
 "dawn_priest": 1,
 "spirit_monk": 1.28,
 "moon_oracle": 0.52,
 "flame_weaver": 0.19,
 "frost_sage": 0.47,
 "storm_caller": 0.51,
 "earth_keeper": 0.73,
 "tide_witch": 0.58,
 "void_scholar": 0.51,
 "sun_herald": 0.54,
 "beast_tamer": 0.8,
 "grove_warden": 1.22,
 "soul_binder": 1.03,
 "iron_engineer": 2.46,
 "cannon_smith": 0.5,
 "sky_dragoon": 0.89,
 "chrono_adept": 1.76,
 "fortune_dealer": 1.7,
 "melody_bard": 0.72
};
