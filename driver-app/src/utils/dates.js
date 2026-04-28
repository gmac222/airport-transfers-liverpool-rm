export function getJobDate(b) {
  const d = b.fields['Outbound Date'];
  const t = b.fields['Outbound Time'] || '00:00';
  return d ? new Date(d + 'T' + t) : null;
}

export function getUrgency(b) {
  const jd = getJobDate(b);
  if (!jd) return 'future';
  const diffHrs = (jd - new Date()) / 36e5;
  if (diffHrs < 0 || diffHrs < 6) return 'urgent';
  if (diffHrs < 48) return 'soon';
  return 'future';
}

export function isToday(d) {
  const t = new Date();
  return d && d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export function isThisWeek(d) {
  if (!d) return false;
  const now = new Date();
  const end = new Date(now); end.setDate(now.getDate() + 7);
  return d >= now && d <= end;
}

export function formatDateLong(d) {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}
