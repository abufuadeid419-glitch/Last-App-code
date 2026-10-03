import * as Location from "expo-location";

import { api } from "@/src/api";

let last: { lat: number; lng: number } | null = null;
let sub: Location.LocationSubscription | null = null;
let lastPost = 0;

export const getLastCoords = () => last;

function onPos(pos: Location.LocationObject) {
  last = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  if (Date.now() - lastPost > 55000) {
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

// One-off current position (asks permission if still undetermined).
export async function currentCoords() {
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    last = { lat: p.coords.latitude, lng: p.coords.longitude };
    return last;
  } catch {
    return last;
  }
}

export function stopTracking() {
  sub?.remove();
  sub = null;
}
