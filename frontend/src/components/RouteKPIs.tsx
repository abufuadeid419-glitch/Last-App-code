import { View } from "react-native";

import { useApi } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Badge, Card, Row, Section, T } from "@/src/ui";

// Route KPIs for the last 7 days + recent route history.
export function RouteKPIs() {
  const q = useApi<any>("/routes/kpis?days=7");
  if (!q.data) return null;
  return (
    <>
      <Section title="مؤشرات خطوط السير (7 أيام)">
        {!q.data.agents.length ? (
          <T v="caption">لا توجد بيانات بعد</T>
        ) : (
          q.data.agents.map((a: any, i: number) => (
            <Card key={a.distributor_id} testID={`route-kpi-${a.distributor_id}`} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <T v="label" style={{ flex: 1 }}>{i + 1}. {a.name}</T>
                <Badge text={`زيارة ${a.visit_rate}%`} tone={a.visit_rate >= 80 ? "success" : a.visit_rate >= 50 ? "warning" : "error"} />
              </View>
              <T v="caption">{a.stops} محطة · {a.visited} تمت · {a.skipped} مفوتة · {a.pending} معلقة · {a.sold} بيع (تحويل {a.conversion_rate}%)</T>
            </Card>
          ))
        )}
      </Section>
      {!!q.data.history.length && (
        <Section title="سجل خطوط السير">
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {q.data.history.slice(0, 10).map((r: any) => {
              const done = r.stops.filter((s: any) => s.status === "VISITED").length;
              return <Row key={r.id} testID={`route-history-${r.id}`} icon="map-outline" title={`${r.distributor_name} · ${r.date}`} subtitle={`${done}/${r.stops.length} زيارة`} />;
            })}
          </Card>
        </Section>
      )}
    </>
  );
}
