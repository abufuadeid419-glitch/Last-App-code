import { createElement } from "react";

import { trailHtml, TrailPoint, TrailVisit } from "@/src/maps";

// Web: the day's movement path drawn with Leaflet in an iframe.
export function TrailMap({ points, visits, satellite }: { points: TrailPoint[]; visits: TrailVisit[]; satellite: boolean }) {
  const html = trailHtml(points, visits, satellite);
  return createElement("iframe", {
    key: html,
    srcDoc: html,
    title: "مسار الموزع",
    "data-testid": "trail-map",
    style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 },
  });
}
