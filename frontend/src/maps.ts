// Google Maps URLs (embed works without an API key on web, iOS and Android).
export type MapType = "m" | "k" | "h"; // roadmap | satellite | hybrid

export const mapEmbedUrl = (lat: number, lng: number, t: MapType, z = 16) =>
  `https://maps.google.com/maps?q=${lat},${lng}&t=${t}&z=${z}&hl=ar&output=embed`;
export const mapOpenUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
export const mapDirectionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export type TrailPoint = { lat: number; lng: number; at: string };
export type TrailVisit = { lat: number; lng: number; invoice_no: string; customer_name: string };

// Total distance (km) along the GPS points.
export function trailKm(points: TrailPoint[]) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(h));
  }
  return km;
}

// Leaflet page drawing the day's path (OpenStreetMap/CARTO streets or Esri satellite; no API key).
// Map colours are fixed (identical in light and dark themes).
export function trailHtml(points: TrailPoint[], visits: TrailVisit[], satellite: boolean) {
  const data = JSON.stringify({ p: points.map((x) => [x.lat, x.lng, x.at]), v: visits.map((x) => [x.lat, x.lng, `${x.invoice_no} · ${x.customer_name}`]) }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{margin:0;height:100%;width:100%;background:#E8ECE9}.n{background:#F29900;color:#fff;border:2px solid #fff;border-radius:12px;width:20px;height:20px;line-height:20px;text-align:center;font:bold 11px sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.4)}</style></head>
<body><div id="m"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var D=${data};
function t(s){var d=new Date(s);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
var map=L.map('m',{zoomControl:true});
(${satellite}
  ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'})
  : L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:20,subdomains:'abcd',attribution:'© OpenStreetMap © CARTO'})
).addTo(map);
var ll=D.p.map(function(x){return [x[0],x[1]]}),b=ll.slice();
if(ll.length){
  L.polyline(ll,{color:'#1A73E8',weight:5,opacity:0.85}).addTo(map);
  L.circleMarker(ll[0],{radius:7,color:'#fff',weight:3,fillColor:'#1E8E3E',fillOpacity:1}).addTo(map).bindTooltip('بداية اليوم '+t(D.p[0][2]));
  L.circleMarker(ll[ll.length-1],{radius:9,color:'#fff',weight:3,fillColor:'#D93025',fillOpacity:1}).addTo(map).bindTooltip('آخر موقع '+t(D.p[D.p.length-1][2]),{permanent:true,direction:'top'});
}
D.v.forEach(function(v,i){L.marker([v[0],v[1]],{icon:L.divIcon({className:'',html:'<div class="n">'+(i+1)+'</div>',iconSize:[24,24],iconAnchor:[12,12]})}).addTo(map).bindPopup(v[2]);b.push([v[0],v[1]]);});
if(b.length>1)map.fitBounds(b,{padding:[36,36]});else if(b.length)map.setView(b[0],16);else map.setView([33.3,44.4],6);
</script></body></html>`;
}
