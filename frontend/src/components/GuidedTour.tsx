import { useEffect, useState } from "react";
import { Modal, View } from "react-native";

import { radius, spacing, useTheme } from "@/src/theme";
import { Btn, IconName, Ionicons, T } from "@/src/ui";
import { storage } from "@/src/utils/storage";

type Step = { icon: IconName; title: string; desc: string };

let replayListener: (() => void) | null = null;
// Re-open the tour of the currently mounted role (from the account menu).
export const replayTour = () => replayListener?.();

// First-run walkthrough that explains each bottom tab. Shown once per role on this device.
export function GuidedTour({ tourKey, tabs }: { tourKey: string; tabs: { icon: IconName; title: string; desc?: string }[] }) {
  const { colors } = useTheme();
  const [step, setStep] = useState(-1);
  const key = `tour_done_${tourKey}`;

  useEffect(() => {
    storage.getItem(key, false).then((done) => {
      if (!done) setStep(0);
    });
    replayListener = () => setStep(0);
    return () => {
      replayListener = null;
    };
  }, [key]);

  const steps: Step[] = [
    { icon: "sparkles-outline", title: "مرحباً بك في النظام الذكي", desc: "جولة سريعة تعرّفك على أقسام التطبيق. يمكنك إعادتها في أي وقت من قائمة «حسابي»." },
    ...tabs.map((t) => ({ icon: t.icon, title: t.title, desc: t.desc ?? "" })),
  ];
  const finish = () => {
    storage.setItem(key, true);
    setStep(-1);
  };
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <Modal visible={step >= 0} transparent animationType="fade" onRequestClose={finish} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: spacing.xl }}>
        {s && (
          <View testID="guided-tour" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg, alignItems: "center" }}>
            <T v="caption" testID="tour-step-label">{step === 0 ? "جولة تعريفية" : `القسم ${step} من ${steps.length - 1} · في الشريط السفلي`}</T>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={s.icon} size={40} color={colors.brandPrimary} />
            </View>
            <T v="title" style={{ textAlign: "center" }} testID="tour-step-title">{s.title}</T>
            <T color="onSurfaceSecondary" style={{ textAlign: "center" }}>{s.desc}</T>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {steps.map((_, i) => (
                <View key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? colors.brandPrimary : colors.border }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" }}>
              {step > 0 && <Btn testID="tour-back-button" style={{ flex: 1 }} variant="secondary" title="السابق" onPress={() => setStep(step - 1)} />}
              <Btn testID="tour-next-button" style={{ flex: 1 }} title={last ? "ابدأ الآن" : "التالي"} icon={last ? "checkmark" : undefined} onPress={() => (last ? finish() : setStep(step + 1))} />
            </View>
            {!last && <Btn testID="tour-skip-button" small variant="ghost" title="تخطي الجولة" onPress={finish} />}
          </View>
        )}
      </View>
    </Modal>
  );
}
