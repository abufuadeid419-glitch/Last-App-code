import { useState } from "react";
import { View } from "react-native";

import { api, fmtDate } from "@/src/api";
import { useApi } from "@/src/hooks";
import { queryClient } from "@/src/query-client";
import { spacing, useTheme } from "@/src/theme";
import { Empty, IconBtn, Ionicons, IconName, Sheet, T } from "@/src/ui";

const icons: Record<string, IconName> = {
  low_stock: "warning-outline",
  out_of_stock: "alert-circle-outline",
  delivery: "car-outline",
  delivery_confirmed: "checkmark-done-outline",
  delivery_rejected: "close-circle-outline",
  stock_request: "file-tray-full-outline",
  upgrade: "rocket-outline",
};

export function NotificationBell() {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const q = useApi<any>("/notifications");
  const unread = q.data?.unread ?? 0;
  const openSheet = async () => {
    setOpen(true);
    if (unread) {
      await api("/notifications/read-all", { method: "POST" }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/notifications"] });
    }
  };
  return (
    <>
      <View>
        <IconBtn testID="notifications-button" icon="notifications-outline" onPress={openSheet} />
        {unread > 0 && (
          <View testID="notifications-unread-badge" pointerEvents="none" style={{ position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
            <T v="caption" style={{ color: colors.onError, fontSize: 11, lineHeight: 16 }}>{unread > 9 ? "9+" : unread}</T>
          </View>
        )}
      </View>
      <Sheet testID="notifications-sheet" visible={open} onClose={() => setOpen(false)} title="الإشعارات">
        {!q.data?.items?.length ? (
          <Empty icon="notifications-off-outline" text="لا توجد إشعارات" />
        ) : (
          q.data.items.map((n: any) => (
            <View key={n.id} testID={`notification-${n.id}`} style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
              <Ionicons name={icons[n.type] ?? "notifications-outline"} size={22} color={n.read ? colors.muted : colors.brandPrimary} />
              <View style={{ flex: 1 }}>
                <T v="label">{n.title}</T>
                <T v="caption">{n.body}</T>
                <T v="caption">{fmtDate(n.created_at)}</T>
              </View>
            </View>
          ))
        )}
      </Sheet>
    </>
  );
}
