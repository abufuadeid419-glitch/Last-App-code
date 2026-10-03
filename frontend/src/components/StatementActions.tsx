import { fmtDate, money } from "@/src/api";
import { DocActions } from "@/src/components/DocActions";
import { useApi } from "@/src/hooks";
import { statementReceipt } from "@/src/receipts";

const typeLabel: Record<string, string> = { SALE: "فاتورة مبيعات", COLLECTION: "سند قبض", RETURN: "مرتجع مبيعات" };

function waText(data: any, org: any) {
  const c = data.customer;
  const t = data.rows.reduce((a: any, r: any) => ({ debit: a.debit + r.debit, credit: a.credit + r.credit }), { debit: 0, credit: 0 });
  const last = data.rows.slice(-5).map((r: any) => `• ${fmtDate(r.date)} ${typeLabel[r.type] ?? r.type} ${r.ref}: ${r.debit ? `مدين ${money(r.debit)}` : ""}${r.debit && r.credit ? " / " : ""}${r.credit ? `دائن ${money(r.credit)}` : ""}`);
  const lines = [`*${org?.name ?? ""}*`, `كشف حساب: ${c.name}`, `التاريخ: ${fmtDate(new Date().toISOString())}`, "", `إجمالي المدين: ${money(t.debit)}`, `إجمالي الدائن: ${money(t.credit)}`, `*الرصيد المستحق: ${money(c.balance)} ${org?.currency ?? ""}*`];
  if (last.length) lines.push("", "آخر الحركات:", ...last);
  if (org?.phone) lines.push("", `للاستفسار: ${org.phone}`);
  return lines.join("\n");
}

// PDF / print / WhatsApp for a customer statement (data = GET /customers/{id}/statement).
export function StatementActions({ data }: { data: any }) {
  const org = useApi<any>("/org/profile");
  const logo = useApi<any>("/org/logo");
  return (
    <DocActions
      idPrefix="statement"
      title={`كشف حساب - ${data.customer.name}`}
      phone={data.customer.phone}
      waTitle="إرسال ملخص واتساب"
      make={() => statementReceipt(data, org.data, logo.data?.data_uri ?? null)}
      waText={() => waText(data, org.data)}
    />
  );
}
