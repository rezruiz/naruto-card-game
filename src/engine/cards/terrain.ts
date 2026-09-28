import { appendLog } from '../phases/phaseMachine';
import { registerHandCard } from './registry';
import type { HandCardDef } from './registry';

const akatsukiHideout: HandCardDef = {
  id: 'akatsuki-hideout',
  name: 'Akatsuki Hideout',
  cardType: 'terrain',
  cost: 0,
  speed: 'Normal',
  style: 'None',
  type: 'None',
  maxTargets: 0,
  synergy: ['Akatsuki'],
  // Its actual effect (Akatsuki-Synergy characters' Upkeep -1, min 0) lives
  // in upkeep.ts's payUpkeep, which reads terrainInPlay live every Upkeep
  // Phase — this resolve only handles entering play.
  resolve: (ctx) => {
    const p = ctx.state.players[ctx.player];
    const oldTerrain = p.terrainInPlay; // SPEC.md §10a: playing another Terrain replaces (discards) this one
    const played = { instanceId: `terrain-${ctx.player}-${Date.now()}`, defId: akatsukiHideout.id };
    const next = {
      ...ctx.state,
      players: {
        ...ctx.state.players,
        [ctx.player]: { ...p, terrainInPlay: played, discardPile: oldTerrain ? [...p.discardPile, oldTerrain] : p.discardPile },
      },
    };
    return appendLog(next, `${ctx.player} plays Akatsuki Hideout as their Terrain.`);
  },
};

registerHandCard(akatsukiHideout);
