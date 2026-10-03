import { useState } from "react";
import { View } from "react-native";

import { money } from "@/src/api";
import { MONTHS } from "@/src/components/DateField";
import { useApi } from "@/src/hooks";
import { radius, spacing, useTheme } from "@/src/theme";
import { Btn, Card, Empty, IconBtn, Ionicons, Loading, Section, T } from "@/src/ui";

// Medal colors are fixed (same in light and dark themes).
const MEDALS = ["#D4A017", "#9EA3A8", "#B87333"];
type Metric = "sales_total" | "collections_total";

export function Leaderboard() {
  const { colors } = useTheme();
  const [back, setBack] = useState(0); // months before current
  const [by, setBy] = useState<Metric>("sales_total");
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - back);
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const q = useApi<any>(`/stats/leaderboard?month=${month}`);
  const list = [...(q.data?.agents ?? [])].sort((a, b) => b[by] - a[by]);
  const top = list[0]?.[by] || 0;

  return (
    <Section title="لوحة صدارة الموزعين">
      <Card testID="leaderboard-card" style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconBtn testID="leaderboard-prev-month" icon="chevron-forward" onPress={() => setBack(back + 1)} />
          <T v="h2" style={{ flex: 1, textAlign: "center" }} testID="leaderboard-month">{MONTHS[d.getMonth()]} {d.getFullYear()}</T>
          {back > 0 ? <IconBtn testID="leaderboard-next-month" icon="chevron-back" onPress={() => setBack(back - 1)} /> : <View style={{ width: 44 }} />}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Btn testID="leaderboard-by-sales" style={{ flex: 1 }} small variant={by === "sales_total" ? "primary" : "secondary"} icon="trending-up-outline" title="المبيعات" onPress={() => setBy("sales_total")} />
          <Btn testID="leaderboard-by-collections" style={{ flex: 1 }} small variant={by === "collections_total" ? "primary" : "secondary"} icon="cash-outline" title="التحصيلات" onPress={() => setBy("collections_total")} />
        </View>
        {q.isLoading ? (
          <Loading />
        ) : !list.length ? (
          <Empty icon="people-outline" text="لا يوجد موزعون بعد" />
        ) : (
          <>
            {!top && <T v="caption" style={{ textAlign: "center" }}>لا يوجد نشاط مسجل في هذا الشهر</T>}
            {list.map((a, i) => {
              const medal = top > 0 && i < 3 ? MEDALS[i] : null;
              return (
                <View key={a.user_id} testID={`leaderboard-row-${a.user_id}`} style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: medal ?? colors.surfaceSecondary }}>
                      {medal ? <Ionicons name="trophy" size={18} color={colors.onBrandPrimary} /> : <T v="label">{i + 1}</T>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <T v="label" numberOfLines={1}>{a.name ?? a.email}</T>
                      <T v="caption">{a.sales_count} فاتورة · {a.customers_count} عميل · {by === "sales_total" ? `تحصيل ${money(a.collections_total)}` : `مبيعات ${money(a.sales_total)}`}</T>
                    </View>
                    <T v="h2" color={by === "sales_total" ? "success" : "info"}>{money(a[by])}</T>
                  </View>
                  <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, overflow: "hidden", marginStart: 36 + spacing.md }}>
                    <View style={{ height: 6, width: `${top ? Math.max(2, (a[by] / top) * 100) : 0}%`, backgroundColor: medal ?? colors.brandPrimary, borderRadius: radius.pill }} />
                  </View>
                </View>
              );
            })}
          </>
        )}
      </Card>
    </Section>
  );
}
