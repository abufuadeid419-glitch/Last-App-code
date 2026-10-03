import { fmtDate, money } from "@/src/api";
import { DocActions } from "@/src/components/DocActions";
import { useApi } from "@/src/hooks";
import { collectionReceipt } from "@/src/receipts";
import { spacing } from "@/src/theme";
import { Card, Sheet, T } from "@/src/ui";

// Collection receipt (سند قبض) details with 80mm print / PDF / WhatsApp.
export function ReceiptSheet({ col, onClose }: { col: any | null; onClose: () => void }) {
  const org = useApi<any>("/org/profile", !!col);
  const logo = useApi<any>("/org/logo", !!col);
  const customers = useApi<any[]>("/customers", !!col);
  const customer = customers.data?.find((c) => c.id === col?.customer_id);
  const waText = () =>
    [
      `*${org.data?.name ?? ""}*`,
      `سند قبض رقم: ${col.receipt_no}`,
      `التاريخ: ${fmtDate(col.created_at)}`,
      `استلمنا من: ${col.customer_name}`,
      `المبلغ: ${money(col.amount)} ${org.data?.currency ?? ""}`,
      ...(customer ? [`الرصيد المتبقي: ${money(customer.balance)}`] : []),
      "",
      "شكراً لتعاملكم معنا",
    ].join("\n");
  return (
    <Sheet testID="receipt-detail-sheet" visible={!!col} onClose={onClose} title={col?.receipt_no ?? ""}>
      {col && (
        <>
          <Card style={{ gap: spacing.xs }}>
            <T v="h2">{col.customer_name}</T>
            <T v="caption">المحصّل: {col.collector_name ?? "—"} · {fmtDate(col.created_at)}</T>
            <T v="h2" color="success" testID="receipt-detail-amount">المبلغ: {money(col.amount)}</T>
            {!!col.notes && <T v="caption">{col.notes}</T>}
            {customer && <T color="warning">الرصيد المتبقي: {money(customer.balance)}</T>}
          </Card>
          <DocActions
            idPrefix="receipt"
            title={col.receipt_no}
            phone={customer?.phone}
            waTitle="إرسال واتساب"
            make={() => collectionReceipt(col, org.data, logo.data?.data_uri ?? null, customer)}
            waText={waText}
          />
        </>
      )}
    </Sheet>
  );
}
