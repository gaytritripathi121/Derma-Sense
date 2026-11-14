function formatIcsUtc(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcsText(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function generateAppointmentIcs({
  title = 'Dermatology Skin Screening Follow-Up',
  dateTimeIso,
  durationMinutes = 45,
  location = 'Dermatology Clinic',
  notes = 'Bring DermaSense AI screening PDF summary and ABCDE observation log.',
}) {
  const start = new Date(dateTimeIso);
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid appointment date/time provided for calendar export.');
  }
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();
  const uid = `dermasense-${start.getTime()}-${Math.random().toString(36).slice(2, 8)}@dermasense.local`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DermaSense AI//Safe Corner Companion//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(notes)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Dermatology follow-up appointment tomorrow',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}
