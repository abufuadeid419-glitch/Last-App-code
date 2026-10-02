import * as Location from "expo-location";

import { api } from "@/src/api";

let last: { lat: number; lng: number } | null = null;
let sub: Location.LocationSubscription | null = null;
let lastPost = 0;

export const getLastCoords = () => last;

function onPos(pos: Location.LocationObject) {
  last = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  if (Date.now() - lastPost > 120000) {
    lastPost = Date.now();
    api("/locations", { method: "POST", body: { ...last, accuracy: pos.coords.accuracy } }).catch(() => {});
  }
}

// Foreground tracking while the app is open (permission must already be granted).
export async function startTracking() {
  if (sub) return;
  const perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted) return;
  try {
    const known = await Location.getLastKnownPositionAsync();
    if (known) onPos(known);
    sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 60000, distanceInterval: 50 },
      onPos,
    );
  } catch {}
}

export function stopTracking() {
  sub?.remove();
  sub = null;
}
