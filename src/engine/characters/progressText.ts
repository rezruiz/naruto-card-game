import { findOccupant } from '../board';
import type { BoardOccupant, GameState } from '../types';

export interface TrackedItem {
  label: string;
  value: string;
  /** Important enough to show on the compact card too, not just in the details view. */
  key?: boolean;
}

function nameOf(state: GameState, instanceId: unknown): string {
  if (typeof instanceId !== 'string') return '?';
  return findOccupant(state, instanceId)?.occupant.name ?? 'a defeated unit';
}

function names(state: GameState, ids: unknown): string {
  const list = Array.isArray(ids) ? (ids as string[]) : [];
  return list.length === 0 ? 'none yet' : list.map((id) => nameOf(state, id)).join(', ');
}

function scheduleText(state: GameState, schedule: unknown): string | undefined {
  const list = Array.isArray(schedule) ? (schedule as { targetInstanceId?: string; ticksLeft?: number }[]) : [];
  if (list.length === 0) return undefined;
  return list.map((e) => `${e.targetInstanceId ? nameOf(state, e.targetInstanceId) : 'pending'}${e.ticksLeft !== undefined ? ` (${e.ticksLeft} left)` : ''}`).join(', ');
}

const yes = (v: unknown) => (v ? 'Yes' : 'No');

/**
 * Every per-card resource/state bag field that means something to a player
 * (the `extra` keys each character/token file writes), rendered as a
 * label/value list. Each key in `extra` must have an entry here — see
 * DISPLAYED_EXTRA_KEYS and its guard test — so a new card can't silently
 * track something the player can't see.
 */
