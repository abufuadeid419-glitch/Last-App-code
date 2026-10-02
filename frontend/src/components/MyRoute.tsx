import { useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/src/api";
import { RouteMap } from "@/src/components/RouteMap";
import { useApi } from "@/src/hooks";
import { getLastCoords } from "@/src/location";
import { writeCache } from "@/src/offline";
import { offlineStopStatus } from "@/src/offlineActions";
import { queryClient } from "@/src/query-client";
import { radius, spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, IconBtn, Section, T, useToast } from "@/src/ui";

export const stopBadge: Record<string, { t: string; tone: "brand" | "success" | "error" }> = {
  PENDING: { t: "بانتظار الزيارة", tone: "brand" },
  VISITED: { t: "تمت الزيارة", tone: "success" },
  SKIPPED: { t: "تم التخطي", tone: "error" },
};

export const directionsUrl = (s: any) =>
  s.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.customer_name, s.address].filter(Boolean).join(" "))}`;

// Distributor's route for today: ordered stops with visit / skip / directions.
export function MyRoute() {
  const { colors } = useTheme();
  const toast = useToast();
  const route = useApi<any>("/routes/mine");
  const [busy, setBusy] = useState(false);
  const r = route.data;

  if (!r || !r.stops?.length)
    return (
      <Section title="خط سير اليوم">
        <Card testID="no-route-card"><T v="caption">لا يوجد خط سير مخطط لليوم.</T></Card>
      </Section>
    );

  const done = r.stops.filter((s: any) => s.status !== "PENDING").length;
  const optimize = async () => {
    setBusy(true);
    try {
      const c = getLastCoords();
      const res = await api(`/routes/${r.id}/optimize`, { method: "POST", body: { lat: c?.lat ?? null, lng: c?.lng ?? null } });
      queryClient.setQueryData(["/routes/mine"], res);
      writeCache("/routes/mine", res);
      toast(res.unlocated ? `تم الترتيب · ${res.unlocated} عميل بدون موقع في النهاية` : "تم ترتيب المسار حسب الأقرب");
    } catch (e: any) {
      toast(e.offline ? "الترتيب التلقائي يحتاج اتصالاً بالإنترنت" : e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="خط سير اليوم" action={<Badge text={`${done}/${r.stops.length}`} tone={done === r.stops.length ? "success" : "brand"} />}>
      <View testID="my-route" style={{ gap: spacing.md }}>
        <RouteMap stops={r.stops} />
        <Btn testID="optimize-my-route-button" small variant="secondary" icon="git-network-outline" title="ترتيب حسب الأقرب لموقعي" loading={busy} onPress={optimize} />
        {r.stops.map((s: any, i: number) => (
          <Card key={s.customer_id} testID={`route-stop-${i}`} style={{ gap: spacing.sm, opacity: s.status === "PENDING" ? 1 : 0.75 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: s.status === "VISITED" ? colors.success : colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
                <T v="label" color="onBrandPrimary">{i + 1}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="label" numberOfLines={1}>{s.customer_name}</T>
                <T v="caption" numberOfLines={1}>{[s.address, s.phone].filter(Boolean).join(" · ") || "—"}</T>
              </View>
              <Badge text={stopBadge[s.status].t} tone={stopBadge[s.status].tone} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <IconBtn testID={`stop-directions-${i}`} icon="navigate-outline" onPress={() => Linking.openURL(directionsUrl(s))} />
              {s.status === "PENDING" ? (
                <>
                  <Btn testID={`stop-visited-${i}`} small style={{ flex: 1 }} icon="checkmark" title="تمت الزيارة" onPress={() => offlineStopStatus(r, s, "VISITED")} />
                  <Btn testID={`stop-skip-${i}`} small variant="ghost" icon="close" title="تخطي" onPress={() => offlineStopStatus(r, s, "SKIPPED")} />
                </>
              ) : (
                <Btn testID={`stop-undo-${i}`} small variant="ghost" icon="arrow-undo-outline" title="تراجع" onPress={() => offlineStopStatus(r, s, "PENDING")} />
              )}
            </View>
          </Card>
        ))}
      </View>
    </Section>
  );
}
