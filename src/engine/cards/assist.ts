import { dealDamage } from '../combat';
import { appendLog } from '../phases/phaseMachine';
import { stackItemInfo } from './negation';
import { getHandCardDef, registerHandCard } from './registry';
import type { HandCardDef } from './registry';

function isTargetedAttack(info: ReturnType<typeof stackItemInfo>): boolean {
  return !!info && info.isDamaging;
}

// Impact Assist: Sasuke, Akatsuki (§10c/§13b). Assist cards ignore the
// normal Style-enabling requirement entirely — Style here is
// flavor/informational only, still relevant to Style-conditional text
// elsewhere but not an enabling gate for playing this card.
const chidoriInterception: HandCardDef = {
  id: 'chidori-interception',
  name: 'Chidori Interception',
  cardType: 'assist',
  cost: (ctx) => {
    const terrain = ctx.state.players[ctx.player].terrainInPlay;
    const terrainDef = terrain ? getHandCardDef(terrain.defId) : undefined;
    return terrainDef?.synergy?.includes('Akatsuki') ? 0 : 1;
  },
  speed: 'Reactive',
  style: 'Lightning',
  type: 'Ninjutsu',
  maxTargets: 0,
  legalityCheck: (ctx) =>
    ctx.state.stack.some((item) => item.controllerId !== ctx.player && isTargetedAttack(stackItemInfo(ctx.state, item))),
  resolve: (ctx) => {
    const item = ctx.state.stack.find((it) => it.controllerId !== ctx.player && isTargetedAttack(stackItemInfo(ctx.state, it)));
    if (!item) return appendLog(ctx.state, 'Chidori Interception finds no attack to punish.');
    // The original attack still resolves normally — it stays on the stack.
    return dealDamage(ctx.state, item.sourceInstanceId, 2).state;
  },
};

registerHandCard(chidoriInterception);
