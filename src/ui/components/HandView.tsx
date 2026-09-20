export function HandView({
  handSize,
  canPlace,
  alreadyPlacedThisTurn,
  onPlaceChakraSource,
}: {
  handSize: number;
  canPlace: boolean;
  alreadyPlacedThisTurn: boolean;
  onPlaceChakraSource: () => void;
}) {
  return (
    <div className="hand-view">
      <span>Hand: {handSize} cards</span>
      <button type="button" disabled={!canPlace || alreadyPlacedThisTurn || handSize === 0} onClick={onPlaceChakraSource}>
        {alreadyPlacedThisTurn ? 'Already placed this turn' : 'Place card as Chakra source'}
      </button>
    </div>
  );
}
