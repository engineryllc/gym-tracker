export default function InstructionPanel({ exercise, nextExercise, onShowNext, showingNext }) {
  const displayed = showingNext ? nextExercise : exercise

  if (!displayed) return (
    <div className="instruction-panel instruction-empty">
      <div className="instruction-empty-text">No exercise data</div>
    </div>
  )

  return (
    <div className="instruction-panel">
      <div className="instruction-header">
        <div className="instruction-label">{showingNext ? 'NEXT UP' : 'NOW'}</div>
        <div className="instruction-name">{displayed.name}</div>
        {displayed.default_tempo && (
          <div className="instruction-tempo">TEMPO {displayed.default_tempo}</div>
        )}
      </div>

      <div className="instruction-media">
        {displayed.media_url ? (
          <img
            src={displayed.media_url}
            alt={displayed.name}
            className="instruction-img"
          />
        ) : (
          <div className="instruction-no-media">
            <div className="instruction-no-media-icon">📷</div>
            <div className="instruction-no-media-text">No media yet</div>
          </div>
        )}
      </div>

      {displayed.cue_text && (
        <div className="instruction-cues">
          <div className="instruction-cues-label">CUES</div>
          <div className="instruction-cues-text">{displayed.cue_text}</div>
        </div>
      )}

      {nextExercise && !showingNext && (
        <button className="instruction-next-btn" onClick={onShowNext}>
          Preview next: {nextExercise.name} →
        </button>
      )}
      {showingNext && (
        <button className="instruction-next-btn" onClick={onShowNext}>
          ← Back to current
        </button>
      )}
    </div>
  )
}
