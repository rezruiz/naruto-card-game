import type { CharacterInstance } from '../../engine/types';

export function CharacterCard({
  character,
  canPool,
  onPoolOne,
}: {
  character: CharacterInstance;
  canPool: boolean;
  onPoolOne: (instanceId: string) => void;
}) {
  const { chakraPool } = character;
  const poolFull = chakraPool.current >= chakraPool.capacity;

  return (
    <div className="character-card">
      <div className="character-card__name">{character.name}</div>
      <div className="character-card__hp">
        HP {character.currentHP}/{character.maxHP}
      </div>
      <div className="character-card__pool">
        Pool {chakraPool.current}/{chakraPool.capacity}
      </div>
      <button type="button" disabled={!canPool || poolFull} onClick={() => onPoolOne(character.instanceId)}>
        Pool 1 Chakra
      </button>
    </div>
  );
}
