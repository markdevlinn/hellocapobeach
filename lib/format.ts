export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function eventDate(iso: string): { month: string; day: string; line: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString(undefined, { month: "short" }),
    day: String(d.getDate()),
    line: d.toLocaleDateString(undefined, { weekday: "long" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export function money(cents: number): string {
  const dollars = cents / 100;
  return "$" + (Number.isInteger(dollars) ? dollars.toLocaleString() : dollars.toFixed(2));
}

export const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  safety: "Safety",
  lost_found: "Lost and Found",
  recommendations: "Recommendations",
};

export const KIND_LABEL: Record<string, string> = { for_sale: "For sale", free: "Free", wanted: "Wanted" };
