import { fmtDate, money } from "@/src/api";
import { DocActions } from "@/src/components/DocActions";
import { useApi } from "@/src/hooks";
import { invoiceReceipt } from "@/src/receipts";

function waText(doc: any, org: any) {
  const lines = [
    `*${org?.name ?? ""}*`,
    `${doc.return_no ? "مرتجع" : "فاتورة"} رقم: ${doc.invoice_no ?? doc.return_no}`,
    `التاريخ: ${fmtDate(doc.created_at)}`,
    `العميل: ${doc.customer_name}`,
    "",
    ...doc.items.map((i: any) => `• ${i.product_name} × ${money(i.quantity)} = ${money(i.total)}`),
    "",
    `الإجمالي: ${money(doc.total)}`,
  ];
  if (doc.paid_amount !== undefined) lines.push(`المدفوع: ${money(doc.paid_amount)}`, `المتبقي: ${money(doc.remaining)}`);
  if (org?.phone) lines.push("", `للاستفسار: ${org.phone}`);
  return lines.join("\n");
}

export function InvoiceActions({ doc }: { doc: any }) {
  const org = useApi<any>("/org/profile");
  const logo = useApi<any>("/org/logo");
  const customers = useApi<any[]>("/customers");
  const customer = customers.data?.find((c) => c.id === doc.customer_id);
  return (
    <DocActions
      idPrefix="invoice"
      title={doc.invoice_no ?? doc.return_no}
      phone={customer?.phone}
      waTitle="إرسال واتساب"
      make={() => invoiceReceipt(doc, org.data, logo.data?.data_uri ?? null, customer)}
      waText={() => waText(doc, org.data)}
    />
  );
}
