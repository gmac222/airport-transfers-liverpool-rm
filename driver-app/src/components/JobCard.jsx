import { getJobDate, getUrgency } from '../utils/dates.js';

export default function JobCard({ booking, onTap }) {
  const f = booking.fields;
  const jd = getJobDate(booking);
  const urg = getUrgency(booking);
  const status = f['Status'] || 'Pending';
  const statusClass =
    status === 'Completed' || status === 'Archived' ? 'done'
    : status === 'Accepted' ? 'accepted'
    : 'pending';

  return (
    <button className={`card urg-${urg}`} onClick={onTap}>
      <div className="date-block">
        {jd ? (
          <>
            <div className="d-num">{jd.getDate()}</div>
            <div className="d-mon">{jd.toLocaleDateString('en-GB', { month: 'short' })}</div>
            <div className="d-time">{f['Outbound Time'] || ''}</div>
          </>
        ) : (
          <div className="d-num small">TBC</div>
        )}
      </div>
      <div className="body">
        <div className="name">{f['Customer Name'] || 'Unknown'}</div>
        <div className="route">
          <span className="from">{f['Home Address'] || '—'}</span>
          <span className="arrow">→</span>
          <span className="to">{f['Airport'] || '—'}</span>
        </div>
        <div className="meta">
          <span>📋 {f['Booking Ref'] || '—'}</span>
          <span>👥 {f['Passengers'] || 1}</span>
          <span>🧳 {f['Luggage'] || 0}</span>
          {f['Trip Type'] === 'return' && <span>🔄 Return</span>}
        </div>
      </div>
      <div className={`status-pill ${statusClass}`}>{status}</div>
    </button>
  );
}
