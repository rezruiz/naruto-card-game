import type { PlayerState } from '../../engine/types';

export function PlayerHealthBar({ player, isActive }: { player: PlayerState; isActive: boolean }) {
  return (
    <div className={isActive ? 'player-panel player-panel--active' : 'player-panel'}>
      <h3>{player.id.toUpperCase()}</h3>
      <div>Health: {player.health}</div>
      <div>Chakra: {player.genericChakraAvailable}</div>
    </div>
  );
}
