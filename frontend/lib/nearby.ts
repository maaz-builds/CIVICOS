/**
 * Shared helpers for the Nearby Activity feature.
 *
 * Holds the category taxonomy shown in the filter chips and on the map
 * (plural display names sent to the backend, which matches them against the
 * singular stored issue types - see SupabaseService._category_matches), the
 * complaint-status metadata used for badges/popups, distance formatting,
 * and a few Hyderabad demo centres for when geolocation is unavailable.
 */

export interface CategoryDef {
  /** Stable id used for toggle state. */
  id: string;
  /** Display name shown in filter chips and sent to the backend. */
  label: string;
  emoji: string;
  /** Marker + accent colour (hex) used on the map. */
  color: string;
}

export const CATEGORY_FILTERS: CategoryDef[] = [
  { id: "garbage", label: "Garbage", emoji: "🗑️", color: "#22c55e" },
  { id: "potholes", label: "Potholes", emoji: "🕳️", color: "#f97316" },
  { id: "streetlights", label: "Streetlights", emoji: "💡", color: "#eab308" },
  { id: "water", label: "Water Leaks", emoji: "💧", color: "#0ea5e9" },
];

/** Fallback shown when an issue type does not map onto a known category. */
export const OTHER_CATEGORY: CategoryDef = {
  id: "other",
  label: "Other",
  emoji: "⚠️",
  color: "#94a3b8",
};

function categoryById(id: string): CategoryDef | undefined {
  return CATEGORY_FILTERS.find((c) => c.id === id);
}

/** Map a stored issue_type (e.g. "Broken Streetlight") onto a display category. */
export function categoryOfIssue(
  issueType: string | null | undefined
): CategoryDef {
  const label = (issueType ?? "").toLowerCase();
  if (/garbage|waste|litter/.test(label)) return categoryById("garbage")!;
  if (/pothole|road damage|crack/.test(label)) return categoryById("potholes")!;
  if (/street\s?light|lamp|pole/.test(label)) {
    return categoryById("streetlights")!;
  }
  if (/water|leak|drainage/.test(label)) return categoryById("water")!;
  return OTHER_CATEGORY;
}

/** Status -> hex colour (map popups) and label + badge classes (list UI). */
export const STATUS_COLOR: Record<string, string> = {
  submitted: "#60a5fa",
  assigned: "#fbbf24",
  "in progress": "#a78bfa",
  resolved: "#34d399",
};

export const STATUS_CHIP: Record<string, string> = {
  submitted: "bg-blue-500/15 text-blue-300 ring-blue-500/40",
  assigned: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  "in progress": "bg-violet-500/15 text-violet-300 ring-violet-500/40",
  resolved: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
};

export function statusLabel(status: string | null | undefined): string {
  const value = (status ?? "").toLowerCase();
  if (value === "in progress") return "In progress";
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "412 m" under a kilometre, "1.4 km" beyond. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/**
 * Hyderabad demo centres - shown when the browser refuses geolocation so
 * the map can still be explored at a hackathon demo. Coordinates are
 * approximate area centres (street level is not needed to demo radius
 * scanning).
 */
export const PRESET_CENTERS: { name: string; lat: number; lng: number }[] = [
  { name: "Charminar (old city)", lat: 17.3616, lng: 78.4747 },
  { name: "Central Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "HITEC City", lat: 17.4435, lng: 78.3772 },
  { name: "Gachibowli", lat: 17.4401, lng: 78.3489 },
  { name: "Banjara Hills", lat: 17.4204, lng: 78.4361 },
  { name: "Secunderabad", lat: 17.4399, lng: 78.4983 },
];
