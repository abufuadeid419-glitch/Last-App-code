// Google Maps URLs (embed works without an API key on web, iOS and Android).
export type MapType = "m" | "k" | "h"; // roadmap | satellite | hybrid

export const mapEmbedUrl = (lat: number, lng: number, t: MapType, z = 16) =>
  `https://maps.google.com/maps?q=${lat},${lng}&t=${t}&z=${z}&hl=ar&output=embed`;
export const mapOpenUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
export const mapDirectionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
