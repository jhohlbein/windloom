// Hit points for a creature at a palace stage: hp + hpBonus * floor(stage / hpBonusEveryStages)
export function hpFor(c, stage) {
  return c.hp + (c.hpBonus || 0) * Math.floor(stage / (c.hpBonusEveryStages || 1));
}

// Population target for a spawn rule (config "spawning"): none before fromStage, then
// min(base + floor(add * (stage - fromStage)), max). A fractional add (0.5) means one more every two stages.
export function targetFor(rule, stage) {
  const from = (rule && rule.fromStage) || 1;
  if (!rule || stage < from) return 0;
  return Math.min(rule.base + Math.floor((rule.add || 0) * (stage - from) + 1e-6), rule.max);
}
