import { View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useApi } from "@/src/hooks";
import { offlineDeliveryAction } from "@/src/offlineActions";
import { spacing, useTheme } from "@/src/theme";
import { Btn, Card, Section, T, useToast } from "@/src/ui";

// Distributor: confirm or reject shipments sent by the owner before stock enters own inventory.
export function PendingDeliveries() {
  const { colors } = useTheme();
  const toast = useToast();
  const q = useApi<any[]>("/deliveries");
  const pending = (q.data ?? []).filter((d) => d.status === "PENDING");
  if (!pending.length) return null;
  const act = async (d: any, a: "confirm" | "reject") => {
    await offlineDeliveryAction(d, a);
    toast(a === "confirm" ? "تم تأكيد الاستلام وإضافة الكميات لمخزونك" : "تم رفض الشحنة");
  };
  return (
    <Section title="شحنات بانتظار التأكيد">
      {pending.map((d) => (
        <Card key={d.id} testID={`pending-delivery-${d.id}`} style={{ gap: spacing.sm, borderColor: colors.warning }}>
          <T v="caption">{fmtDate(d.created_at)}{d.notes ? ` · ${d.notes}` : ""}</T>
          {d.items.map((it: any) => (
            <T key={it.product_id}>• {it.product_name} × {money(it.quantity)}</T>
          ))}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Btn testID={`confirm-delivery-${d.id}`} small style={{ flex: 1 }} icon="checkmark-done" title="تأكيد الاستلام" onPress={() => act(d, "confirm")} />
            <Btn testID={`reject-delivery-${d.id}`} small variant="ghost" icon="close" title="رفض" onPress={() => act(d, "reject")} />
          </View>
        </Card>
      ))}
    </Section>
  );
}
