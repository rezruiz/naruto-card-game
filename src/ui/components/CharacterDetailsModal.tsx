import { useState } from 'react';
import { getCharacterDef, getTokenDef } from '../../engine/characters/registry';
import { retreatCost } from '../../engine/retreat';
import { findOccupant, hasFieldOrientation, isCharacter } from '../../engine/board';
import type { AbilityDef } from '../../engine/abilities';
import { trackedResources } from '../../engine/characters/progressText';
import type { GameState } from '../../engine/types';
import { abilityCostText, abilityText, traitLines } from '../abilityText';
import { getCharacterCardText, getTokenCardText } from '../cardInfo';
import { DetailsModal } from './DetailsModal';

/** Speed/Style/Type/uses tags for an ability box — only the ones that tell the player something (Normal speed and Style: None are the defaults). */
function abilityTags(a: AbilityDef): string[] {
  return [
    a.isForbidden ? 'Forbidden' : a.isUltimate ? 'Ultimate' : '',
    a.speed !== 'Normal' ? a.speed : '',
    a.style !== 'None' ? a.style : '',
    a.type !== 'None' ? a.type : '',
  ].filter(Boolean);
}

/**
 * One ability, as a single box: its name and tags, then "[Cost] — [Text]"
 * in condensed wording. When the viewer can act, the whole box is the
 * button that uses it; otherwise it's the same box, read-only.
 */
function AbilityBox({ state, instanceId, ability, usable, onUse }: { state: GameState; instanceId: string; ability: AbilityDef; usable: boolean; onUse: () => void }) {
  const tags = abilityTags(ability);
  const content = (
    <>
      <span className="ability-box__head">
        <span className="ability-box__name">
          {ability.isUltimate ? '★ ' : ''}
          {ability.name}
        </span>
        {tags.length > 0 && <span className="ability-box__tags">{tags.join(' · ')}</span>}
      </span>
      <span className="ability-box__body">
        <strong className="ability-box__cost">{abilityCostText(state, instanceId, ability)}</strong> — {abilityText(ability)}
      </span>
    </>
  );
  const box =
    usable && !ability.triggeredOnly ? (
      <button type="button" className="ability-box ability-box--usable" title={`Use ${ability.name}`} onClick={onUse}>
        {content}
      </button>
    ) : (
      <div className="ability-box">{content}</div>
    );
  if (!ability.summons?.length) return box;
  return (
    <div className="ability-box-wrap">
      {box}
      <SummonDetails summons={ability.summons} />
    </div>
  );
}

/** What a summoning ability creates — each token's own card text, folded behind a Details button. */
function SummonDetails({ summons }: { summons: { defId: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="summon-details">
      <button type="button" className="summon-details__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide details' : `Details: ${summons.map((s) => s.name).join(', ')}`}
      </button>
      {open &&
        summons.map((s) => (
          <div key={s.defId} className="summon-details__text">
            <strong>{s.name}</strong>
            <div>{getTokenCardText(s.defId, s.name)}</div>
          </div>
        ))}
    </div>
  );
}

/** A character's or token's card: live stats, tracked resources, short traits, and its abilities as clickable boxes. The full printed wording is folded away under "Full rules text". */
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
  const character = isCharacter(occupant) ? occupant : null;
  const fullText = character ? getCharacterCardText(occupant.defId) : getTokenCardText(occupant.defId, occupant.name);
  const tracked = trackedResources(state, occupant);
  const traits = traitLines(occupant.defId);
  const charDef = character ? getCharacterDef(occupant.defId) : undefined;
  const abilities = character ? (charDef ? [...charDef.abilities, ...(charDef.ultimate ? [charDef.ultimate] : [])] : []) : (getTokenDef(occupant.defId)?.abilities ?? []);
  const retreated = occupant.status.retreated;
  const usable = canAct && !retreated;
  const closeThen = (fn: () => void) => () => {
    onClose();
    fn();
  };

  const pool = occupant.chakraPool;
  const capacity = pool ? (Number.isFinite(pool.capacity) ? pool.capacity : '∞') : undefined;
  const status = [retreated && 'Retreated', occupant.status.disabled && 'Disabled', hasFieldOrientation(state, occupant) && 'Field Orientation (no damaging abilities this turn)'].filter(Boolean).join(', ');
  const subtitle = [
    character ? `Rank ${character.rank}` : 'Token',
    `HP ${occupant.currentHP}/${occupant.maxHP}`,
    pool ? `Pool ${pool.current}/${capacity}` : '',
    status,
  ]
    .filter(Boolean)
    .join(' · ');

  const available = state.players[found.player].genericChakraAvailable;
  // Any unit with a Pool of its own can be pooled into — characters, and Pain's Path tokens (Rinnegan Reservoir).
  const poolRoom = pool ? (Number.isFinite(pool.capacity) ? pool.capacity - pool.current : Infinity) : 0;

  return (
    <DetailsModal title={occupant.name} subtitle={subtitle} hideText onClose={onClose}>
      <div className="card-details">
        {tracked.length > 0 && (
          <div className="tracked-list">
            <span className="tracked-list__title">Tracked</span>
            {tracked.map((t, i) => (
              <span className="tracked-list__row" key={`${t.label}-${i}`}>
                {t.label}: <strong>{t.value}</strong>
              </span>
            ))}
          </div>
        )}

        {traits.length > 0 && (
          <ul className="trait-list">
            {traits.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}

        {abilities.length > 0 && (
          <div className="ability-list">
            {usable && <span className="ability-list__hint">Click an ability to use it.</span>}
            {abilities.map((a) => (
              <AbilityBox
                key={a.id}
                state={state}
                instanceId={instanceId}
                ability={a}
                usable={usable}
                onUse={closeThen(() => onActivate(instanceId, a.id, a.maxTargets ?? 1))}
              />
            ))}
          </div>
        )}

        {canAct && (character || poolRoom > 0) && (
          <div className="card-details__actions">
            {!retreated && poolRoom > 0 && (
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
            {character &&
              (retreated ? (
                <button type="button" onClick={closeThen(() => onReturnFromRetreat(instanceId))}>
                  Return from Retreat
                </button>
              ) : (
                <button type="button" title="Retreat: immune to damage and targeting, but can't act, until you return" onClick={closeThen(() => onRetreat(instanceId))}>
                  Retreat ({retreatCost(character.rank)} Chakra)
                </button>
              ))}
          </div>
        )}
        {!canAct && abilities.length > 0 && <span className="details-modal__note">Abilities can be used by the controlling player.</span>}
        {canAct && retreated && <span className="details-modal__note">Retreated — return from Retreat to use abilities.</span>}

        {fullText && (
          <details className="full-rules">
            <summary>Full rules text</summary>
            <pre className="full-rules__text">{fullText}</pre>
          </details>
        )}

        {manual && (
          <div className="manual-tools">
            <span className="manual-tools__title">Manual adjustments</span>
            {character && found.zone === 'back' && (
              <span className="manual-tools__row">
                <button
                  type="button"
                  title="Undo playing this character: back to hand, resetting its damage, Pool and tracked resources (you can also drag it onto your hand)"
                  onClick={closeThen(() => manual.onReturnToHand(instanceId))}
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
        )}
      </div>
    </DetailsModal>
  );
}
