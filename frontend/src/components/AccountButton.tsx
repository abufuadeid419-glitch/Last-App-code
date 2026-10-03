import { useRouter } from "expo-router";
import { useState } from "react";

import { NotificationBell } from "@/src/components/NotificationBell";
import { FAQ } from "@/src/legal";
import { useSyncState } from "@/src/offline";
import { View } from "react-native";

import { api, fmtDate, roleLabel } from "@/src/api";
import { useAuth } from "@/src/auth";
import { spacing } from "@/src/theme";
import { Badge, Btn, Card, IconBtn, Row, Sheet, T, useToast } from "@/src/ui";

export function AccountButton() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { pending } = useSyncState();
  const [help, setHelp] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const toast = useToast();
  const org = user?.org;
  return (
    <>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <NotificationBell />
        <IconBtn testID="account-button" icon="person-circle-outline" onPress={() => setOpen(true)} />
      </View>
      <Sheet
        testID="account-sheet"
        visible={open}
        onClose={() => setOpen(false)}
        title="حسابي"
        footer={<Btn testID="logout-button" variant="danger" icon="log-out-outline" title="تسجيل الخروج" onPress={() => { setOpen(false); logout(); }} />}
      >
        <Card style={{ gap: spacing.xs }}>
          <T v="h2" testID="account-name">{user?.name}</T>
          <T v="caption">{user?.email}</T>
          <Badge text={roleLabel(user)} />
        </Card>
        {org && (
          <Card style={{ gap: spacing.xs }}>
            <T v="label">{org.name}</T>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Badge text={org.plan === "TRIAL" ? "تجريبي" : "مرخّص"} tone={org.plan === "TRIAL" ? "warning" : "success"} />
              <Badge text={org.status === "ACTIVE" ? "فعّال" : "موقوف"} tone={org.status === "ACTIVE" ? "success" : "error"} />
            </View>
            <T v="caption">ينتهي الاشتراك: {fmtDate(org.expires_at)}</T>
            {user?.role === "OWNER" && (
              <Btn testID="open-upgrade-button" small title="ترقية الخطة" icon="rocket-outline" style={{ marginTop: spacing.sm }} onPress={() => { setOpen(false); router.push("/upgrade"); }} />
            )}
          </Card>
        )}
        {pending.length > 0 && (
          <T v="caption" color="error" testID="logout-pending-warning">تنبيه: لديك {pending.length} عملية غير متزامنة ستُفقد عند تسجيل الخروج.</T>
        )}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Row testID="open-help-button" icon="help-circle-outline" title="مركز المساعدة" onPress={() => setHelp(!help)} />
          {help && FAQ.map((f, i) => (
            <View key={i} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <T v="label">{f.q}</T>
              <T v="caption">{f.a}</T>
            </View>
          ))}
          <Row testID="account-terms-link" icon="document-text-outline" title="شروط الاستخدام" onPress={() => { setOpen(false); router.push("/legal?doc=terms"); }} />
          <Row testID="account-privacy-link" icon="shield-outline" title="سياسة الخصوصية" onPress={() => { setOpen(false); router.push("/legal?doc=privacy"); }} />
        </Card>
        {user?.role !== "OWNER" && (
          confirmDel ? (
            <Card style={{ gap: spacing.sm }}>
              <T color="error">سيتم حذف حسابك نهائياً. هل أنت متأكد؟</T>
              <Btn testID="confirm-delete-account-button" small variant="danger" title="نعم، احذف حسابي" onPress={async () => {
                try { await api("/auth/account", { method: "DELETE" }); setOpen(false); await logout(); } catch (e: any) { toast(e.message, "error"); }
              }} />
            </Card>
          ) : (
            <Btn testID="delete-account-button" small variant="ghost" title="حذف حسابي" icon="trash-outline" onPress={() => setConfirmDel(true)} />
          )
        )}
      </Sheet>
    </>
  );
}
