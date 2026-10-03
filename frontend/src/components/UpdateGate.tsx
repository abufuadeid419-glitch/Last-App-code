import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { fonts, spacing, useTheme } from "@/src/theme";
import { Btn, Empty, Ionicons, T } from "@/src/ui";

const cmp = (a: string, b: string) => {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
};

// Checks the latest version published by the developer; blocks on force updates, else shows a banner.
export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [latest, setLatest] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const current = Constants.expoConfig?.version ?? "1.0.0";

  useEffect(() => {
    api(`/app-version/latest?platform=${Platform.OS}`).then(setLatest).catch(() => {});
  }, []);

  const outdated = latest && cmp(latest.version, current) > 0;
  if (outdated && latest.force_update) {
    return (
      <View testID="force-update-screen" style={{ flex: 1, justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface }}>
        <Empty icon="cloud-download-outline" text={`يتوفر إصدار جديد إلزامي (${latest.version}). يرجى التحديث للمتابعة.`} />
        {!!latest.release_notes && <T v="caption" style={{ textAlign: "center" }}>{latest.release_notes}</T>}
        {!!latest.store_url && <Btn testID="force-update-button" title="تحديث الآن" icon="download-outline" onPress={() => Linking.openURL(latest.store_url)} />}
      </View>
    );
  }
  return (
    <>
      {children}
      {outdated && !dismissed && (
        <Pressable
          testID="update-banner"
          onPress={() => latest.store_url && Linking.openURL(latest.store_url)}
          style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom: insets.bottom + 90, backgroundColor: colors.surfaceInverse, borderRadius: 12, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
        >
          <Ionicons name="sparkles-outline" size={20} color={colors.onSurfaceInverse} />
          <T style={{ flex: 1, color: colors.onSurfaceInverse, fontFamily: fonts.semibold, fontSize: 13 }}>يتوفر إصدار جديد {latest.version}</T>
          <Pressable testID="dismiss-update-banner" hitSlop={10} onPress={() => setDismissed(true)}>
            <Ionicons name="close" size={20} color={colors.onSurfaceInverse} />
          </Pressable>
        </Pressable>
      )}
    </>
  );
}
