// 80mm thermal-receipt documents (sales invoice, return note, collection receipt, customer statement).
// Printable width is 72mm (4mm side padding). Monochrome layout for thermal printers.
import { fmtDate, money } from "@/src/api";

export type ReceiptDoc = { html: string; heightMm: number };
export const RECEIPT_MM = 80;

export const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;max-width:80mm;background:#fff;color:#000}
body{font-family:Tahoma,'Geeza Pro','Noto Naskh Arabic','Noto Sans Arabic','Droid Arabic Naskh','Segoe UI',Arial,system-ui,sans-serif;font-size:11.5px;line-height:1.45;-webkit-text-size-adjust:none;text-size-adjust:none}
.r{width:100%;padding:3.5mm 4mm 6mm;overflow-wrap:anywhere;word-break:break-word}
.logo{display:block;margin:0 auto 1.5mm;max-width:40mm;max-height:18mm;object-fit:contain}
.h1{font-size:15.5px;font-weight:700;text-align:center;line-height:1.3}
.sub{font-size:10px;text-align:center}
.title{font-size:13.5px;font-weight:700;text-align:center;margin:0.5mm 0 1.5mm}
.hr{border-top:1px dashed #000;margin:2mm 0}
.hr2{border-top:1.5px solid #000;margin:2mm 0}
.kv{display:flex;justify-content:space-between;align-items:baseline;gap:2mm}
.kv span{flex:0 0 auto;max-width:55%}
.kv b{flex:1 1 auto;min-width:0;font-weight:700;text-align:left}
.sm{font-size:10.5px}
.big{font-size:14px;border:1.5px solid #000;padding:1.5mm 2mm;margin:1.5mm 0}
.ih{display:flex;justify-content:space-between;gap:2mm;font-size:10px;font-weight:700;border-bottom:1px solid #000;padding-bottom:1mm;margin-bottom:0.5mm}
.it{padding:1mm 0;border-bottom:1px dotted #000}
.it:last-child{border-bottom:0}
.nm{font-weight:700}
.note{font-size:10.5px;margin-top:1.5mm}
.sign{margin-top:5mm;font-size:10.5px}
.foot{text-align:center;font-size:10.5px;font-weight:700}
.tiny{text-align:center;font-size:9px;margin-top:1mm}
.c{text-align:center}
`;

// Accumulates markup plus an estimated printed height (mm) so native PDFs come out as one 80mm strip.
class Receipt {
  html = "";
  mm = 12;
  add(html: string, mm: number) {
    this.html += html;
    this.mm += mm;
    return this;
  }
  hr(strong = false) {
    return this.add(`<div class="${strong ? "hr2" : "hr"}"></div>`, 4.5);
  }
  kv(label: string, value: string, o: { big?: boolean; sm?: boolean; ltr?: boolean } = {}) {
    const rows = Math.max(1, Math.ceil((label.length + value.replace(/<[^>]+>/g, "").length) / 34));
    return this.add(
      `<div class="kv${o.big ? " big" : ""}${o.sm ? " sm" : ""}"><span>${label}</span><b${o.ltr ? ' dir="ltr"' : ""}>${value}</b></div>`,
      o.big ? 10 : rows * 5,
    );
  }
  text(cls: string, html: string, perLine: number, lineMm: number) {
    const len = html.replace(/<[^>]+>/g, "").length;
    return this.add(`<div class="${cls}">${html}</div>`, Math.max(1, Math.ceil(len / perLine)) * lineMm);
  }
  page(): ReceiptDoc {
    // Per-line estimates are already generous (~15% over), so no extra buffer is added.
    const h = Math.max(90, Math.ceil(this.mm));
    return {
      heightMm: h,
      html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>@page{size:${RECEIPT_MM}mm ${h}mm;margin:0}${CSS}</style></head><body><div class="r">${this.html}</div></body></html>`,
    };
  }
}

const ltr = (s: any) => `<bdi dir="ltr">${esc(s)}</bdi>`;
const day = (iso: string) => fmtDate(iso).split(" ")[0];

function header(r: Receipt, org: any, logo: string | null, title: string, no: string | null, date: string) {
  if (logo) r.add(`<img class="logo" src="${logo}"/>`, 20);
  r.text("h1", esc(org?.name ?? ""), 26, 6.5);
  if (org?.address) r.text("sub", esc(org.address), 46, 4.3);
  if (org?.phone) r.text("sub", `هاتف: ${ltr(org.phone)}`, 46, 4.3);
  if (org?.tax_no) r.text("sub", `الرقم الضريبي: ${ltr(org.tax_no)}`, 46, 4.3);
  if (org?.cr_no) r.text("sub", `السجل التجاري: ${ltr(org.cr_no)}`, 46, 4.3);
  r.hr(true);
  r.text("title", title, 30, 7);
  if (no) r.kv("الرقم", esc(no), { ltr: true });
  r.kv("التاريخ", fmtDate(date));
  r.hr();
}

function footer(r: Receipt, org: any, sign?: string) {
  if (sign) r.add(`<div class="sign">${sign}: ..................................</div>`, 9);
  r.hr();
  r.text("foot", esc(org?.invoice_footer || "شكراً لتعاملكم معنا"), 40, 5);
  r.add(`<div class="tiny">طُبع في ${fmtDate(new Date().toISOString())}</div>`, 4.5);
}

const cur = (org: any) => esc(org?.currency ?? "");

export function invoiceReceipt(doc: any, org: any, logo: string | null, customer: any): ReceiptDoc {
  const r = new Receipt();
  const isReturn = !!doc.return_no;
  header(r, org, logo, isReturn ? "إشعار مرتجع مبيعات" : "فاتورة مبيعات", doc.invoice_no ?? doc.return_no, doc.created_at);
  r.kv("العميل", esc(doc.customer_name));
  if (customer?.phone) r.kv("الهاتف", esc(customer.phone), { ltr: true });
  r.kv(isReturn ? "الموزع" : "البائع", esc(doc.distributor_name ?? ""));
  if (doc.payment_type) r.kv("طريقة الدفع", doc.payment_type === "CASH" ? "نقدي" : "آجل");
  r.hr();
  r.add(`<div class="ih"><span>الصنف</span><span>الكمية × السعر = الإجمالي</span></div>`, 6);
  doc.items.forEach((it: any, i: number) => {
    const nm = `${i + 1}. ${esc(it.product_name)}`;
    r.add(
      `<div class="it"><div class="nm">${nm}</div><div class="kv sm"><span>${money(it.quantity)} × ${money(it.price)}</span><b>${money(it.total)}</b></div></div>`,
      Math.ceil(nm.length / 34) * 5 + 6,
    );
  });
  r.hr();
  if (doc.discount_amount > 0) {
    r.kv("المجموع", money(doc.subtotal));
    r.kv(`الخصم${doc.discount_type === "PERCENT" ? ` (${doc.discount_value}%)` : ""}`, `-${money(doc.discount_amount)}`, { ltr: true });
  }
  r.kv("الإجمالي", `${money(doc.total)} ${cur(org)}`, { big: true });
  if (org?.alt_currency && org?.exchange_rate) r.kv("ما يعادل", `${money(doc.total / org.exchange_rate)} ${esc(org.alt_currency)}`, { sm: true });
  if (doc.paid_amount !== undefined) {
    r.kv("المدفوع", money(doc.paid_amount));
    r.kv("المتبقي", money(doc.remaining));
  }
  if (customer) r.kv("رصيد العميل الحالي", money(customer.balance));
  if (doc.notes || doc.reason) r.text("note", `ملاحظات: ${esc(doc.notes || doc.reason)}`, 38, 5);
  r.kv("عدد الأصناف", String(doc.items.length), { sm: true });
  footer(r, org, doc.payment_type && doc.payment_type !== "CASH" ? "توقيع العميل" : undefined);
  return r.page();
}

export function collectionReceipt(col: any, org: any, logo: string | null, customer: any): ReceiptDoc {
  const r = new Receipt();
  header(r, org, logo, "سند قبض", col.receipt_no, col.created_at);
  r.kv("استلمنا من", esc(col.customer_name));
  if (customer?.phone) r.kv("الهاتف", esc(customer.phone), { ltr: true });
  r.kv("المبلغ المستلم", `${money(col.amount)} ${cur(org)}`, { big: true });
  if (col.collector_name) r.kv("المحصّل", esc(col.collector_name));
  if (col.notes) r.text("note", `ملاحظات: ${esc(col.notes)}`, 38, 5);
  if (customer) r.kv("الرصيد المتبقي", money(customer.balance));
  footer(r, org, "توقيع المستلم");
  return r.page();
}

const typeLabel: Record<string, string> = { SALE: "فاتورة", COLLECTION: "سند قبض", RETURN: "مرتجع" };

export function statementReceipt(data: any, org: any, logo: string | null): ReceiptDoc {
  const r = new Receipt();
  const c = data.customer;
  const rows: any[] = data.rows;
  header(r, org, logo, "كشف حساب عميل", null, new Date().toISOString());
  r.kv("العميل", esc(c.name));
  if (c.phone) r.kv("الهاتف", esc(c.phone), { ltr: true });
  if (c.address) r.kv("العنوان", esc(c.address));
  r.kv("عدد الحركات", String(rows.length));
  if (rows.length) r.kv("الفترة", `${day(rows[0].date)} - ${day(rows[rows.length - 1].date)}`, { sm: true });
  r.hr();
  const t = rows.reduce((a, x) => ({ debit: a.debit + x.debit, credit: a.credit + x.credit }), { debit: 0, credit: 0 });
  r.kv("إجمالي المدين", money(t.debit));
  r.kv("إجمالي الدائن", money(t.credit));
  r.kv("الرصيد المستحق", `${money(c.balance)} ${cur(org)}`, { big: true });
  r.hr();
  if (!rows.length) r.text("c", "لا توجد حركات", 40, 6);
  else r.add(`<div class="ih"><span>الحركة</span><span>الرصيد</span></div>`, 6);
  let bal = 0;
  for (const x of rows) {
    bal += x.debit - x.credit;
    const amt = [x.debit ? `مدين ${money(x.debit)}` : "", x.credit ? `دائن ${money(x.credit)}` : ""].filter(Boolean).join(" / ");
    r.add(
      `<div class="it"><div class="kv sm"><span>${typeLabel[x.type] ?? x.type} ${ltr(x.ref)}</span><b>${fmtDate(x.date)}</b></div><div class="kv sm"><span>${amt}</span><b>${money(bal)}</b></div></div>`,
      12,
    );
  }
  footer(r, org, "توقيع المحاسب");
  return r.page();
}
