export function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

export function formatTime(value?: string | null) {
  if (!value) return "--:--";
  return value.slice(0, 5);
}

export function truncateId(value: string) {
  return `${value.slice(0, 8)}...`;
}

export function weekdayLabel(weekday: number) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday] ?? `Day ${weekday}`;
}
