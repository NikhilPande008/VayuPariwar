export interface IndianCity {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

export const INDIAN_CITIES: readonly IndianCity[] = [
  { id: "delhi", name: "Delhi", state: "Delhi NCR", lat: 28.6139, lon: 77.209 },
  { id: "pune", name: "Pune", state: "Maharashtra", lat: 18.5204, lon: 73.8567 },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", lat: 19.076, lon: 72.8777 },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", lat: 12.9716, lon: 77.5946 },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", lat: 22.5726, lon: 88.3639 },
  { id: "lucknow", name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lon: 80.9462 },
  { id: "gurugram", name: "Gurugram", state: "Haryana", lat: 28.4595, lon: 77.0266 },
  { id: "noida", name: "Noida", state: "Uttar Pradesh", lat: 28.5355, lon: 77.391 },
] as const;

/**
 * Looks up a supported Indian city by its slug ID or display name (case-insensitive).
 */
export function findCityByIdOrName(query: string): IndianCity | undefined {
  const normalized = query.trim().toLowerCase();
  return INDIAN_CITIES.find(
    (c) => c.id === normalized || c.name.toLowerCase() === normalized
  );
}
