import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";

import { money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { LocationCard } from "@/src/components/LocationCard";
import { SyncBanner } from "@/src/components/SyncBanner";
import { useApi, useBottomChrome } from "@/src/hooks";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, ErrorBox, Header, Loading, Row, Section, Stat, T } from "@/src/ui";

export default function Overview() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const bottom = useBottomChrome();
  const isAgent = user?.employee_type === "FIELD_AGENT";
  const isOwner = user?.role === "OWNER";
  const stats = useApi<any>("/stats/overview");
  const inv = useApi<any[]>("/my/inventory", isAgent);
  const agents = useApi<any[]>("/stats/agents", !isAgent);
  const s = stats.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="overview-screen">
      <Header title={`مرحباً، ${user?.name?.split(" ")[0] ?? ""}`} subtitle={user?.org?.name} right={<AccountButton />} />
      <SyncBanner />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={() => { stats.refetch(); inv.refetch(); agents.refetch(); }} tintColor={colors.brandPrimary} />}
      >
        {stats.isLoading ? (
          <Loading />
        ) : stats.error ? (
          <ErrorBox message={(stats.error as Error).message} onRetry={stats.refetch} />
        ) : (
          <>
            {isAgent && <LocationCard />}
            {!isAgent && (
              <Btn testID="open-reports-button" variant="secondary" icon="bar-chart-outline" title="التقارير اليومية والأسبوعية والشهرية" onPress={() => router.push("/reports")} />
            )}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              <Stat testID="stat-today-sales" label="مبيعات اليوم" value={money(s.today_sales)} icon="today-outline" />
              <Stat testID="stat-total-sales" label={isAgent ? "إجمالي مبيعاتي" : "إجمالي المبيعات"} value={money(s.sales_total)} icon="trending-up-outline" tone="success" />
              <Stat testID="stat-collections" label="التحصيلات" value={money(s.collections_total)} icon="cash-outline" tone="info" />
              <Stat testID="stat-debts" label="ديون العملاء" value={money(s.debts_total)} icon="alert-circle-outline" tone="warning" />
              {isOwner && <Stat testID="stat-profit" label="إجمالي الربح" value={money(s.gross_profit)} icon="wallet-outline" tone="success" />}
              {isOwner && <Stat testID="stat-stock-value" label="قيمة المخزون" value={money(s.stock_value)} icon="cube-outline" />}
              {!isAgent && <Stat testID="stat-purchases" label="المشتريات" value={money(s.purchases_total)} icon="cart-outline" tone="info" />}
              {!isAgent && <Stat testID="stat-returns" label="المرتجعات" value={money(s.returns_total)} icon="return-down-back-outline" tone="error" />}
            </View>

            {isAgent && (
              <Section title="مخزوني الحالي">
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  {!inv.data?.length ? (
                    <Empty icon="cube-outline" text="لا يوجد مخزون لديك. اطلب من المالك تسليمك بضاعة." />
                  ) : (
                    inv.data.map((i) => (
                      <Row key={i.product_id} testID={`my-stock-${i.product_id}`} icon="cube-outline" title={i.product_name} subtitle={`السعر: ${money(i.sale_price)}`} right={<T v="h2" color="brandPrimary">{money(i.quantity)}</T>} />
                    ))
                  )}
                </Card>
              </Section>
            )}

            {!isAgent && s.low_stock?.length > 0 && (
              <Section title="تنبيهات نقص المخزون">
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  {s.low_stock.map((p: any) => (
                    <Row key={p.id} icon="warning-outline" title={p.name} subtitle={`الحد الأدنى: ${p.min_stock}`} right={<Badge text={`${p.stock} ${p.unit}`} tone="warning" />} />
                  ))}
                </Card>
              </Section>
            )}

            {!isAgent && (
              <Section title="أداء الموزعين">
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  {!agents.data?.length ? (
                    <Empty icon="people-outline" text="لا يوجد موزعون بعد" />
                  ) : (
                    agents.data.map((a) => (
                      <Row key={a.user_id} icon="person-outline" title={a.name ?? a.email} subtitle={`${a.sales_count} فاتورة · تحصيل ${money(a.collections_total)}`} right={<T v="label" color="success">{money(a.sales_total)}</T>} />
                    ))
                  )}
                </Card>
              </Section>
            )}

            <Section title="آخر الفواتير">
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {!s.recent_sales?.length ? (
                  <Empty icon="receipt-outline" text="لا توجد فواتير بعد" />
                ) : (
                  s.recent_sales.map((x: any) => (
                    <Row key={x.id} icon="receipt-outline" title={`${x.invoice_no} · ${x.customer_name}`} subtitle={x.distributor_name} right={<T v="label">{money(x.total)}</T>} />
                  ))
                )}
              </Card>
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}
