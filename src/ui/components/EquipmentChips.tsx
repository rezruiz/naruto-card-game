import type { GameState } from '../../engine/types';
import { getHandCardDef } from '../../engine/cards/registry';
import { equipmentOn } from '../../engine/equipment';

/** Prototype: the Equipment attached to a Shinobi, one small tag each (hover for its text). */
export function EquipmentChips({ state, holderId }: { state: GameState; holderId: string }) {
  const gear = equipmentOn(state, holderId);
  if (gear.length === 0) return null;
  return (
    <div className="equip-chips" aria-label="Equipment">
      {gear.map((e) => {
        const def = getHandCardDef(e.defId);
        return (
          <span key={e.instanceId} className="equip-chip" title={def?.text?.replace(/^.*\n/, '')}>
            {def?.name ?? e.defId}
          </span>
        );
      })}
    </div>
  );
}
