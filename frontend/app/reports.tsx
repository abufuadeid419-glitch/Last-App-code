import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useApi } from "@/src/hooks";
import { radius, spacing, useTheme } from "@/src/theme";
import { Card, ErrorBox, Header, IconBtn, Loading, Segments, Stat, T } from "@/src/ui";

type Period = "day" | "week" | "month";
type Metric = "sales" | "collections" | "profit";

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function label(key: string, period: Period) {
  if (period === "month") {
    const [, m] = key.split("-");
    return AR_MONTHS[+m - 1];
  }
  const d = new Date(key + "T00:00:00");
  if (period === "day") return AR_DAYS[d.getDay()];
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function Reports() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isOwner = user?.role === "OWNER";
  const [period, setPeriod] = useState<Period>("day");
  const [metric, setMetric] = useState<Metric>("sales");
  const q = useApi<any>(`/stats/reports?period=${period}`);
  const rows: any[] = q.data?.rows ?? [];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r[metric] ?? 0)));
  const metricColor = metric === "sales" ? colors.brandPrimary : metric === "collections" ? colors.info : colors.success;
  const metrics: { key: Metric; label: string }[] = [
    { key: "sales", label: "المبيعات" },
    { key: "collections", label: "التحصيلات" },
    ...(isOwner ? [{ key: "profit" as Metric, label: "الربح" }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="reports-screen">
      <Header title="التقارير" subtitle="أداء المبيعات حسب الفترة" right={<IconBtn testID="reports-back-button" icon="arrow-forward" onPress={() => router.back()} />} />
      <Segments value={period} onChange={setPeriod} options={[{ key: "day", label: "يومي" }, { key: "week", label: "أسبوعي" }, { key: "month", label: "شهري" }]} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
      >
        {q.isLoading ? (
          <Loading />
        ) : q.error ? (
          <ErrorBox message={(q.error as Error).message} onRetry={q.refetch} />
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              <Stat testID="report-total-sales" label="إجمالي المبيعات" value={money(q.data.totals.sales)} icon="trending-up-outline" />
              <Stat testID="report-total-collections" label="إجمالي التحصيل" value={money(q.data.totals.collections)} icon="cash-outline" tone="info" />
              {isOwner && <Stat testID="report-total-profit" label="صافي الربح" value={money(q.data.totals.profit)} icon="wallet-outline" tone="success" />}
              <Stat testID="report-total-count" label="عدد الفواتير" value={String(q.data.totals.count)} icon="receipt-outline" tone="warning" />
            </View>

            <Card style={{ gap: spacing.md, paddingHorizontal: 0 }}>
              <Segments value={metric} onChange={setMetric} options={metrics} />
              <View testID="report-chart" style={{ flexDirection: "row", alignItems: "flex-end", height: 200, gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                {rows.map((r) => {
                  const v = r[metric] ?? 0;
                  const h = Math.max(4, (Math.abs(v) / max) * 160);
                  return (
                    <View key={r.key} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                      <T v="caption" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 10 }}>{v ? money(v) : ""}</T>
                      <View style={{ width: "100%", maxWidth: 32, height: h, borderRadius: radius.sm, backgroundColor: v < 0 ? colors.error : v ? metricColor : colors.surfaceTertiary }} />
                      <T v="caption" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11 }}>{label(r.key, period)}</T>
                    </View>
                  );
                })}
              </View>
            </Card>

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", padding: spacing.md, backgroundColor: colors.surfaceSecondary }}>
                <T v="label" style={{ flex: 1.2 }}>الفترة</T>
                <T v="label" style={{ flex: 1 }}>مبيعات</T>
                <T v="label" style={{ flex: 1 }}>تحصيل</T>
                {isOwner && <T v="label" style={{ flex: 1 }}>ربح</T>}
              </View>
              {[...rows].reverse().map((r) => (
                <View key={r.key} testID={`report-row-${r.key}`} style={{ flexDirection: "row", padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <T style={{ flex: 1.2 }} numberOfLines={1}>{label(r.key, period)} <T v="caption">{period === "month" ? r.key.slice(0, 4) : ""}</T></T>
                  <T style={{ flex: 1 }}>{money(r.sales)}</T>
                  <T style={{ flex: 1 }} color="info">{money(r.collections)}</T>
                  {isOwner && <T style={{ flex: 1 }} color={r.profit < 0 ? "error" : "success"}>{money(r.profit)}</T>}
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
