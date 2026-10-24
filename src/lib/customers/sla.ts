/** Business-day math shared by contract review (2 days) and paid watch (1 day). Weekends only — no holiday calendar. */

export function addBusinessDays(start: Date, days: number): Date {
  const cursor = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return cursor;
}

export function addCalendarDays(start: Date, days: number): Date {
  const cursor = new Date(start.getTime());
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor;
}

export function requestWindowKey(now = new Date()): string {
  const tenMinutes = 10 * 60 * 1000;
  return String(Math.floor(now.getTime() / tenMinutes));
}
