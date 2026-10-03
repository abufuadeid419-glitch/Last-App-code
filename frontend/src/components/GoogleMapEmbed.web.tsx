import { createElement } from "react";

import { mapEmbedUrl, MapType } from "@/src/maps";

// Web: the official Google Maps embed in an iframe (react-native-webview has no web support).
export function GoogleMapEmbed({ lat, lng, type, zoom = 16 }: { lat: number; lng: number; type: MapType; zoom?: number }) {
  return createElement("iframe", {
    key: `${lat},${lng},${type},${zoom}`,
    src: mapEmbedUrl(lat, lng, type, zoom),
    title: "Google Maps",
    "data-testid": "google-map-embed",
    allowFullScreen: true,
    loading: "eager",
    referrerPolicy: "no-referrer-when-downgrade",
    style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 },
  });
}
