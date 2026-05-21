// Haversine formula to calculate distance between two coordinates in km
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number) {
  return deg * (Math.PI / 180);
}

export const PRICE_PER_KM = 15; // ₹15 per km

export function calculatePrice(distanceKm: number): number {
  return Math.round(distanceKm * PRICE_PER_KM);
}

export interface GeocodingResult {
  display_name: string;
  lat: number;
  lon: number;
}

export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`
    );
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((d: any) => ({
      display_name: d.display_name,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
    }));
  } catch (err) {
    console.error("Geocoding error:", err);
    return [];
  }
}
