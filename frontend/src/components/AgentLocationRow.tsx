import { Linking, View } from "react-native";

import { fmtDate } from "@/src/api";
import { spacing } from "@/src/theme";
import { Badge, Card, IconBtn, T } from "@/src/ui";

export function AgentLocationRow({ a }: { a: any }) {
  const loc = a.last_location;
  return (
    <Card testID={`agent-location-${a.user_id}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="label">{a.name ?? a.email}</T>
        <T v="caption">آخر موقع: {fmtDate(loc.at)}</T>
        <Badge text={`${a.today_visits.length} زيارة اليوم`} />
      </View>
      <IconBtn testID={`open-map-${a.user_id}`} icon="navigate-outline" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`)} />
    </Card>
  );
}
