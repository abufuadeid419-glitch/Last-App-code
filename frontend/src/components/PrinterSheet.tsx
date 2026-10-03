import { useEffect, useState } from "react";
import { Linking, View } from "react-native";

import { bondedPrinters, BtPrinter, btPermissionGranted, requestBtPermission, savePrinter } from "@/src/bluetooth";
import { spacing, useTheme } from "@/src/theme";
import { Btn, Card, Empty, Ionicons, Loading, Row, Sheet, T } from "@/src/ui";

type Stage = "loading" | "explain" | "denied" | "blocked" | "list" | "error";

// Choose a paired Bluetooth printer (with the Bluetooth permission flow).
export function PrinterSheet({ visible, onClose, onPicked }: { visible: boolean; onClose: () => void; onPicked: (p: BtPrinter) => void }) {
  const { colors } = useTheme();
  const [stage, setStage] = useState<Stage>("loading");
  const [devices, setDevices] = useState<BtPrinter[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    setStage("loading");
    try {
      setDevices(await bondedPrinters());
      setStage("list");
    } catch (e: any) {
      setError(e?.message ?? "تعذر قراءة الأجهزة المقترنة");
      setStage("error");
    }
  };

  useEffect(() => {
    if (!visible) return;
    btPermissionGranted().then((ok) => (ok ? load() : setStage("explain")));
  }, [visible]);

  const ask = async () => {
    const r = await requestBtPermission();
    if (r === "granted") load();
    else setStage(r === "blocked" || stage === "denied" ? "blocked" : "denied");
  };

  const pick = async (p: BtPrinter) => {
    await savePrinter(p);
    onPicked(p);
  };

  return (
    <Sheet testID="printer-sheet" visible={visible} onClose={onClose} title="طابعة البلوتوث">
      {stage === "loading" ? (
        <Loading />
      ) : stage === "explain" || stage === "denied" ? (
        <Card style={{ gap: spacing.md, alignItems: "center" }}>
          <Ionicons name="bluetooth" size={36} color={colors.brandPrimary} />
          <T style={{ textAlign: "center" }}>
            {stage === "denied" ? "لم يتم منح الإذن. " : ""}نحتاج إذن «الأجهزة القريبة» للاتصال بطابعة الإيصالات وطباعة الفواتير مباشرة.
          </T>
          <Btn testID="bt-permission-button" title={stage === "denied" ? "المحاولة مرة أخرى" : "السماح والمتابعة"} icon="checkmark" onPress={ask} />
        </Card>
      ) : stage === "blocked" ? (
        <Card style={{ gap: spacing.md, alignItems: "center" }}>
          <T style={{ textAlign: "center" }}>إذن البلوتوث مرفوض. فعّل «الأجهزة القريبة» من إعدادات التطبيق لاستخدام الطابعة.</T>
          <Btn testID="bt-open-settings-button" title="فتح الإعدادات" icon="settings-outline" onPress={() => Linking.openSettings()} />
        </Card>
      ) : stage === "error" ? (
        <Card style={{ gap: spacing.md, alignItems: "center" }}>
          <T style={{ textAlign: "center" }}>{error}</T>
          <Btn testID="bt-retry-button" small title="إعادة المحاولة" icon="refresh" onPress={load} />
        </Card>
      ) : (
        <>
          <T v="caption">اختر الطابعة من الأجهزة المقترنة. إن لم تظهر، اقترن بها أولاً من إعدادات البلوتوث في الهاتف.</T>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {!devices.length ? (
              <Empty icon="print-outline" text="لا توجد أجهزة مقترنة" />
            ) : (
              devices.map((d) => <Row key={d.address} testID={`bt-device-${d.address}`} icon="print-outline" title={d.name} subtitle={d.address} onPress={() => pick(d)} />)
            )}
          </Card>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Btn testID="bt-open-bt-settings" style={{ flex: 1 }} small variant="secondary" icon="bluetooth" title="إعدادات البلوتوث" onPress={() => Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS").catch(() => Linking.openSettings())} />
            <Btn testID="bt-refresh-button" style={{ flex: 1 }} small variant="secondary" icon="refresh" title="تحديث القائمة" onPress={load} />
          </View>
        </>
      )}
    </Sheet>
  );
}
