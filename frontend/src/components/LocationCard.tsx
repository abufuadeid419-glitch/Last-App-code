import * as Location from "expo-location";
import { useEffect } from "react";
import { Linking, View } from "react-native";

import { startTracking } from "@/src/location";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Ionicons, T } from "@/src/ui";

export function LocationCard() {
  const { colors } = useTheme();
  const [perm, request] = Location.useForegroundPermissions();

  useEffect(() => {
    if (perm?.granted) startTracking();
  }, [perm?.granted]);

  if (!perm) return null;
  if (perm.granted) {
    return (
      <View testID="gps-active" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Ionicons name="navigate-circle" size={20} color={colors.success} />
        <T v="caption" style={{ flex: 1 }}>تتبع الموقع مفعّل · يُسجَّل موقعك مع كل فاتورة وتحصيل</T>
        <Badge text="GPS" tone="success" />
      </View>
    );
  }
  const blocked = !perm.canAskAgain;
  return (
    <Card testID="gps-permission-card" style={{ gap: spacing.md, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <Ionicons name="location-outline" size={28} color={colors.brandPrimary} />
        <View style={{ flex: 1 }}>
          <T v="label">تفعيل GPS</T>
          <T v="caption">
            {blocked
              ? "تم رفض إذن الموقع. افتح الإعدادات للسماح به حتى يرى المدير مسار زياراتك."
              : "اسمح بالوصول لموقعك ليتم تسجيل مكان كل فاتورة وتحصيل ومتابعة مسارك اليومي."}
          </T>
        </View>
      </View>
      {blocked ? (
        <Btn testID="gps-open-settings-button" small title="فتح الإعدادات" icon="settings-outline" onPress={() => Linking.openSettings()} />
      ) : (
        <Btn testID="gps-enable-button" small title={perm.status === "denied" ? "السماح مجدداً" : "تفعيل الموقع"} icon="navigate-outline" onPress={request} />
      )}
    </Card>
  );
}
