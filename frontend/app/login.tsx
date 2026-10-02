import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Btn, Ionicons, T } from "@/src/ui";

const HERO =
  "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const { login, busy, error } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const features: { icon: any; text: string }[] = [
    { icon: "cube-outline", text: "إدارة المخزون والمنتجات" },
    { icon: "receipt-outline", text: "فواتير المبيعات والتحصيل" },
    { icon: "people-outline", text: "الموزعون والمحاسبون والعملاء" },
  ];
  return (
    <View style={styles.root} testID="login-screen">
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
        <LinearGradient colors={["rgba(25,28,27,0.15)", "rgba(25,28,27,0.85)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ paddingTop: insets.top + spacing.xl, paddingHorizontal: spacing.xl, flex: 1, justifyContent: "flex-end", paddingBottom: spacing.xl }}>
          <View style={styles.logo}>
            <Ionicons name="business" size={30} color={colors.onBrandPrimary} />
          </View>
          <T v="display" color="onSurfaceInverse">النظام الذكي</T>
          <T color="onSurfaceInverse" style={{ opacity: 0.9 }}>نظام متكامل لإدارة المبيعات والتوزيع</T>
        </View>
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={{ gap: spacing.md }}>
          {features.map((f) => (
            <View key={f.text} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <View style={styles.fIcon}>
                <Ionicons name={f.icon} size={20} color={colors.brandPrimary} />
              </View>
              <T v="label">{f.text}</T>
            </View>
          ))}
        </View>
        <View style={{ gap: spacing.md }}>
          {!!error && (
            <T testID="login-error" color="error" style={{ textAlign: "center" }}>{error}</T>
          )}
          <Btn testID="google-login-button" title="تسجيل الدخول عبر Google" icon="logo-google" onPress={login} loading={busy} />
          <T v="caption" style={{ textAlign: "center" }}>بالمتابعة أنت توافق على شروط الاستخدام وسياسة الخصوصية</T>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  hero: { flex: 1.1, overflow: "hidden" },
  logo: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  body: { flex: 1, padding: spacing.xl, justifyContent: "space-between", gap: spacing.xl },
  fIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
}));
