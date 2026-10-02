import { useState } from "react";
import { View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useApi, useMutate } from "@/src/hooks";
import { offlineStockRequest } from "@/src/offlineActions";
import { spacing } from "@/src/theme";
import { Badge, Btn, Card, Empty, IconBtn, Row, Section, T, useToast } from "@/src/ui";

const LOW_MIN = 5;
const isLow = (i: any) => i.quantity <= Math.max(i.min_stock ?? 0, LOW_MIN);
const suggestQty = (i: any) => Math.max(10, (i.min_stock ?? 0) * 2);
const statusBadge: Record<string, { t: string; tone: "warning" | "success" | "error" }> = {
  PENDING: { t: "قيد الانتظار", tone: "warning" },
  FULFILLED: { t: "تم التسليم", tone: "success" },
  REJECTED: { t: "مرفوض", tone: "error" },
};

// Distributor: own stock with low-stock highlight and one-tap restock request.
export function AgentStock() {
  const toast = useToast();
  const inv = useApi<any[]>("/my/inventory");
  const reqs = useApi<any[]>("/stock-requests");
  const [sending, setSending] = useState(false);
  const items = inv.data ?? [];
  const low = items.filter(isLow);
  const pendingIds = new Set((reqs.data ?? []).filter((r) => r.status === "PENDING").flatMap((r) => r.items.map((x: any) => x.product_id)));
  const lowToRequest = low.filter((i) => !pendingIds.has(i.product_id));

  const request = async (list: any[]) => {
    setSending(true);
    try {
      await offlineStockRequest(list.map((i) => ({ product_id: i.product_id, product_name: i.product_name, quantity: suggestQty(i) })));
      toast("تم إرسال طلب التعبئة للمالك");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Section title="مخزوني الحالي" action={low.length ? <Badge text={`${low.length} منخفض`} tone="warning" /> : undefined}>
        {lowToRequest.length > 0 && (
          <Btn testID="request-low-stock-button" icon="flash-outline" title={`طلب تعبئة ${lowToRequest.length} صنف منخفض`} loading={sending} onPress={() => request(lowToRequest)} />
        )}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {!items.length ? (
            <Empty icon="cube-outline" text="لا يوجد مخزون لديك. اطلب من المالك تسليمك بضاعة." />
          ) : (
            items.map((i) => (
              <Row
                key={i.product_id}
                testID={`my-stock-${i.product_id}`}
                icon={isLow(i) ? "warning-outline" : "cube-outline"}
                title={i.product_name}
                subtitle={`السعر: ${money(i.sale_price)}${pendingIds.has(i.product_id) ? " · طلب تعبئة قيد الانتظار" : ""}`}
                right={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Badge text={money(i.quantity)} tone={isLow(i) ? "warning" : "brand"} />
                    {!pendingIds.has(i.product_id) && <IconBtn testID={`request-stock-${i.product_id}`} icon="add-circle-outline" onPress={() => request([i])} />}
                  </View>
                }
              />
            ))
          )}
        </Card>
      </Section>
      {!!reqs.data?.length && (
        <Section title="طلبات التعبئة">
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {reqs.data.slice(0, 5).map((r) => (
              <Row key={r.id} testID={`my-stock-request-${r.id}`} icon="file-tray-full-outline" title={r.items.map((x: any) => `${x.product_name} ×${x.quantity}`).join("، ")} subtitle={fmtDate(r.created_at)} right={<Badge text={r.pending ? "بانتظار المزامنة" : statusBadge[r.status].t} tone={r.pending ? "warning" : statusBadge[r.status].tone} />} />
            ))}
          </Card>
        </Section>
      )}
    </>
  );
}

// Owner: pending restock requests with fulfill (creates a delivery) / reject.
export function OwnerStockRequests() {
  const reqs = useApi<any[]>("/stock-requests");
  const fulfill = useMutate<any>("POST", (b) => `/stock-requests/${b.id}/fulfill`, "تم تسليم الطلب للموزع");
  const reject = useMutate<any>("POST", (b) => `/stock-requests/${b.id}/reject`, "تم رفض الطلب");
  const pending = (reqs.data ?? []).filter((r) => r.status === "PENDING");
  if (!pending.length) return null;
  return (
    <Section title="طلبات تعبئة من الموزعين" action={<Badge text={String(pending.length)} tone="warning" />}>
      {pending.map((r) => (
        <Card key={r.id} testID={`stock-request-${r.id}`} style={{ gap: spacing.sm }}>
          <T v="label">{r.distributor_name}</T>
          <T v="caption">{fmtDate(r.created_at)}</T>
          {r.items.map((x: any) => (
            <T key={x.product_id}>• {x.product_name} × {money(x.quantity)}</T>
          ))}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Btn testID={`fulfill-request-${r.id}`} small style={{ flex: 1 }} icon="car-outline" title="تسليم الآن" loading={fulfill.isPending} onPress={() => fulfill.mutate(r)} />
            <Btn testID={`reject-request-${r.id}`} small variant="ghost" icon="close" title="رفض" onPress={() => reject.mutate(r)} />
          </View>
        </Card>
      ))}
    </Section>
  );
}
