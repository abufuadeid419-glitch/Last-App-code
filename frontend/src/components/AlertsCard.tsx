import { View } from "react-native";

import { money } from "@/src/api";
import { useApi } from "@/src/hooks";
import { spacing, useTheme } from "@/src/theme";
import { Card, Ionicons, Row, Section, Stat, T } from "@/src/ui";

// Smart alerts for owner/accountant: overdue invoices, risky customers, collection rate, sales drop.
export function AlertsCard() {
  const { colors } = useTheme();
  const q = useApi<any[]>("/stats/alerts");
  const tone = (s: string) => (s === "critical" ? colors.error : s === "warning" ? colors.warning : colors.info);
  return (
    <Section title="التنبيهات">
      <Card style={{ padding: 0, overflow: "hidden" }} testID="alerts-card">
        {!q.data?.length ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.lg, alignItems: "center" }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
            <T testID="alerts-all-good">كل شيء على ما يرام، لا توجد مشاكل</T>
          </View>
        ) : (
          q.data.map((a) => (
            <View key={a.id} testID={`alert-${a.id}`} style={{ flexDirection: "row", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, alignItems: "center" }}>
              <Ionicons name={a.icon} size={22} color={tone(a.severity)} />
              <View style={{ flex: 1 }}>
                <T v="label">{a.title}</T>
                <T v="caption">{a.description}</T>
              </View>
            </View>
          ))
        )}
      </Card>
    </Section>
  );
}

// Finance summary with discount analytics (reports screen).
export function FinanceCard() {
  const q = useApi<any>("/stats/finance");
  const f = q.data;
  if (!f) return null;
  return (
    <Section title="المالية والخصومات">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }} testID="finance-card">
        <Stat label="مبيعات نقدية" value={money(f.cash_total)} icon="cash-outline" tone="success" />
        <Stat label="مبيعات آجلة" value={money(f.credit_total)} icon="time-outline" tone="warning" />
        <Stat label="خصومات نقدية" value={money(f.cash_discounts)} icon="pricetag-outline" tone="info" />
        <Stat label="خصومات آجلة" value={money(f.credit_discounts)} icon="pricetag-outline" tone="error" />
        <Stat label={`عمليات التحصيل (${f.collection_ops})`} value={money(f.collections_total)} icon="wallet-outline" />
        <Stat label={`عملاء مدينون (${f.debt_customers})`} value={money(f.debts_total)} icon="people-outline" tone="warning" />
        <Stat label="المشتريات" value={money(f.purchases_total)} icon="download-outline" tone="info" />
        <Stat label="مرتجع المشتريات" value={money(f.purchase_returns_total)} icon="arrow-undo-outline" />
      </View>
      {!!f.top_discount_customers?.length && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <T v="label" style={{ padding: spacing.md }}>أكثر العملاء حصولاً على خصومات</T>
          {f.top_discount_customers.map((c: any) => (
            <Row key={c.name} icon="person-outline" title={c.name} right={<T v="label" color="error">{money(c.amount)}</T>} />
          ))}
        </Card>
      )}
    </Section>
  );
}
