import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PRIVACY, TERMS } from "@/src/legal";
import { spacing, useTheme } from "@/src/theme";
import { Header, IconBtn, T } from "@/src/ui";

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const text = doc === "privacy" ? PRIVACY : TERMS;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="legal-screen">
      <Header title={doc === "privacy" ? "سياسة الخصوصية" : "شروط الاستخدام"} right={<IconBtn testID="legal-back-button" icon="arrow-forward" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <T style={{ lineHeight: 28 }}>{text}</T>
      </ScrollView>
    </View>
  );
}
