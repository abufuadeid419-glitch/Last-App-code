// 80mm thermal-receipt documents. Builders produce a list of layout ops that render either to HTML
// (system print / PDF) or to a React Native view (Bluetooth image printing, see ReceiptView).
// Printable width is 72mm (4mm side padding). Monochrome layout for thermal printers.
import { fmtDate, money } from "@/src/api";

export type TextCls = "h1" | "sub" | "title" | "note" | "foot" | "tiny" | "c";
export type Op =
  | { t: "logo"; uri: string }
  | { t: "text"; cls: TextCls; s: string; ltr?: string }
  | { t: "hr"; strong?: boolean }
  | { t: "kv"; label: string; value: string; big?: boolean; sm?: boolean; ltr?: boolean }
  | { t: "ih"; a: string; b: string }
  | { t: "item"; title?: string; rows: { label: string; value: string }[] }
  | { t: "sign"; s: string };
export type ReceiptDoc = { ops: Op[]; html: string; heightMm: number };
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

// chars per line / mm per line for each text class (used for the printed-height estimate)
const TEXT_METRICS: Record<TextCls, [number, number]> = { h1: [26, 6.5], sub: [46, 4.3], title: [30, 7], note: [38, 5], foot: [40, 5], tiny: [50, 4.5], c: [40, 6] };
const lines = (s: string, per: number) => Math.max(1, Math.ceil(s.length / per));

function opMm(o: Op): number {
  switch (o.t) {
    case "logo": return 20;
    case "text": { const [per, mm] = TEXT_METRICS[o.cls]; return lines(o.s + (o.ltr ?? ""), per) * mm; }
    case "hr": return 4.5;
    case "kv": return o.big ? 10 : lines(o.label + o.value, 34) * 5;
    case "ih": return 6;
    case "item": return (o.title ? lines(o.title, 34) * 5 : 0) + o.rows.length * 5 + 2;
    case "sign": return 9;
  }
}

function opHtml(o: Op): string {
  switch (o.t) {
    case "logo": return `<img class="logo" src="${o.uri}"/>`;
    case "text": return `<div class="${o.cls}">${esc(o.s)}${o.ltr ? `<bdi dir="ltr">${esc(o.ltr)}</bdi>` : ""}</div>`;
    case "hr": return `<div class="${o.strong ? "hr2" : "hr"}"></div>`;
    case "kv": return `<div class="kv${o.big ? " big" : ""}${o.sm ? " sm" : ""}"><span>${esc(o.label)}</span><b${o.ltr ? ' dir="ltr"' : ""}>${esc(o.value)}</b></div>`;
    case "ih": return `<div class="ih"><span>${esc(o.a)}</span><span>${esc(o.b)}</span></div>`;
    case "item": return `<div class="it">${o.title ? `<div class="nm">${esc(o.title)}</div>` : ""}${o.rows.map((r) => `<div class="kv sm"><span>${esc(r.label)}</span><b>${esc(r.value)}</b></div>`).join("")}</div>`;
    case "sign": return `<div class="sign">${esc(o.s)}: ..................................</div>`;
  }
}

class Receipt {
  ops: Op[] = [];
  push(o: Op) {
    this.ops.push(o);
    return this;
  }
  hr(strong = false) {
    return this.push({ t: "hr", strong });
  }
  kv(label: string, value: string, o: { big?: boolean; sm?: boolean; ltr?: boolean } = {}) {
    return this.push({ t: "kv", label, value, ...o });
  }
  text(cls: TextCls, s: string, ltr?: string) {
    return this.push({ t: "text", cls, s, ltr });
  }
  page(): ReceiptDoc {
    // Per-line estimates are already generous (~15% over), so no extra buffer is added.
    const h = Math.max(90, Math.ceil(12 + this.ops.reduce((s, o) => s + opMm(o), 0)));
    const body = this.ops.map(opHtml).join("");
    return {
      ops: this.ops,
      heightMm: h,
      html: `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>@page{size:${RECEIPT_MM}mm ${h}mm;margin:0}${CSS}</style></head><body><div class="r">${body}</div></body></html>`,
    };
  }
}

