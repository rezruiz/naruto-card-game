import { HEALTH_LOST_ON_DEFEAT, RANK_ORDER, UPKEEP_BY_RANK } from '../../engine/ranks';
import { SYNERGY_DISCOUNT_CAP, startingCharacterTreatment } from '../../engine/upkeep';
import { reinforcementTax } from '../../engine/playCharacter';

/** What a rank costs when it's your starting character (SPEC §6.5) — the normal upkeep otherwise. */
function startingUpkeepLabel(rank: (typeof RANK_ORDER)[number]): string {
  const t = startingCharacterTreatment(rank);
  if (!t) return String(UPKEEP_BY_RANK[rank]);
  return t.kind === 'grant' ? `+${t.amount} pooled` : String(t.amount);
}

const TAX_STEPS = [0, 1, 2, 3].map(reinforcementTax);

/**
 * A quick-reference card of the core numbers players look up mid-game:
 * per-rank Upkeep and Health lost on defeat, plus the handful of rules that
 * come up every turn. Collapsible so it stays out of the way.
 */
export function RulesReference() {
  return (
    <details className="rules-ref">
      <summary>Rules reference</summary>
      <table className="rules-ref__table">
        <thead>
          <tr>
            <th>Rank</th>
            <th title="Chakra paid each Upkeep">Upkeep</th>
            <th title="Upkeep for the character you chose at Setup">As starter</th>
            <th title="Health you lose when this character is defeated">Health lost</th>
          </tr>
        </thead>
        <tbody>
          {RANK_ORDER.map((rank) => (
            <tr key={rank}>
              <td>{rank}</td>
              <td>{UPKEEP_BY_RANK[rank]}</td>
              <td>{startingUpkeepLabel(rank)}</td>
              <td>{HEALTH_LOST_ON_DEFEAT[rank]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="rules-ref__list">
        <li>
          <strong>Synergy:</strong> −1 Upkeep per extra character sharing a Synergy tag, max −{SYNERGY_DISCOUNT_CAP} for your whole board. Discounts never take a character below 1 (free characters stay free).
        </li>
        <li>
          <strong>Character Deck draw:</strong> pay the tax ({TAX_STEPS.join(' → ')}, then stays at 8), look at 2, keep 1. Only paid manual draws raise the tax.
        </li>
        <li>
          <strong>Reinforcement:</strong> a C+ character defeated → optional draw at the current tax. Your last C+ falls → play a C+ from hand, or take a free draw. D-ranks trigger nothing.
        </li>
        <li>
          <strong>Board:</strong> max 5 characters. Missions: max 1 per character you control, played face down.
        </li>
        <li>
          <strong>Field Orientation:</strong> a character or summoned token can't use damaging abilities the turn it enters (Deidara's Clay Spiders excepted).
        </li>
        <li>
          <strong>Timing:</strong> damaging Normal-speed abilities are Combat only; healing/support abilities and Jutsu work in Main or Combat; Terrain, Missions and deck searches are Main only. Quick and Reactive follow their own speed.
        </li>
        <li>
          <strong>Health:</strong> start at 20; 0 loses. Drawing from an empty Hand Deck costs 3 Health.
        </li>
      </ul>
    </details>
  );
}
