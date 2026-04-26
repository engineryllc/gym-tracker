import { getTodayName } from '../utils/progression'

export default function SessionSelect({ onSelect }) {
  const today = getTodayName()

  return (
    <div className="session-select">
      <div className="session-bg" />
      <div className="session-content">
        <div className="session-header">
          <div className="session-day">{today}</div>
          <h1 className="session-title">GYM<span>TRACKER</span></h1>
          <p className="session-sub">Who's training today?</p>
        </div>
        <div className="session-buttons">
          <button className="session-btn btn-andy" onClick={() => onSelect('andy')}>
            <span className="btn-label">Andy</span>
            <span className="btn-sub">Solo session</span>
          </button>
          <button className="session-btn btn-both" onClick={() => onSelect('both')}>
            <span className="btn-label">Both</span>
            <span className="btn-sub">Partner workout</span>
          </button>
          <button className="session-btn btn-ali" onClick={() => onSelect('ali')}>
            <span className="btn-label">Ali</span>
            <span className="btn-sub">Solo session</span>
          </button>
        </div>
      </div>
    </div>
  )
}
