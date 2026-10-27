import { useState } from 'react';
import { findOccupant, isCharacter } from '../../engine/board';
import { otherPlayer } from '../../engine/phases/phaseMachine';
import { attackBlocker, isShinobi, shinobiDamage, targetsLeader } from '../../engine/shinobi';
import type { BoardOccupant, GameAction, GameState, PlayerId } from '../../engine/types';

// Prototype rules: Shinobi combat (engine/shinobi.ts). The active player picks
// targets for their Shinobi and confirms; then the defending player chooses
// which of their Shinobi stand in front of an attacked Leader.

function unitLabel(u: BoardOccupant): string {
  return isShinobi(u) ? `${u.name} (${shinobiDamage(u)}/${u.currentHP})` : `${u.name} (Leader, ${u.currentHP} HP)`;
}

export function ShinobiCombatPanel({
  state,
  isMyBoard,
  dispatch,
}: {
  state: GameState;
  isMyBoard: (player: PlayerId) => boolean;
  dispatch: (action: GameAction) => void;
}) {
  const [targets, setTargets] = useState<Record<string, string>>({});
  const attacker = state.activePlayer;
  const defender = otherPlayer(attacker);
  const combat = state.shinobiCombat;

  if (combat?.step === 'defend') {
    const myDefense = isMyBoard(defender);
    const mine = state.players[defender].frontRow.filter((t) => isShinobi(t) && !t.status.disabled) as BoardOccupant[];
    return (
      <div className="decision-panel shinobi-combat">
        <strong>Shinobi attacks — {defender.toUpperCase()} chooses defenders</strong>
        {combat.attacks.map((a) => {
          const atk = findOccupant(state, a.attackerId)?.occupant;
          const tgt = findOccupant(state, a.targetId)?.occupant;
          if (!atk || !tgt) return null;
          const canDefend = targetsLeader(state, a);
          const taken = new Set(combat.attacks.filter((o) => o.attackerId !== a.attackerId && o.defenderId).map((o) => o.defenderId));
          return (
            <div key={a.attackerId} className="shinobi-combat__row">
              <span>
                {unitLabel(atk)} → {tgt.name}
              </span>
              {canDefend ? (
                myDefense ? (
                  <select
                    value={a.defenderId ?? ''}
                    onChange={(e) => dispatch({ type: 'ASSIGN_SHINOBI_DEFENDER', attackerId: a.attackerId, defenderId: e.target.value || null })}
                  >
                    <option value="">No defender</option>
                    {mine
                      .filter((d) => !taken.has(d.instanceId))
                      .map((d) => (
                        <option key={d.instanceId} value={d.instanceId}>
                          {unitLabel(d)}
                        </option>
                      ))}
                  </select>
                ) : (
                  <em>{a.defenderId ? `defended by ${findOccupant(state, a.defenderId)?.occupant.name}` : 'undefended so far'}</em>
                )
              ) : (
                <em>Shinobi vs Shinobi — can't be defended</em>
              )}
            </div>
          );
        })}
        {myDefense ? (
          <button type="button" onClick={() => dispatch({ type: 'CONFIRM_SHINOBI_DEFENSE' })}>
            Confirm defenders
          </button>
        ) : (
          <span>Waiting for {defender.toUpperCase()} to choose defenders…</span>
        )}
      </div>
    );
  }

  if (state.phase !== 'Combat' || !isMyBoard(attacker)) return null;
  const myShinobi = state.players[attacker].frontRow.filter((t) => isShinobi(t)) as BoardOccupant[];
  if (myShinobi.length === 0) return null;
  const enemyTargets = [
    ...state.players[defender].backRow.filter((c): c is NonNullable<typeof c> => !!c && isCharacter(c) && !c.status.retreated),
    ...state.players[defender].frontRow.filter((t): t is NonNullable<typeof t> => !!t && (t.extra.painPath === true || isShinobi(t))),
  ] as BoardOccupant[];
  const declared = combat?.attacks ?? [];

  return (
    <div className="decision-panel shinobi-combat">
      <strong>Shinobi attacks</strong>
      {myShinobi.map((s) => {
        const attack = declared.find((a) => a.attackerId === s.instanceId);
        if (attack) {
          return (
            <div key={s.instanceId} className="shinobi-combat__row">
              <span>
                {unitLabel(s)} → {findOccupant(state, attack.targetId)?.occupant.name}
              </span>
              <button type="button" onClick={() => dispatch({ type: 'CANCEL_SHINOBI_ATTACK', attackerId: s.instanceId })}>
                ✕
              </button>
            </div>
          );
        }
        const blocker = attackBlocker(state, s.instanceId);
        const chosen = targets[s.instanceId] ?? enemyTargets[0]?.instanceId ?? '';
        return (
          <div key={s.instanceId} className="shinobi-combat__row">
            <span>{unitLabel(s)}</span>
            {blocker ? (
              <em>{blocker}</em>
            ) : enemyTargets.length === 0 ? (
              <em>No enemy to attack</em>
            ) : (
              <>
                <select value={chosen} onChange={(e) => setTargets({ ...targets, [s.instanceId]: e.target.value })}>
                  {enemyTargets.map((t) => (
                    <option key={t.instanceId} value={t.instanceId}>
                      {unitLabel(t)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => dispatch({ type: 'DECLARE_SHINOBI_ATTACK', attackerId: s.instanceId, targetId: chosen })}>
                  Attack
                </button>
              </>
            )}
          </div>
        );
      })}
      {declared.length > 0 && (
        <button type="button" onClick={() => dispatch({ type: 'CONFIRM_SHINOBI_ATTACKS' })}>
          Confirm {declared.length} attack{declared.length === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
