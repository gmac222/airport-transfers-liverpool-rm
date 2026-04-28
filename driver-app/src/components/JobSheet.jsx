import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { driverAction } from '../api.js';
import { formatDateLong } from '../utils/dates.js';

const ACTION_LABELS = {
  'on-the-way': '🚗 On the way',
  'arrived': '📍 Arrived',
  'complete-job': '✓ Complete',
  'close-job': '📦 Archive + review'
};

function actionsForStatus(status) {
  // Mirrors what driver-action.html exposes today.
  switch (status) {
    case 'Pending':
    case 'Accepted':
      return ['on-the-way', 'arrived', 'complete-job'];
    case 'Completed':
      return ['close-job'];
    default:
      return [];
  }
}

export default function JobSheet({ booking, onClose, onAfterAction }) {
  const f = booking.fields;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const haptic = async () => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    }
  };

  const act = async (action) => {
    setBusy(action);
    setError('');
    haptic();
    try {
      await driverAction(f['Booking Ref'], action);
      onAfterAction();
    } catch (err) {
      setError(err.message || 'Action failed');
      setBusy('');
    }
  };

  const phone = (f['Customer Phone'] || '').replace(/\s+/g, '');
  const status = f['Status'] || 'Pending';
  const mapsQuery = encodeURIComponent(f['Home Address'] || '');
  const actions = actionsForStatus(status);

  const rows = [
    ['Customer', f['Customer Name']],
    ['Phone', f['Customer Phone']],
    ['Pickup', f['Home Address']],
    ['Airport', f['Airport']],
    ['Outbound', f['Outbound Date'] ? `${formatDateLong(new Date(f['Outbound Date']))} · ${f['Outbound Time'] || '—'}` : '—'],
    ['Outbound Flight', f['Outbound Flight']],
    f['Trip Type'] === 'return' ? ['Return', `${f['Return Date'] || '—'} · ${f['Return Time'] || '—'}`] : null,
    f['Trip Type'] === 'return' ? ['Return Flight', f['Return Flight']] : null,
    ['Direction',
      f['Oneway Direction'] === 'from' ? 'From Airport' :
      f['Oneway Direction'] === 'to' ? 'To Airport' :
      f['Trip Type'] === 'return' ? 'Return Trip' : '—'],
    ['Passengers', f['Passengers']],
    ['Luggage', f['Luggage']],
    ['Notes', f['Notes']]
  ].filter(Boolean);

  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div>
            <div className="sheet-ref">{f['Booking Ref'] || '—'}</div>
            <div className="sheet-status">{status}</div>
          </div>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="sheet-body">
          {error && <div className="error">{error}</div>}
          {rows.map(([k, v]) => (
            <div className="row" key={k}>
              <div className="k">{k}</div>
              <div className="v">{v || '—'}</div>
            </div>
          ))}
        </div>

        <div className="sheet-actions">
          {phone && (
            <a className="btn outline" href={`tel:${phone}`}>📞 Call</a>
          )}
          {mapsQuery && (
            <a
              className="btn outline"
              href={`https://maps.google.com/?q=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
            >🗺️ Map</a>
          )}
          {actions.map((a) => (
            <button
              key={a}
              className="btn primary"
              disabled={!!busy}
              onClick={() => act(a)}
            >
              {busy === a ? '…' : ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