const PER_KEY: Record<string, (v: unknown, state: GameState, occ: BoardOccupant) => TrackedItem | undefined> = {
  clayCharges: (v) => ({ label: 'Clay Charges', value: `${(v as number) ?? 0}`, key: true }),
  hearts: (v) => ({ label: 'Hearts', value: `${(v as number) ?? 5}/5`, key: true }),
  lostStyles: (v) => ((v as string[] | undefined)?.length ? { label: 'Styles lost', value: (v as string[]).join(', ') } : undefined),
  curseActive: (v) => ({ label: 'Curse active', value: yes(v), key: !!v }),
  curseActivatedTurn: (v) => (v !== undefined ? { label: 'Curse activated on turn', value: `${v}` } : undefined),
  cursedTarget: (v, s) => (v ? { label: 'Cursed target', value: nameOf(s, v), key: true } : undefined),
  usedSafetyNet: (v) => ({ label: "Jashin's Blessing safety net used", value: yes(v) }),
  mindPrisonUsedOn: (v, s) => ({ label: 'Mind Prison already used on', value: names(s, v) }),
  crowCloneUsedOn: (v, s) => ({ label: 'Crow Clone already used against', value: names(s, v) }),
  amaterasuSchedule: (v, s) => {
    const t = scheduleText(s, v);
    return t ? { label: 'Amaterasu burning', value: t, key: true } : undefined;
  },
  absorbedChakra: (v) => ({ label: 'Absorbed Chakra', value: `${(v as number) ?? 0}`, key: true }),
  transformed: (v) => ({ label: 'Shark transformation', value: v ? 'Transformed' : 'Normal', key: !!v }),
  transformDamageTaken: (v, _s, occ) => (occ.extra.transformed ? { label: 'Damage taken while transformed', value: `${(v as number) ?? 0}` } : undefined),
  shikigamiCharges: (v) => ({ label: 'Shikigami Charges', value: `${(v as number) ?? 0}`, key: true }),
  paperPersonPending: (v) => (v ? { label: 'Paper Person of God', value: 'Pending (opponent’s End Phase)', key: true } : undefined),
  mode: (v) => ({ label: 'Mode', value: v === 'black' ? 'Black Zetsu' : 'White Zetsu', key: true }),
  sporeSchedule: (v, s) => {
    const t = scheduleText(s, v);
    return t ? { label: 'Spore Absorb ticks', value: t } : undefined;
  },
  sharedPoolOwner: (v, s) => {
    const owner = typeof v === 'string' ? findOccupant(s, v)?.occupant : undefined;
    const pool = owner && 'chakraPool' in owner && owner.chakraPool ? owner.chakraPool.current : 0;
    return { label: 'Shared Reservoir', value: `${pool} Chakra (${nameOf(s, v)})`, key: true };
  },
  damagedByZetsuFamilyTurn: (v, s) => (v === s.turn ? { label: 'Damaged by Zetsu family', value: 'This turn' } : undefined),
  cannotNegateOwnDamageUntilTurn: (v, s) => ((v as number) >= s.turn ? { label: "Can't negate damage to itself", value: `Through turn ${v}`, key: true } : undefined),
  taijutsuLockedUntilTurn: (v, s) => ((v as number) >= s.turn ? { label: 'Taijutsu locked', value: `Through turn ${v}`, key: true } : undefined),
  almightyPushPending: (v) => (v ? { label: 'Almighty Push', value: 'Hits at your next End Phase', key: true } : undefined),
  narakaSchedule: (v) => (Array.isArray(v) && v.length > 0 ? { label: "King of Hell's pending effects", value: `${v.length}`, key: true } : undefined),
  fizzlesIfInstanceIdDefeated: (v, s) => (v ? { label: 'Fizzles if defeated', value: nameOf(s, v) } : undefined),
  squadFormationGroup: (v, s) => ({ label: 'Squad Formation group', value: names(s, v), key: true }),
  poisonCounters: (v) => ((v as number) > 0 ? { label: 'Poison', value: `${v}`, key: true } : undefined),
  chakraSporeArmed: (v) => (v ? { label: 'Chakra Spore', value: 'Planted — drains up to 3 next Upkeep', key: true } : undefined),
  chakraSporePlantedBy: () => undefined, // shown via chakraSporeArmed
  scheduledHeals: (v) =>
    Array.isArray(v) && v.length > 0
      ? { label: 'Scheduled heals', value: (v as { amount: number; ticksLeft: number }[]).map((h) => `${h.amount} × ${h.ticksLeft}`).join(', '), key: true }
      : undefined,
  damagePreventionRemaining: (v, s, occ) =>
    (v as number) > 0 && occ.extra.damagePreventionUntilTurn === s.turn ? { label: 'Damage prevention', value: `${v} this turn`, key: true } : undefined,
  damagePreventionUntilTurn: () => undefined, // shown via damagePreventionRemaining
  stunnedUntilTurn: (v, s) => ((v as number) >= s.turn ? { label: 'Stunned', value: `Through turn ${v}`, key: true } : undefined),
  targetLockUntilTurn: (v, s) => ((v as number) >= s.turn ? { label: "Can't use targeted abilities", value: `Through turn ${v}`, key: true } : undefined),
  evasiveActive: (v) => (v ? { label: 'Evasive', value: 'Active', key: true } : undefined),
  evasiveNormalOnly: (v) => (v ? { label: 'Evasive', value: 'vs Normal-speed attacks' } : undefined),
  elementalVersatilityUsedTurn: (v, s) => ({ label: 'Elemental Versatility discount', value: v === s.turn ? 'Used this turn' : 'Available' }),
  inspiringLeaderUsedTurn: (v, s) => (v === s.turn ? { label: 'Inspiring Leader discount', value: 'Used this turn' } : undefined),
  rallyingWordsBonusTurn: (v, s) => (v === s.turn ? { label: 'Rallying Words', value: '+1 damage on next attack this turn', key: true } : undefined),
};

/** Every `extra` key the display knows how to show — the guard test checks each key the engine writes is in here. */
export const DISPLAYED_EXTRA_KEYS = new Set(Object.keys(PER_KEY));

/** A player-facing readout of everything this unit is tracking: its card-specific resources plus general statuses. */
export function trackedResources(state: GameState, occupant: BoardOccupant): TrackedItem[] {
  const items: TrackedItem[] = [];
  for (const [key, value] of Object.entries(occupant.extra)) {
    const render = PER_KEY[key];
    const item = render ? render(value, state, occupant) : { label: key, value: JSON.stringify(value) };
    if (item) items.push(item);
  }
  if (occupant.status.usedAbilitiesThisTurn.length > 0) items.push({ label: 'Abilities used this turn', value: `${occupant.status.usedAbilitiesThisTurn.length}` });
  if (occupant.status.pooledThisTurn) items.push({ label: 'Pooled this turn', value: "Can't act this turn" });
  return items;
}
