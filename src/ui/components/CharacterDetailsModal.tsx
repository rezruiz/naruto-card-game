import { getCharacterDef } from '../../engine/characters/registry';
import { retreatCost } from '../../engine/retreat';
import { findOccupant, isCharacter } from '../../engine/board';
import type { GameState } from '../../engine/types';
import { getCharacterCardText } from '../cardInfo';
import { DetailsModal } from './DetailsModal';

/** The full card: printed text (from SPEC.md), live stats, and — for the controlling player only — every action the old full-size card offered. */
export function CharacterDetailsModal({
  state,
  instanceId,
  canAct,
  onClose,
  onPool,
  onActivate,
  onRetreat,
  onReturnFromRetreat,
  manual,
}: {
  state: GameState;
  instanceId: string;
  /** True only for the controlling player during their own Main Phase. */
  canAct: boolean;
  onClose: () => void;
  onPool: (instanceId: string, amount: number) => void;
  onActivate: (instanceId: string, abilityId: string, maxTargets: number) => void;
  onRetreat: (instanceId: string) => void;
  onReturnFromRetreat: (instanceId: string) => void;
  /** Trust mode: Cockatrice-style manual corrections, available on either side's cards. */
  manual?: {
    onAdjustHp: (instanceId: string, delta: number) => void;
    onDamage: (instanceId: string, amount: number) => void;
    onAdjustPool: (instanceId: string, delta: number) => void;
    onToggleStatus: (instanceId: string, status: 'disabled' | 'retreated') => void;
  };
}) {
  const found = findOccupant(state, instanceId);
  if (!found) return null;
  const occupant = found.occupant;
  const text = getCharacterCardText(occupant.defId);

  const manualTools = manual && (
    <div className="manual-tools">
      <span className="manual-tools__title">Manual adjustments</span>
      <span className="manual-tools__row">
        HP
        <button type="button" onClick={() => manual.onAdjustHp(instanceId, -1)}>
          −1
        </button>
        <button type="button" onClick={() => manual.onAdjustHp(instanceId, 1)}>
          +1
        </button>
        <button type="button" title="Runs the full damage rules: prevention, defeat effects, Health loss" onClick={() => manual.onDamage(instanceId, 1)}>
          Deal 1 damage
        </button>
      </span>
      <span className="manual-tools__row">
        Pool
        <button type="button" onClick={() => manual.onAdjustPool(instanceId, -1)}>
          −1
        </button>
        <button type="button" onClick={() => manual.onAdjustPool(instanceId, 1)}>
          +1
        </button>
      </span>
      <span className="manual-tools__row">
        <button type="button" onClick={() => manual.onToggleStatus(instanceId, 'disabled')}>
          Toggle Disabled
        </button>
        <button type="button" onClick={() => manual.onToggleStatus(instanceId, 'retreated')}>
          Toggle Retreated
        </button>
      </span>
    </div>
  );

  if (!isCharacter(occupant)) {
    return (
      <DetailsModal title={occupant.name} subtitle={`Token · HP ${occupant.currentHP}/${occupant.maxHP}`} text={text} onClose={onClose}>
        {manualTools}
      </DetailsModal>
    );
  }

  const def = getCharacterDef(occupant.defId);
  const abilities = def ? [...def.abilities, ...(def.ultimate ? [def.ultimate] : [])] : [];
  const { chakraPool } = occupant;
  const capacity = Number.isFinite(chakraPool.capacity) ? chakraPool.capacity : '∞';
  const status = [occupant.status.retreated && 'Retreated', occupant.status.disabled && 'Disabled'].filter(Boolean).join(', ');
  const closeThen = (fn: () => void) => () => {
    onClose();
    fn();
  };
  const available = state.players[found.player].genericChakraAvailable;
  const poolRoom = Number.isFinite(chakraPool.capacity) ? chakraPool.capacity - chakraPool.current : Infinity;

  return (
    <DetailsModal
      title={occupant.name}
      subtitle={`Rank ${occupant.rank} · HP ${occupant.currentHP}/${occupant.maxHP} · Pool ${chakraPool.current}/${capacity}${status ? ` · ${status}` : ''}`}
      text={text}
      onClose={onClose}
    >
      {canAct ? (
        <>
          {!occupant.status.retreated && poolRoom > 0 && (
            <>
              <button type="button" disabled={available < 1} title="Move 1 available Chakra into this character's Pool" onClick={() => onPool(instanceId, 1)}>
                Pool 1 Chakra
              </button>
              {Math.min(available, poolRoom) > 1 && (
                <button type="button" title="Move all the available Chakra that fits into this character's Pool" onClick={() => onPool(instanceId, Math.min(available, poolRoom))}>
                  Pool {Math.min(available, poolRoom)}
                </button>
              )}
            </>
          )}
          {occupant.status.retreated ? (
            <button type="button" onClick={closeThen(() => onReturnFromRetreat(instanceId))}>
              Return from Retreat
            </button>
          ) : (
            <button type="button" title="Retreat: immune to damage and targeting, but can't act, until you return" onClick={closeThen(() => onRetreat(instanceId))}>
              Retreat ({retreatCost(occupant.rank)} Chakra)
            </button>
          )}
          {!occupant.status.retreated &&
            abilities.map((a) => (
              <button key={a.id} type="button" onClick={closeThen(() => onActivate(instanceId, a.id, a.maxTargets ?? 1))}>
                {a.isUltimate ? '★ ' : ''}Activate: {a.name}
              </button>
            ))}
        </>
      ) : (
        <span className="details-modal__note">Actions are available to the controlling player.</span>
      )}
      {manualTools}
    </DetailsModal>
  );
}
