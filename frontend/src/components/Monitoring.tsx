import { View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useApi } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Badge, Card, Loading, T } from "@/src/ui";

export function Monitoring() {
  const q = useApi<any[]>("/dev/monitoring");
  if (!q.data) return <Loading />;
  return (
    <View style={{ gap: spacing.md }} testID="monitoring">
      <T v="h2">مراقبة المؤسسات</T>
      {q.data.map((o) => (
        <Card key={o.id} testID={`monitor-org-${o.id}`} style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T v="label" style={{ flex: 1 }}>{o.name}</T>
            <Badge text={o.sales_week ? `${o.sales_week} فاتورة هذا الأسبوع` : "غير نشطة"} tone={o.sales_week ? "success" : "warning"} />
          </View>
          <T v="caption">{o.users} مستخدم · {o.products} منتج · {o.customers} عميل · {o.sales} فاتورة · إيراد {money(o.revenue)}</T>
          <T v="caption">آخر نشاط: {o.last_activity ? fmtDate(o.last_activity) : "—"}</T>
        </Card>
      ))}
    </View>
  );
}
