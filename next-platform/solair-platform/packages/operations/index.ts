export function normalizePhilippineMobile(input: string): string {
  const cleaned = input.trim().replace(/[ ()-]/g, '');
  const value = /^09\d{9}$/.test(cleaned) ? '+63' + cleaned.slice(1)
    : /^639\d{9}$/.test(cleaned) ? '+' + cleaned : cleaned;
  if (!/^\+639\d{9}$/.test(value)) throw new Error('Use a Philippine mobile number: 09XX XXX XXXX or +63 9XX XXX XXXX.');
  return value;
}
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function csvRows(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return [keys.map(csvCell).join(','), ...rows.map(row => keys.map(key => csvCell(row[key])).join(','))].join('\r\n');
}
