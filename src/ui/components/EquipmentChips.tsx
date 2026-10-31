import type { GameState } from '../../engine/types';
import { getHandCardDef } from '../../engine/cards/registry';
import { equipmentOn } from '../../engine/equipment';
import { findOccupant } from '../../engine/board';
import { getHandCardText } from '../cardInfo';
import type { EffectInfo } from '../effectInfo';
import { InfoChip } from './InfoChip';

/** Prototype: the Equipment attached to a unit, one small tag each (click for its text). */
export function EquipmentChips({ state, holderId, onOpenInfo }: { state: GameState; holderId: string; onOpenInfo?: (info: EffectInfo) => void }) {
  const gear = equipmentOn(state, holderId);
  if (gear.length === 0) return null;
  return (
    <div className="equip-chips" aria-label="Equipment">
      {gear.map((e) => {
        const def = getHandCardDef(e.defId);
        const name = def?.name ?? e.defId;
        const info = { name, subtitle: `Equipment on ${findOccupant(state, holderId)?.occupant.name}`, text: getHandCardText(name) };
        return (
          <InfoChip key={e.instanceId} className="equip-chip" info={info} onOpen={onOpenInfo}>
            {name}
          </InfoChip>
        );
      })}
    </div>
  );
}
