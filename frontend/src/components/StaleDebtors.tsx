import { View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useDebtReminder } from "@/src/debtReminder";
import { useApi } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Badge, Card, IconBtn, Row, Section, T } from "@/src/ui";

// Debtors not contacted in 7 days (a weekly notification also lists them for the accountant).
export function StaleDebtorsCard() {
  const q = useApi<any[]>("/debts/stale");
  const remind = useDebtReminder();
  if (!q.data) return null;
  const list = q.data;
  return (
    <Section title="مدينون لم يتم تذكيرهم منذ 7 أيام">
      <Card testID="stale-debtors-card" style={{ padding: 0, overflow: "hidden" }}>
        {!list.length ? (
          <View style={{ padding: spacing.lg }}>
            <T color="success" style={{ textAlign: "center" }}>تم التواصل مع جميع العملاء المدينين خلال آخر 7 أيام</T>
          </View>
        ) : (
          <>
            {list.slice(0, 5).map((c) => (
              <Row
                key={c.id}
                testID={`stale-debtor-${c.id}`}
                icon="time-outline"
                title={c.name}
                subtitle={`${c.distributor_name ? `${c.distributor_name} · ` : ""}${c.last_reminder_at ? `آخر تذكير: ${fmtDate(c.last_reminder_at)}` : "لم يتم تذكيره بعد"}`}
                right={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Badge text={money(c.balance)} tone="warning" />
                    <IconBtn testID={`stale-remind-${c.id}`} icon="logo-whatsapp" tone="brand" onPress={() => remind(c)} />
                  </View>
                }
              />
            ))}
            {list.length > 5 && <T v="caption" style={{ textAlign: "center", padding: spacing.md }}>و{list.length - 5} عملاء آخرون في تبويب الديون</T>}
          </>
        )}
      </Card>
    </Section>
  );
}
