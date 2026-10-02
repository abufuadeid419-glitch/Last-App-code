import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/src/api";
import { useApi, useMutate } from "@/src/hooks";
import { queryClient } from "@/src/query-client";
import { radius, spacing, useTheme } from "@/src/theme";
import { Btn, Card, Field, Ionicons, Loading, T, useToast } from "@/src/ui";

const FIELDS: { k: string; label: string; kb?: any }[] = [
  { k: "name", label: "اسم المؤسسة" },
  { k: "phone", label: "الهاتف", kb: "phone-pad" },
  { k: "email", label: "البريد الإلكتروني", kb: "email-address" },
  { k: "address", label: "العنوان" },
  { k: "tax_no", label: "الرقم الضريبي" },
  { k: "cr_no", label: "رقم السجل التجاري" },
  { k: "invoice_footer", label: "نص أسفل الفاتورة" },
];

export function OrgProfile() {
  const { colors } = useTheme();
  const toast = useToast();
  const profile = useApi<any>("/org/profile");
  const logo = useApi<any>("/org/logo");
  const [form, setForm] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const save = useMutate("PUT", "/org/profile", "تم حفظ بيانات المؤسسة");

  useEffect(() => {
    if (profile.data && !form) setForm(profile.data);
  }, [profile.data, form]);

  const pick = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) return setBlocked(true);
      const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!r.granted) return setBlocked(!r.canAskAgain);
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    setUploading(true);
    try {
      await api("/org/logo", { method: "POST", body: { data: res.assets[0].base64, content_type: res.assets[0].mimeType ?? "image/jpeg" } });
      await queryClient.invalidateQueries({ queryKey: ["/org/logo"] });
      toast("تم رفع الشعار");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  if (!form) return <Loading />;
  return (
    <View style={{ gap: spacing.lg }} testID="org-profile">
      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
        <View style={{ width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {logo.data?.data_uri ? <Image testID="org-logo-image" source={{ uri: logo.data.data_uri }} style={{ width: 80, height: 80 }} contentFit="contain" /> : <Ionicons name="image-outline" size={32} color={colors.muted} />}
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <T v="label">شعار المؤسسة</T>
          <T v="caption">يظهر في رأس الفواتير PDF</T>
          <Btn testID="upload-logo-button" small variant="secondary" icon="cloud-upload-outline" title={logo.data?.data_uri ? "تغيير الشعار" : "رفع الشعار"} loading={uploading} onPress={pick} />
          {blocked && <Btn testID="photos-open-settings-button" small variant="ghost" title="فتح الإعدادات للسماح بالصور" onPress={() => Linking.openSettings()} />}
        </View>
      </Card>
      {FIELDS.map((f) => (
        <Field key={f.k} testID={`org-${f.k}-input`} label={f.label} keyboardType={f.kb} value={form[f.k]} onChangeText={(v) => setForm({ ...form, [f.k]: v })} />
      ))}
      <Btn testID="save-org-profile-button" title="حفظ بيانات المؤسسة" icon="checkmark" loading={save.isPending} onPress={() => save.mutate(form)} />
    </View>
  );
}
