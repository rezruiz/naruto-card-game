export function TurnControls({ onAdvancePhase }: { onAdvancePhase: () => void }) {
  return (
    <div className="turn-controls">
      <button type="button" onClick={onAdvancePhase}>
        Next Phase
      </button>
    </div>
  );
}
