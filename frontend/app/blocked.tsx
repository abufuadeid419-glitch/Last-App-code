import { useRouter } from "expo-router";
import { View } from "react-native";

import { useAuth } from "@/src/auth";
import { spacing, useTheme } from "@/src/theme";
import { Btn, Empty, T } from "@/src/ui";

export default function Blocked() {
  const { user, logout, refresh } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View testID="blocked-screen" style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.surface, gap: spacing.md }}>
      <Empty icon="lock-closed-outline" text={user?.org?.status === "SUSPENDED" ? "تم إيقاف اشتراك المؤسسة. يرجى التواصل مع الدعم." : "انتهى اشتراك المؤسسة. يرجى التجديد للمتابعة."} />
      <T v="caption" style={{ textAlign: "center" }}>{user?.org?.name}</T>
      {user?.role === "OWNER" && <Btn testID="blocked-upgrade-button" title="تجديد / ترقية الخطة" icon="rocket-outline" onPress={() => router.push("/upgrade")} />}
      <Btn testID="blocked-refresh-button" variant="secondary" title="إعادة التحقق" icon="refresh" onPress={refresh} />
      <Btn testID="blocked-logout-button" variant="ghost" title="تسجيل الخروج" onPress={logout} />
    </View>
  );
}
