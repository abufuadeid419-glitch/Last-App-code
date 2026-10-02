import { View } from "react-native";

import { AgentLocationRow } from "@/src/components/AgentLocationRow";
import { spacing, useTheme } from "@/src/theme";
import { Card, Empty, Ionicons, T } from "@/src/ui";

// Web fallback: list with "open in maps" links (react-native-maps is native only).
export function AgentsMap({ agents }: { agents: any[] }) {
  const { colors } = useTheme();
  const located = agents.filter((a) => a.last_location);
  if (!located.length) return <Empty icon="map-outline" text="لا توجد مواقع مسجلة للموزعين بعد" />;
  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.brandTertiary }}>
        <Ionicons name="information-circle-outline" size={20} color={colors.brandPrimary} />
        <T v="caption" style={{ flex: 1 }}>الخريطة التفاعلية متاحة على تطبيق الهاتف</T>
      </Card>
      {located.map((a) => (
        <AgentLocationRow key={a.user_id} a={a} />
      ))}
    </View>
  );
}
