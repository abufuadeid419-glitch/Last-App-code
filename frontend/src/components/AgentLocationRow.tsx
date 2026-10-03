import { useState } from "react";
import { View } from "react-native";

import { fmtDate } from "@/src/api";
import { AgentMapSheet } from "@/src/components/AgentMapSheet";
import { spacing } from "@/src/theme";
import { Badge, Card, IconBtn, T } from "@/src/ui";

export function AgentLocationRow({ a }: { a: any }) {
  const [open, setOpen] = useState(false);
  const loc = a.last_location;
  return (
    <>
      <Card testID={`agent-location-${a.user_id}`} onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="label">{a.name ?? a.email}</T>
          <T v="caption">آخر موقع: {fmtDate(loc.at)}</T>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            <Badge text={`${a.today_visits.length} زيارة اليوم`} />
            <T v="caption" color="brandPrimary">اضغط لعرض الخريطة</T>
          </View>
        </View>
        <IconBtn testID={`open-map-${a.user_id}`} icon="map-outline" tone="brand" onPress={() => setOpen(true)} />
      </Card>
      <AgentMapSheet agent={open ? a : null} onClose={() => setOpen(false)} />
    </>
  );
}
