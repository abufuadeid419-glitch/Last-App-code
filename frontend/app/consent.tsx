import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { PRIVACY, TERMS } from "@/src/legal";
import { radius, spacing, useTheme } from "@/src/theme";
import { Btn, Card, Header, IconBtn, Ionicons, T, useToast } from "@/src/ui";

export default function Consent() {
  const { setUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try {
      setUser(await api("/auth/consent", { method: "POST" }));
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="consent-screen">
      <Header title="الموافقة على الشروط" right={<IconBtn testID="consent-logout-button" icon="log-out-outline" onPress={logout} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ maxHeight: 260 }}>
          <ScrollView nestedScrollEnabled><T v="caption" style={{ lineHeight: 22 }}>{TERMS}{"\n\n"}{PRIVACY}</T></ScrollView>
        </Card>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Btn testID="open-terms-button" small variant="ghost" title="شروط الاستخدام" onPress={() => router.push("/legal?doc=terms")} />
          <Btn testID="open-privacy-button" small variant="ghost" title="سياسة الخصوصية" onPress={() => router.push("/legal?doc=privacy")} />
        </View>
        <Pressable testID="consent-checkbox" onPress={() => setAgree(!agree)} style={{ flexDirection: "row", gap: spacing.md, alignItems: "center", minHeight: 44 }}>
          <View style={{ width: 26, height: 26, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.brandPrimary, backgroundColor: agree ? colors.brandPrimary : "transparent", alignItems: "center", justifyContent: "center" }}>
            {agree && <Ionicons name="checkmark" size={18} color={colors.onBrandPrimary} />}
          </View>
          <T style={{ flex: 1 }}>قرأت وأوافق على شروط الاستخدام وسياسة الخصوصية</T>
        </Pressable>
      </ScrollView>
      <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Btn testID="accept-consent-button" title="موافق ومتابعة" icon="checkmark-circle-outline" disabled={!agree} loading={busy} onPress={accept} />
      </View>
    </View>
  );
}
