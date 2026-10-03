import { useState } from "react";
import { View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { VoucherSheet, wreturnStatus } from "@/src/components/VoucherSheet";
import { useApi, useMutate } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Badge, Btn, Card, Empty, Field, Row, Section, Sheet, T } from "@/src/ui";

// Owner: confirm or reject stock that distributors returned to the main warehouse.
export function OwnerWarehouseReturns() {
  const q = useApi<any[]>("/warehouse-returns");
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [doc, setDoc] = useState<any>(null);
  const accept = useMutate<any>("POST", (b) => `/warehouse-returns/${b.id}/accept`, "تم استلام المرتجع وإضافته للمستودع");
  const reject = useMutate<any>("POST", (b) => `/warehouse-returns/${b.id}/reject`, "تم رفض المرتجع وإعادة الكميات للموزع", () => {
    setRejecting(null);
    setReason("");
  });
  const pending = (q.data ?? []).filter((r) => r.status === "PENDING");
  const done = (q.data ?? []).filter((r) => r.status !== "PENDING").slice(0, 10);

  return (
    <>
      <Section title={`مرتجعات الموزعين للمستودع${pending.length ? ` (${pending.length})` : ""}`}>
        {!pending.length ? (
          <Card>
            <Empty icon="checkmark-done-outline" text="لا توجد مرتجعات بانتظار الاستلام" />
          </Card>
        ) : (
          pending.map((r) => (
            <Card key={r.id} testID={`wreturn-pending-${r.id}`} style={{ gap: spacing.sm }}>
              <T v="label">{r.return_no} · {r.distributor_name}</T>
              <T v="caption">{fmtDate(r.created_at)}{r.notes ? ` · ${r.notes}` : ""}</T>
              {r.items.map((it: any, i: number) => <T key={i}>• {it.product_name} × {money(it.quantity)}</T>)}
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Btn testID={`wreturn-accept-${r.id}`} style={{ flex: 1 }} small title="تأكيد الاستلام" icon="checkmark-circle-outline" loading={accept.isPending} onPress={() => accept.mutate(r)} />
                <Btn testID={`wreturn-reject-${r.id}`} style={{ flex: 1 }} small variant="danger" title="رفض" icon="close-circle-outline" onPress={() => setRejecting(r)} />
              </View>
            </Card>
          ))
        )}
      </Section>
      {!!done.length && (
        <Section title="سجل مرتجعات الموزعين">
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {done.map((r) => (
              <Row key={r.id} testID={`wreturn-row-${r.id}`} icon="business-outline" title={`${r.return_no} · ${r.distributor_name}`} subtitle={`${r.items.length} صنف · ${fmtDate(r.created_at)}`} onPress={() => setDoc(r)} right={<Badge text={wreturnStatus(r.status).text} tone={wreturnStatus(r.status).tone} />} />
            ))}
          </Card>
        </Section>
      )}
      <Sheet
        testID="wreturn-reject-sheet"
        visible={!!rejecting}
        onClose={() => setRejecting(null)}
        title="رفض المرتجع"
        footer={<Btn testID="confirm-wreturn-reject" variant="danger" title="تأكيد الرفض" icon="close-circle-outline" loading={reject.isPending} onPress={() => reject.mutate({ id: rejecting.id, reason })} />}
      >
        <T>ستُعاد الكميات إلى مخزون الموزع {rejecting?.distributor_name}.</T>
        <Field testID="wreturn-reject-reason" label="سبب الرفض" value={reason} onChangeText={setReason} />
      </Sheet>
      <VoucherSheet kind="wreturn" doc={doc} onClose={() => setDoc(null)} />
    </>
  );
}
