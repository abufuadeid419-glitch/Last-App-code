import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fmtDate, money } from "@/src/api";
import { GoogleMapEmbed } from "@/src/components/GoogleMapEmbed";
import { mapDirectionsUrl, mapOpenUrl, MapType } from "@/src/maps";
import { radius, spacing, useTheme } from "@/src/theme";
import { Badge, Btn, IconBtn, T } from "@/src/ui";

type Focus = { lat: number; lng: number; label: string };
const TYPES: { key: MapType; label: string }[] = [
  { key: "m", label: "خريطة" },
  { key: "k", label: "قمر صناعي" },
  { key: "h", label: "هجين" },
];

// Full-screen Google Map focused on one distributor's last GPS location and today's visits.
export function AgentMapSheet({ agent, onClose }: { agent: any | null; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<MapType>("m");
  const [focus, setFocus] = useState<Focus | null>(null);
  const loc = agent?.last_location;

  useEffect(() => {
    if (loc) setFocus({ lat: loc.lat, lng: loc.lng, label: "آخر موقع" });
  }, [agent?.user_id, loc]);

  const visits: any[] = agent?.today_visits ?? [];
  const stops: Focus[] = loc ? [{ lat: loc.lat, lng: loc.lng, label: "آخر موقع" }, ...visits.map((v) => ({ lat: v.lat, lng: v.lng, label: `${v.invoice_no} · ${v.customer_name}` }))] : [];

  return (
    <Modal visible={!!agent} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View testID="agent-map-sheet" style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <T v="h2" numberOfLines={1}>{agent?.name ?? agent?.email}</T>
            {loc && <T v="caption">آخر تحديث: {fmtDate(loc.at)}</T>}
          </View>
          <IconBtn testID="agent-map-close-button" icon="close" onPress={onClose} />
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
                const active = focus?.lat === s.lat && focus?.lng === s.lng;
                return (
                  <Pressable
                    key={i}
                    testID={`agent-map-stop-${i}`}
                    onPress={() => setFocus(s)}
                    style={{ minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, justifyContent: "center", backgroundColor: active ? colors.brandTertiary : colors.surfaceSecondary, borderWidth: 1, borderColor: active ? colors.brandPrimary : colors.border }}
                  >
                    <T v="caption" color={active ? "brandPrimary" : "onSurface"}>{i === 0 ? s.label : `${s.label} · ${money(visits[i - 1].total)}`}</T>
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
