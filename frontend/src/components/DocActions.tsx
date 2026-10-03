import { Linking, Platform, View } from "react-native";

import { printReceipt, shareReceipt } from "@/src/printDoc";
import { ReceiptDoc } from "@/src/receipts";
import { spacing } from "@/src/theme";
import { Btn, T, useToast } from "@/src/ui";

export const normPhone = (p?: string) => (p ?? "").replace(/[^\d]/g, "").replace(/^00/, "");

export function openWhatsApp(phone: string | undefined, text: string) {
  return Linking.openURL(`https://wa.me/${normPhone(phone)}?text=${encodeURIComponent(text)}`);
}

// PDF / print (80mm thermal) / WhatsApp buttons shared by invoices, receipts and statements.
export function DocActions({ make, title, phone, waText, waTitle, idPrefix }: { make: () => ReceiptDoc; title: string; phone?: string; waText: () => string; waTitle: string; idPrefix: string }) {
  const toast = useToast();
  const share = async () => {
    try {
      await shareReceipt(make(), title);
    } catch (e: any) {
      toast(e?.message ?? "تعذر إنشاء الملف", "error");
    }
  };
  const print = async () => {
    try {
      await printReceipt(make());
    } catch {}
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Btn testID={`${idPrefix}-share-pdf-button`} style={{ flex: 1 }} small title={Platform.OS === "web" ? "PDF / حفظ" : "PDF / مشاركة"} icon="document-text-outline" onPress={share} />
        <Btn testID={`${idPrefix}-print-button`} style={{ flex: 1 }} small variant="secondary" title="طباعة" icon="print-outline" onPress={print} />
      </View>
      <Btn testID={`${idPrefix}-whatsapp-button`} small variant="secondary" icon="logo-whatsapp" title={phone ? `${waTitle} إلى ${phone}` : waTitle} onPress={() => openWhatsApp(phone, waText()).catch(() => toast("تعذر فتح واتساب", "error"))} />
      <T v="caption" style={{ textAlign: "center" }} testID={`${idPrefix}-paper-size`}>
        مقاس الطباعة: ورق حراري 80 مم{Platform.OS !== "web" ? " · لإرسال الملف عبر واتساب اختر «PDF / مشاركة» ثم واتساب" : ""}
      </T>
    </View>
  );
}
