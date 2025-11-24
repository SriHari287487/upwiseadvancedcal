// Small, fast date helpers with memoization for month matrices

// Normalize to midnight
export const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n);
  return x;
};

// Compare by Y/M/D (no time zone issues once normalized)
export const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Formatters
export const monthLong = (d) =>
  new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
export const monthShortUpper = (d) =>
  new Intl.DateTimeFormat("en-US", { month: "short" })
    .format(d)
    .toUpperCase();

// ----- Month matrix (Monday-first) with caching -----
//
// We compute a 6x7 (42 cells) grid for the month view. Because users rarely
// flip across hundreds of months in one session, a tiny in-memory cache
// gives O(1) reuse on navigation and re-renders.

const monthCache = new Map(); // key: "YYYY-MM" -> weeks[][]

export const getMonthMatrixMondayStart = (dateInput) => {
  const date = startOfDay(dateInput);
  const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
  const cached = monthCache.get(key);
  if (cached) return cached;

  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  // JS: 0=Sun..6=Sat; convert to Monday-start (Mon=0,...,Sun=6)
  const firstWeekdayMon = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastOfMonth.getDate();

  const cells = [];

  // Leading previous-month days
  for (let i = 0; i < firstWeekdayMon; i++) {
    const d = new Date(firstOfMonth);
    d.setDate(firstOfMonth.getDate() - (firstWeekdayMon - i));
    cells.push({ date: d, outside: true });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      date: new Date(date.getFullYear(), date.getMonth(), i),
      outside: false,
    });
  }

  // Fill to complete the first week
  while (cells.length % 7 !== 0) {
    const d = new Date(lastOfMonth);
    d.setDate(lastOfMonth.getDate() + (cells.length - (firstWeekdayMon + daysInMonth)));
    cells.push({ date: d, outside: true });
  }

  // Ensure 6 rows (42 cells) like the reference UI
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: addDays(last, 1), outside: true });
  }

  // Chunk into weeks
  const weeks = [];
  for (let i = 0; i < 42; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  monthCache.set(key, weeks);
  return weeks;
};
