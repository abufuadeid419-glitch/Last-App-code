import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fmtDate, money } from "@/src/api";
import { GoogleMapEmbed } from "@/src/components/GoogleMapEmbed";
import { useApi } from "@/src/hooks";
import { mapDirectionsUrl, mapOpenUrl, MapType } from "@/src/maps";
import { radius, spacing, useTheme } from "@/src/theme";
import { Badge, Btn, IconBtn, T } from "@/src/ui";

type Focus = { lat: number; lng: number; label: string };
const TYPES: { key: MapType; label: string }[] = [
  { key: "m", label: "خريطة" },
  { key: "k", label: "قمر صناعي" },
  { key: "h", label: "هجين" },
];
const LIVE_MS = 60000;

const ago = (at: string) => {
  const m = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  if (m < 1440) return `منذ ${Math.round(m / 60)} ساعة`;
  return `منذ ${Math.round(m / 1440)} يوم`;
};
const clock = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// Full-screen Google Map focused on one distributor; refreshes every minute and follows the latest GPS fix.
export function AgentMapSheet({ agent, onClose }: { agent: any | null; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useApi<any[]>("/tracking/agents", !!agent, LIVE_MS);
  const live = q.data?.find((a) => a.user_id === agent?.user_id) ?? agent;
  const loc = live?.last_location;
  const [type, setType] = useState<MapType>("m");
  const [visit, setVisit] = useState<Focus | null>(null); // null = follow the latest location

  useEffect(() => setVisit(null), [agent?.user_id]);

  const latest: Focus | null = loc ? { lat: loc.lat, lng: loc.lng, label: "آخر موقع" } : null;
  const focus = visit ?? latest;
  const visits: any[] = live?.today_visits ?? [];
  const stops: Focus[] = latest ? [latest, ...visits.map((v) => ({ lat: v.lat, lng: v.lng, label: `${v.invoice_no} · ${v.customer_name}` }))] : [];
  const fresh = loc && Date.now() - new Date(loc.at).getTime() < 5 * 60000;

  return (
    <Modal visible={!!agent} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View testID="agent-map-sheet" style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <T v="h2" numberOfLines={1}>{live?.name ?? live?.email}</T>
            {loc && <T v="caption" testID="agent-map-last-seen">آخر موقع: {fmtDate(loc.at)} · {ago(loc.at)}</T>}
          </View>
          <IconBtn testID="agent-map-refresh" icon="refresh" onPress={() => q.refetch()} />
          <IconBtn testID="agent-map-close-button" icon="close" onPress={onClose} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fresh ? colors.success : colors.muted }} />
          <T v="caption" testID="agent-map-live-status">
            {fresh ? "مباشر" : "غير متصل حالياً"} · تحديث تلقائي كل دقيقة{q.dataUpdatedAt ? ` · آخر تحديث ${clock(q.dataUpdatedAt)}` : ""}
          </T>
        </View>

        <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary, overflow: "hidden" }}>
          {focus && <GoogleMapEmbed lat={focus.lat} lng={focus.lng} type={type} zoom={17} />}
          <View style={{ position: "absolute", top: spacing.md, alignSelf: "center", flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, gap: 4, borderWidth: 1, borderColor: colors.border }}>
            {TYPES.map((t) => (
              <Pressable
                key={t.key}
                testID={`map-type-${t.key}`}
                onPress={() => setType(t.key)}
                style={{ minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center", backgroundColor: type === t.key ? colors.brandPrimary : "transparent" }}
              >
                <T v="label" color={type === t.key ? "onBrandPrimary" : "onSurface"}>{t.label}</T>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          {focus && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <T v="label" style={{ flex: 1 }} numberOfLines={1} testID="agent-map-focus-label">{focus.label}</T>
              <Badge text={`${visits.length} زيارة اليوم`} />
            </View>
          )}
          {stops.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {stops.map((s, i) => {
                const active = i === 0 ? !visit : visit?.lat === s.lat && visit?.lng === s.lng;
                return (
                  <Pressable
                    key={i}
                    testID={`agent-map-stop-${i}`}
                    onPress={() => setVisit(i === 0 ? null : s)}
                    style={{ minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center", backgroundColor: active ? colors.brandTertiary : colors.surfaceSecondary, borderWidth: 1, borderColor: active ? colors.brandPrimary : colors.border }}
                  >
                    <T v="caption" color={active ? "brandPrimary" : "onSurface"}>{i === 0 ? "آخر موقع (متابعة مباشرة)" : `${s.label} · ${money(visits[i - 1].total)}`}</T>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {focus && (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Btn testID="agent-map-open-google" style={{ flex: 1 }} small icon="logo-google" title="فتح في خرائط Google" onPress={() => Linking.openURL(mapOpenUrl(focus.lat, focus.lng))} />
              <Btn testID="agent-map-directions" style={{ flex: 1 }} small variant="secondary" icon="navigate-outline" title="الاتجاهات" onPress={() => Linking.openURL(mapDirectionsUrl(focus.lat, focus.lng))} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
