import { View } from "react-native";

import { useAuth } from "@/src/auth";
import { spacing, useTheme } from "@/src/theme";
import { Btn, Empty, T } from "@/src/ui";

export default function Blocked() {
  const { user, logout, refresh } = useAuth();
  const { colors } = useTheme();
  return (
    <View testID="blocked-screen" style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.surface, gap: spacing.md }}>
      <Empty icon="lock-closed-outline" text={user?.org?.status === "SUSPENDED" ? "تم إيقاف اشتراك المؤسسة. يرجى التواصل مع الدعم." : "انتهى اشتراك المؤسسة. يرجى التجديد للمتابعة."} />
      <T v="caption" style={{ textAlign: "center" }}>{user?.org?.name}</T>
      <Btn testID="blocked-refresh-button" title="إعادة التحقق" icon="refresh" onPress={refresh} />
      <Btn testID="blocked-logout-button" variant="ghost" title="تسجيل الخروج" onPress={logout} />
    </View>
  );
}
