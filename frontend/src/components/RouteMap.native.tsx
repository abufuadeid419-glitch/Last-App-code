import { View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import { radius, useTheme } from "@/src/theme";

type Stop = { lat?: number | null; lng?: number | null; customer_name: string; status?: string };

export function RouteMap({ stops }: { stops: Stop[] }) {
  const { colors } = useTheme();
  const pts = stops
    .map((s, i) => ({ ...s, n: i + 1 }))
    .filter((s) => s.lat != null && s.lng != null) as (Stop & { n: number; lat: number; lng: number })[];
  if (!pts.length) return null;
  return (
    <View style={{ height: 260, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
      <MapView testID="route-map" style={{ flex: 1 }} initialRegion={{ latitude: pts[0].lat, longitude: pts[0].lng, latitudeDelta: 0.15, longitudeDelta: 0.15 }}>
        <Polyline coordinates={pts.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.brandPrimary} strokeWidth={3} />
        {pts.map((p) => (
          <Marker
            key={`${p.n}`}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={`${p.n}. ${p.customer_name}`}
            pinColor={p.status === "VISITED" ? colors.success : p.status === "SKIPPED" ? colors.error : colors.brandPrimary}
          />
        ))}
      </MapView>
    </View>
  );
}
