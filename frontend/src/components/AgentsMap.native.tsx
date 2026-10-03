import { useState } from "react";
import { View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { money } from "@/src/api";
import { AgentLocationRow } from "@/src/components/AgentLocationRow";
import { AgentMapSheet } from "@/src/components/AgentMapSheet";
import { radius, spacing, useTheme } from "@/src/theme";
import { Empty, T } from "@/src/ui";

export function AgentsMap({ agents }: { agents: any[] }) {
  const { colors } = useTheme();
  const [sel, setSel] = useState<any>(null);
  const located = agents.filter((a) => a.last_location);
  if (!located.length) return <Empty icon="map-outline" text="لا توجد مواقع مسجلة للموزعين بعد" />;
  const first = located[0].last_location;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ height: 320, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        <MapView testID="agents-map" style={{ flex: 1 }} initialRegion={{ latitude: first.lat, longitude: first.lng, latitudeDelta: 0.2, longitudeDelta: 0.2 }}>
          {located.map((a) => (
            <Marker key={a.user_id} coordinate={{ latitude: a.last_location.lat, longitude: a.last_location.lng }} title={a.name ?? a.email} description="اضغط لعرض الموقع على خرائط Google" pinColor={colors.brandPrimary} onCalloutPress={() => setSel(a)} />
          ))}
          {located.flatMap((a) =>
            a.today_visits.map((v: any) => (
              <Marker key={`${a.user_id}-${v.invoice_no}`} coordinate={{ latitude: v.lat, longitude: v.lng }} title={`${v.invoice_no} · ${v.customer_name}`} description={money(v.total)} pinColor={colors.warning} />
            )),
          )}
        </MapView>
      </View>
      <T v="caption">اضغط على أي موزع لعرض موقعه على خرائط Google · تحديث تلقائي كل دقيقة</T>
      {located.map((a) => (
        <AgentLocationRow key={a.user_id} a={a} />
      ))}
      <AgentMapSheet agent={sel} onClose={() => setSel(null)} />
    </View>
  );
}
