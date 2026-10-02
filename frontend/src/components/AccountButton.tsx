import { useState } from "react";
import { View } from "react-native";

import { fmtDate, roleLabel } from "@/src/api";
import { useAuth } from "@/src/auth";
import { spacing } from "@/src/theme";
import { Badge, Btn, Card, IconBtn, Sheet, T } from "@/src/ui";

export function AccountButton() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const org = user?.org;
  return (
    <>
      <IconBtn testID="account-button" icon="person-circle-outline" onPress={() => setOpen(true)} />
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
          </Card>
        )}
      </Sheet>
    </>
  );
}
