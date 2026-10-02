import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { spacing, useTheme } from "@/src/theme";
import { Btn, Card, Field, Header, IconBtn, T, useToast } from "@/src/ui";

export default function Activate() {
  const { user, setUser, logout } = useAuth();
  const [code, setCode] = useState("");
  const [org, setOrg] = useState("");
  const [loading, setLoading] = useState<"code" | "trial" | null>(null);
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const run = async (kind: "code" | "trial") => {
    if (kind === "code" && !code.trim()) return toast("أدخل رمز التفعيل", "error");
    if (kind === "trial" && !org.trim()) return toast("أدخل اسم المؤسسة", "error");
    setLoading(kind);
    try {
      const u = kind === "code"
        ? await api("/activate", { method: "POST", body: { code } })
        : await api("/trial", { method: "POST", body: { org_name: org } });
      toast("تم تفعيل الحساب بنجاح");
      setUser(u);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} testID="activation-screen">
      <Header title="تفعيل الحساب" subtitle={user?.email} right={<IconBtn testID="activation-logout-button" icon="log-out-outline" onPress={logout} />} />
      <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Card style={{ gap: spacing.md }}>
          <T v="h2">لديك رمز تفعيل؟</T>
          <T v="caption">أدخل رمز ترخيص المؤسسة (LIC-...) إذا كنت مالكاً، أو رمز الموظف (EMP-...) الذي أرسله لك المدير.</T>
          <Field testID="activation-code-input" label="رمز التفعيل" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="EMP-XXXX-XXXX-XXXX" />
          <Btn testID="activate-code-button" title="تفعيل" icon="key-outline" onPress={() => run("code")} loading={loading === "code"} />
        </Card>
        <Card style={{ gap: spacing.md }}>
          <T v="h2">تجربة مجانية 14 يوماً</T>
          <T v="caption">أنشئ مؤسستك الآن وابدأ باستخدام النظام كمالك (حتى 3 موظفين).</T>
          <Field testID="trial-org-name-input" label="اسم المؤسسة" value={org} onChangeText={setOrg} placeholder="مثال: شركة النور للتوزيع" />
          <Btn testID="start-trial-button" variant="secondary" title="ابدأ التجربة" icon="rocket-outline" onPress={() => run("trial")} loading={loading === "trial"} />
        </Card>
      </KeyboardAwareScrollView>
    </View>
  );
}