const day = (iso: string) => fmtDate(iso).split(" ")[0];
const cur = (org: any) => org?.currency ?? "";

function header(r: Receipt, org: any, logo: string | null, title: string, no: string | null, date: string) {
  if (logo) r.push({ t: "logo", uri: logo });
  r.text("h1", org?.name ?? "");
  if (org?.address) r.text("sub", org.address);
  if (org?.phone) r.text("sub", "هاتف: ", org.phone);
  if (org?.tax_no) r.text("sub", "الرقم الضريبي: ", org.tax_no);
  if (org?.cr_no) r.text("sub", "السجل التجاري: ", org.cr_no);
  r.hr(true);
  r.text("title", title);
  if (no) r.kv("الرقم", no, { ltr: true });
  r.kv("التاريخ", fmtDate(date));
  r.hr();
}

function footer(r: Receipt, org: any, sign?: string) {
  if (sign) r.push({ t: "sign", s: sign });
  r.hr();
  r.text("foot", org?.invoice_footer || "شكراً لتعاملكم معنا");
  r.text("tiny", `طُبع في ${fmtDate(new Date().toISOString())}`);
}

export function invoiceReceipt(doc: any, org: any, logo: string | null, customer: any): ReceiptDoc {
  const r = new Receipt();
  const isReturn = !!doc.return_no;
  header(r, org, logo, isReturn ? "إشعار مرتجع مبيعات" : "فاتورة مبيعات", doc.invoice_no ?? doc.return_no, doc.created_at);
  r.kv("العميل", doc.customer_name);
  if (customer?.phone) r.kv("الهاتف", customer.phone, { ltr: true });
  r.kv(isReturn ? "الموزع" : "البائع", doc.distributor_name ?? "");
  if (doc.payment_type) r.kv("طريقة الدفع", doc.payment_type === "CASH" ? "نقدي" : "آجل");
  r.hr();
  r.push({ t: "ih", a: "الصنف", b: "الكمية × السعر = الإجمالي" });
  doc.items.forEach((it: any, i: number) =>
    r.push({ t: "item", title: `${i + 1}. ${it.product_name}`, rows: [{ label: `${money(it.quantity)} × ${money(it.price)}`, value: money(it.total) }] }),
  );
  r.hr();
  if (doc.discount_amount > 0) {
    r.kv("المجموع", money(doc.subtotal));
    r.kv(`الخصم${doc.discount_type === "PERCENT" ? ` (${doc.discount_value}%)` : ""}`, `-${money(doc.discount_amount)}`, { ltr: true });
  }
  r.kv("الإجمالي", `${money(doc.total)} ${cur(org)}`, { big: true });
  if (org?.alt_currency && org?.exchange_rate) r.kv("ما يعادل", `${money(doc.total / org.exchange_rate)} ${org.alt_currency}`, { sm: true });
  if (doc.paid_amount !== undefined) {
    r.kv("المدفوع", money(doc.paid_amount));
    r.kv("المتبقي", money(doc.remaining));
  }
  if (customer) r.kv("رصيد العميل الحالي", money(customer.balance));
  if (doc.notes || doc.reason) r.text("note", `ملاحظات: ${doc.notes || doc.reason}`);
  r.kv("عدد الأصناف", String(doc.items.length), { sm: true });
  footer(r, org, doc.payment_type && doc.payment_type !== "CASH" ? "توقيع العميل" : undefined);
  return r.page();
}

export function collectionReceipt(col: any, org: any, logo: string | null, customer: any): ReceiptDoc {
  const r = new Receipt();
  header(r, org, logo, "سند قبض", col.receipt_no, col.created_at);
  r.kv("استلمنا من", col.customer_name);
  if (customer?.phone) r.kv("الهاتف", customer.phone, { ltr: true });
  r.kv("المبلغ المستلم", `${money(col.amount)} ${cur(org)}`, { big: true });
  if (col.collector_name) r.kv("المحصّل", col.collector_name);
  if (col.notes) r.text("note", `ملاحظات: ${col.notes}`);
  if (customer) r.kv("الرصيد المتبقي", money(customer.balance));
  footer(r, org, "توقيع المستلم");
  return r.page();
}

