import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Platform, View } from "react-native";

import { api, fmtDate } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useApi, useMutate } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Badge, Btn, Card, Field, Section, T, useToast } from "@/src/ui";

// Owner settings: currencies, data backup export, and organization deletion request.
export function OrgSettings() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const org = user?.org ?? {};
  const [cur, setCur] = useState({ currency: org.currency ?? "ل.س", alt_currency: org.alt_currency ?? "", exchange_rate: String(org.exchange_rate ?? "") });
  const saveCur = useMutate("PUT", "/org/currency", "تم حفظ إعدادات العملة", () => refresh());
  const dels = useApi<any[]>("/deletion-requests");
  const pendingDel = dels.data?.find((d) => d.status === "PENDING");
  const [reason, setReason] = useState("");
  const reqDel = useMutate("POST", "/deletion-requests", "تم إرسال طلب حذف المؤسسة");
  const cancelDel = useMutate<any>("DELETE", (b) => `/deletion-requests/${b.id}`, "تم إلغاء طلب الحذف");
  const [exporting, setExporting] = useState(false);

  const exportBackup = async () => {
    setExporting(true);
    try {
      const data = await api("/backup/export");
      const json = JSON.stringify(data, null, 2);
      const name = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        a.download = name;
        a.click();
      } else {
        const uri = FileSystem.cacheDirectory + name;
        await FileSystem.writeAsStringAsync(uri, json);
        await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: name });
      }
      toast("تم تصدير النسخة الاحتياطية");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ gap: spacing.xl }} testID="org-settings">
      <Section title="العملات">
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field testID="currency-input" label="العملة الأساسية" value={cur.currency} onChangeText={(v) => setCur({ ...cur, currency: v })} /></View>
          <View style={{ flex: 1 }}><Field testID="alt-currency-input" label="عملة ثانوية" placeholder="USD" value={cur.alt_currency} onChangeText={(v) => setCur({ ...cur, alt_currency: v })} /></View>
        </View>
        <Field testID="exchange-rate-input" label={`سعر الصرف (1 ${cur.alt_currency || "عملة ثانوية"} = ? ${cur.currency})`} keyboardType="decimal-pad" value={cur.exchange_rate} onChangeText={(v) => setCur({ ...cur, exchange_rate: v })} />
        <Btn testID="save-currency-button" small title="حفظ العملات" icon="checkmark" loading={saveCur.isPending} onPress={() => saveCur.mutate({ ...cur, exchange_rate: +cur.exchange_rate || 0 })} />
      </Section>

      <Section title="النسخ الاحتياطي">
        <T v="caption">صدّر جميع بيانات المؤسسة (المنتجات، العملاء، الفواتير، التحصيلات، المشتريات...) كملف JSON.</T>
        <Btn testID="export-backup-button" variant="secondary" icon="cloud-download-outline" title="تصدير نسخة احتياطية" loading={exporting} onPress={exportBackup} />
      </Section>

      <Section title="حذف المؤسسة">
        {pendingDel ? (
          <Card style={{ gap: spacing.sm }}>
            <Badge text="طلب الحذف قيد المراجعة" tone="warning" />
            <T v="caption">أرسل في {fmtDate(pendingDel.created_at)}</T>
            <Btn testID="cancel-deletion-button" small variant="ghost" title="إلغاء طلب الحذف" onPress={() => cancelDel.mutate(pendingDel)} />
          </Card>
        ) : (
          <>
            <T v="caption">سيتم حذف جميع بيانات المؤسسة نهائياً بعد موافقة الإدارة. ننصح بتصدير نسخة احتياطية أولاً.</T>
            <Field testID="deletion-reason-input" label="سبب الحذف" value={reason} onChangeText={setReason} />
            <Btn testID="request-deletion-button" small variant="danger" icon="trash-outline" title="طلب حذف المؤسسة" loading={reqDel.isPending} onPress={() => reqDel.mutate({ reason })} />
          </>
        )}
      </Section>
    </View>
  );
}
