import { fmtDate, money } from "@/src/api";
import { DocActions } from "@/src/components/DocActions";
import { useApi } from "@/src/hooks";
import { collectionReceipt, paymentReceipt, warehouseReturnReceipt } from "@/src/receipts";
import { spacing } from "@/src/theme";
import { Badge, Card, Sheet, T } from "@/src/ui";

export type VoucherKind = "collection" | "payment" | "wreturn";

const STATUS: Record<string, { text: string; tone: "warning" | "success" | "error" }> = {
  PENDING: { text: "بانتظار استلام المستودع", tone: "warning" },
  ACCEPTED: { text: "تم الاستلام", tone: "success" },
  REJECTED: { text: "مرفوض", tone: "error" },
};
export const wreturnStatus = (s: string) => STATUS[s] ?? STATUS.PENDING;

// Receipt voucher (سند قبض), payment voucher (سند صرف) or warehouse return note, with 80mm print / PDF / WhatsApp.
export function VoucherSheet({ kind, doc, onClose }: { kind: VoucherKind; doc: any | null; onClose: () => void }) {
  const org = useApi<any>("/org/profile", !!doc);
  const logo = useApi<any>("/org/logo", !!doc);
  const customers = useApi<any[]>("/customers", !!doc && kind !== "wreturn");
  const customer = customers.data?.find((c) => c.id === doc?.customer_id);
  const no = doc?.receipt_no ?? doc?.voucher_no ?? doc?.return_no ?? "";
  const o = org.data;
  const make = () =>
    kind === "collection"
      ? collectionReceipt(doc, o, logo.data?.data_uri ?? null, customer)
      : kind === "payment"
        ? paymentReceipt(doc, o, logo.data?.data_uri ?? null, customer)
        : warehouseReturnReceipt(doc, o, logo.data?.data_uri ?? null);
  const waText = () =>
    kind === "wreturn"
      ? [`*${o?.name ?? ""}*`, `إذن إرجاع للمستودع: ${no}`, `التاريخ: ${fmtDate(doc.created_at)}`, ...doc.items.map((i: any) => `• ${i.product_name} × ${money(i.quantity)}`)].join("\n")
      : [
          `*${o?.name ?? ""}*`,
          `${kind === "collection" ? "سند قبض" : "سند صرف"} رقم: ${no}`,
          `التاريخ: ${fmtDate(doc.created_at)}`,
          `${kind === "collection" ? "استلمنا من" : "صُرف إلى"}: ${doc.customer_name}`,
          `المبلغ: ${money(doc.amount)} ${o?.currency ?? ""}`,
          ...(customer ? [`الرصيد الحالي: ${money(customer.balance)}`] : []),
          "",
          "شكراً لتعاملكم معنا",
        ].join("\n");

  return (
    <Sheet testID="voucher-detail-sheet" visible={!!doc} onClose={onClose} title={no}>
      {doc && (
        <>
          <Card style={{ gap: spacing.xs }}>
            {kind === "wreturn" ? (
              <>
                <T v="h2">إرجاع إلى المستودع</T>
                <T v="caption">{doc.distributor_name} · {fmtDate(doc.created_at)}</T>
                <Badge testID="voucher-status-badge" text={wreturnStatus(doc.status).text} tone={wreturnStatus(doc.status).tone} />
                {doc.items.map((it: any, i: number) => <T key={i}>{it.product_name} × {money(it.quantity)}</T>)}
                {!!doc.reject_reason && <T v="caption" color="error">سبب الرفض: {doc.reject_reason}</T>}
              </>
            ) : (
              <>
                <T v="h2">{doc.customer_name}</T>
                <T v="caption">{kind === "collection" ? `المحصّل: ${doc.collector_name ?? "—"}` : `الموزع: ${doc.distributor_name ?? "—"}`} · {fmtDate(doc.created_at)}</T>
                <T v="h2" color={kind === "collection" ? "success" : "warning"} testID="voucher-detail-amount">المبلغ: {money(doc.amount)}</T>
                {customer && <T>رصيد العميل الحالي: {money(customer.balance)}</T>}
              </>
            )}
            {!!doc.notes && <T v="caption">{doc.notes}</T>}
            {doc.pending && <Badge text="بانتظار المزامنة" tone="warning" />}
          </Card>
          {!doc.pending && (
            <DocActions idPrefix={kind === "collection" ? "receipt" : kind} title={no} phone={customer?.phone} waTitle="إرسال واتساب" make={make} waText={waText} />
          )}
        </>
      )}
    </Sheet>
  );
}
