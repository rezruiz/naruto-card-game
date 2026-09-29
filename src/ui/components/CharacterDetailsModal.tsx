import { getCharacterDef, getTokenDef } from '../../engine/characters/registry';
import { retreatCost } from '../../engine/retreat';
import { findOccupant, isCharacter } from '../../engine/board';
import { resolveCost, type AbilityDef } from '../../engine/abilities';
import { trackedResources } from '../../engine/characters/progressText';
import type { GameState } from '../../engine/types';
import { getCharacterCardText, getTokenCardText } from '../cardInfo';
import { DetailsModal } from './DetailsModal';

/** "N Chakra" for a fixed cost (including this turn's first-ability discount, if it applies); a variable cost is spelled out as such rather than guessed before targets/choices are known. */
export function abilityCostLabel(state: GameState, instanceId: string, ability: AbilityDef): string {
  if (typeof ability.cost !== 'number') return 'variable cost';
  return `${resolveCost(ability, { state, sourceInstanceId: instanceId, targetInstanceIds: [] })} Chakra`;
}

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
    onReturnToHand: (instanceId: string) => void;
  };
}) {
  const found = findOccupant(state, instanceId);
  if (!found) return null;
  const occupant = found.occupant;
  // A token shows only its own printed text, not its creator's whole card.
  const text = isCharacter(occupant) ? getCharacterCardText(occupant.defId) : getTokenCardText(occupant.defId, occupant.name);
  const tracked = trackedResources(state, occupant);

  const trackedList = tracked.length > 0 && (
    <div className="tracked-list">
      <span className="tracked-list__title">Tracked</span>
      {tracked.map((t, i) => (
        <span className="tracked-list__row" key={`${t.label}-${i}`}>
          {t.label}: <strong>{t.value}</strong>
        </span>
      ))}
    </div>
  );

  const manualTools = manual && (
    <div className="manual-tools">
      <span className="manual-tools__title">Manual adjustments</span>
      {isCharacter(occupant) && found.zone === 'back' && (
        <span className="manual-tools__row">
          <button
            type="button"
            title="Undo playing this character: back to hand, resetting its damage, Pool and tracked resources (you can also drag it onto your hand)"
            onClick={() => {
              onClose();
              manual.onReturnToHand(instanceId);
            }}
          >
            Return to hand
          </button>
        </span>
      )}
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

  const tokenAbilities = isCharacter(occupant) ? [] : (getTokenDef(occupant.defId)?.abilities ?? []);
  if (!isCharacter(occupant)) {
    return (
      <DetailsModal
        title={occupant.name}
        subtitle={`Token · HP ${occupant.currentHP}/${occupant.maxHP}${occupant.chakraPool ? ` · Pool ${occupant.chakraPool.current}/${occupant.chakraPool.capacity}` : ''}`}
        text={text}
        onClose={onClose}
      >
        {trackedList}
        {canAct ? (
          tokenAbilities.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onClose();
                onActivate(instanceId, a.id, a.maxTargets ?? 1);
              }}
            >
              {a.isUltimate ? '★ ' : ''}Activate: {a.name} ({abilityCostLabel(state, instanceId, a)})
            </button>
          ))
        ) : tokenAbilities.length > 0 ? (
          <span className="details-modal__note">Actions are available to the controlling player.</span>
        ) : null}
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
      {trackedList}
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
                {a.isUltimate ? '★ ' : ''}Activate: {a.name} ({abilityCostLabel(state, instanceId, a)})
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