export function paymentReceipt(p: any, org: any, logo: string | null, customer: any): ReceiptDoc {
  const r = new Receipt();
  header(r, org, logo, "سند صرف (رد مبلغ لعميل)", p.voucher_no, p.created_at);
  r.kv("صُرف إلى", p.customer_name);
  if (customer?.phone) r.kv("الهاتف", customer.phone, { ltr: true });
  r.kv("المبلغ المصروف", `${money(p.amount)} ${cur(org)}`, { big: true });
  if (p.distributor_name) r.kv("الموزع", p.distributor_name);
  if (p.notes) r.text("note", `البيان: ${p.notes}`);
  if (customer) r.kv("رصيد العميل بعد الصرف", money(customer.balance));
  footer(r, org, "توقيع المستلم");
  return r.page();
}

export function warehouseReturnReceipt(w: any, org: any, logo: string | null): ReceiptDoc {
  const r = new Receipt();
  header(r, org, logo, "إذن إرجاع بضاعة للمستودع", w.return_no, w.created_at);
  r.kv("الموزع", w.distributor_name ?? "");
  r.kv("الحالة", w.status === "ACCEPTED" ? "تم الاستلام" : w.status === "REJECTED" ? "مرفوض" : "بانتظار الاستلام");
  r.hr();
  r.push({ t: "ih", a: "الصنف", b: "الكمية" });
  w.items.forEach((it: any, i: number) => r.push({ t: "item", rows: [{ label: `${i + 1}. ${it.product_name}`, value: money(it.quantity) }] }));
  r.hr();
  r.kv("عدد الأصناف", String(w.items.length));
  if (w.notes) r.text("note", `ملاحظات: ${w.notes}`);
  if (w.reject_reason) r.text("note", `سبب الرفض: ${w.reject_reason}`);
  r.push({ t: "sign", s: "توقيع الموزع" });
  footer(r, org, "توقيع أمين المستودع");
  return r.page();
}

const typeLabel: Record<string, string> = { SALE: "فاتورة", COLLECTION: "سند قبض", RETURN: "مرتجع", PAYMENT: "سند صرف" };

export function statementReceipt(data: any, org: any, logo: string | null): ReceiptDoc {
  const r = new Receipt();
  const c = data.customer;
  const rows: any[] = data.rows;
  header(r, org, logo, "كشف حساب عميل", null, new Date().toISOString());
  r.kv("العميل", c.name);
  if (c.phone) r.kv("الهاتف", c.phone, { ltr: true });
  if (c.address) r.kv("العنوان", c.address);
  r.kv("عدد الحركات", String(rows.length));
  if (rows.length) r.kv("الفترة", `${day(rows[0].date)} - ${day(rows[rows.length - 1].date)}`, { sm: true });
  r.hr();
  const t = rows.reduce((a, x) => ({ debit: a.debit + x.debit, credit: a.credit + x.credit }), { debit: 0, credit: 0 });
  r.kv("إجمالي المدين", money(t.debit));
  r.kv("إجمالي الدائن", money(t.credit));
  r.kv("الرصيد المستحق", `${money(c.balance)} ${cur(org)}`, { big: true });
  r.hr();
  if (!rows.length) r.text("c", "لا توجد حركات");
  else r.push({ t: "ih", a: "الحركة", b: "الرصيد" });
  let bal = 0;
  for (const x of rows) {
    bal += x.debit - x.credit;
    const amt = [x.debit ? `مدين ${money(x.debit)}` : "", x.credit ? `دائن ${money(x.credit)}` : ""].filter(Boolean).join(" / ");
    r.push({ t: "item", rows: [{ label: `${typeLabel[x.type] ?? x.type} ${x.ref}`, value: fmtDate(x.date) }, { label: amt, value: money(bal) }] });
  }
  footer(r, org, "توقيع المحاسب");
  return r.page();
}
