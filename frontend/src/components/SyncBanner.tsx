import { useState } from "react";
import { Pressable, View } from "react-native";

import { discardFailed, syncQueue, useSyncState } from "@/src/offline";
import { fonts, spacing, useTheme } from "@/src/theme";
import { Btn, Ionicons, Row, Sheet, T } from "@/src/ui";

// Shows connectivity + pending/failed offline actions. Hidden when all is synced.
export function SyncBanner() {
  const { colors } = useTheme();
  const { pending, failed, online, syncing } = useSyncState();
  const [open, setOpen] = useState(false);
  if (online && !pending.length && !failed.length) return null;
  const tone = failed.length ? colors.error : online ? colors.info : colors.warning;
  const text = !online
    ? `بدون اتصال · ${pending.length} عملية بانتظار المزامنة`
    : syncing
      ? "جارِ المزامنة..."
      : failed.length
        ? `${failed.length} عملية فشلت مزامنتها`
        : `${pending.length} عملية بانتظار المزامنة`;
  return (
    <>
      <Pressable testID="sync-banner" onPress={() => setOpen(true)} style={{ backgroundColor: tone, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ionicons name={online ? "sync-outline" : "cloud-offline-outline"} size={18} color={colors.onInfo} />
        <T style={{ flex: 1, color: colors.onInfo, fontFamily: fonts.semibold, fontSize: 13 }}>{text}</T>
        <Ionicons name="chevron-back" size={16} color={colors.onInfo} />
      </Pressable>
      <Sheet testID="sync-sheet" visible={open} onClose={() => setOpen(false)} title="المزامنة" footer={<Btn testID="sync-now-button" title="مزامنة الآن" icon="sync-outline" loading={syncing} onPress={syncQueue} />}>
        <T v="caption">العمليات المسجلة دون اتصال تُحفظ على الجهاز وتُرسل تلقائياً عند عودة الإنترنت.</T>
        {pending.map((p) => (
          <Row key={p.id} testID={`pending-item-${p.id}`} icon="time-outline" title={p.label} subtitle="بانتظار المزامنة" />
        ))}
        {failed.map((f) => (
          <View key={f.id}>
            <Row testID={`failed-item-${f.id}`} icon="alert-circle-outline" title={f.label} subtitle={f.error} right={<Btn small variant="ghost" title="تجاهل" testID={`discard-failed-${f.id}`} onPress={() => discardFailed(f.id)} />} />
          </View>
        ))}
        {!pending.length && !failed.length && <T>كل العمليات متزامنة</T>}
      </Sheet>
    </>
  );
}
