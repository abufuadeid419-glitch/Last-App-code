import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Linking, Platform, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useApi } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Btn, useToast } from "@/src/ui";

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function invoiceHtml(doc: any, org: any, logo: string | null, customer: any) {
  const isReturn = !!doc.return_no;
  const no = doc.invoice_no ?? doc.return_no;
  const rows = doc.items
    .map((it: any, i: number) => `<tr><td>${i + 1}</td><td>${esc(it.product_name)}</td><td>${money(it.quantity)}</td><td>${money(it.price)}</td><td>${money(it.total)}</td></tr>`)
    .join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
*{box-sizing:border-box} body{font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;color:#191C1B;margin:0;padding:28px;font-size:13px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #264E3F;padding-bottom:14px}
.org h1{margin:0;color:#264E3F;font-size:22px} .org p{margin:2px 0;color:#4A524F}
.logo{width:84px;height:84px;object-fit:contain;border-radius:10px}
.title{display:flex;justify-content:space-between;margin:18px 0;background:#EFF5F1;padding:12px 14px;border-radius:10px}
.title h2{margin:0;font-size:18px;color:#264E3F} .muted{color:#707975}
.box{display:flex;gap:16px;margin-bottom:16px} .box div{flex:1;border:1px solid #E3E7E5;border-radius:10px;padding:10px 12px}
table{width:100%;border-collapse:collapse;margin-top:6px} th{background:#264E3F;color:#fff;padding:9px;font-weight:600;text-align:right}
td{padding:9px;border-bottom:1px solid #E8ECE9} tr:nth-child(even) td{background:#F4F7F5}
.tot{margin-top:16px;margin-right:auto;width:55%;border:1px solid #E3E7E5;border-radius:10px;overflow:hidden}
.tot div{display:flex;justify-content:space-between;padding:8px 12px} .tot .g{background:#264E3F;color:#fff;font-weight:700;font-size:15px}
.foot{margin-top:28px;border-top:1px dashed #BFC9C4;padding-top:12px;text-align:center;color:#707975}
.sign{display:flex;justify-content:space-between;margin-top:36px} .sign div{width:40%;border-top:1px solid #BFC9C4;padding-top:6px;text-align:center;color:#707975}
</style></head><body>
<div class="head">
  <div class="org"><h1>${esc(org?.name)}</h1>
    ${org?.address ? `<p>${esc(org.address)}</p>` : ""}
    ${org?.phone ? `<p>هاتف: ${esc(org.phone)}</p>` : ""}
    ${org?.email ? `<p>${esc(org.email)}</p>` : ""}
    ${org?.tax_no ? `<p>الرقم الضريبي: ${esc(org.tax_no)}</p>` : ""}
    ${org?.cr_no ? `<p>السجل التجاري: ${esc(org.cr_no)}</p>` : ""}
  </div>
  ${logo ? `<img class="logo" src="${logo}"/>` : ""}
</div>
<div class="title"><h2>${isReturn ? "إشعار مرتجع مبيعات" : "فاتورة مبيعات"}</h2><div><b>${esc(no)}</b><br/><span class="muted">${fmtDate(doc.created_at)}</span></div></div>
<div class="box">
  <div><span class="muted">العميل</span><br/><b>${esc(doc.customer_name)}</b>${customer?.phone ? `<br/>${esc(customer.phone)}` : ""}${customer?.address ? `<br/>${esc(customer.address)}` : ""}</div>
  <div><span class="muted">${isReturn ? "الموزع" : "البائع"}</span><br/><b>${esc(doc.distributor_name)}</b>${doc.payment_type ? `<br/>طريقة الدفع: ${doc.payment_type === "CASH" ? "نقدي" : "آجل"}` : ""}</div>
</div>
<table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot">
  ${doc.discount_amount > 0 ? `<div><span>المجموع</span><span>${money(doc.subtotal)}</span></div><div><span>الخصم${doc.discount_type === "PERCENT" ? ` (${doc.discount_value}%)` : ""}</span><span>- ${money(doc.discount_amount)}</span></div>` : ""}
  <div class="g"><span>الإجمالي</span><span>${money(doc.total)} ${esc(org?.currency ?? "")}</span></div>
  ${org?.alt_currency && org?.exchange_rate ? `<div><span>ما يعادل</span><span>${money(doc.total / org.exchange_rate)} ${esc(org.alt_currency)}</span></div>` : ""}
  ${doc.paid_amount !== undefined ? `<div><span>المدفوع</span><span>${money(doc.paid_amount)}</span></div><div><span>المتبقي</span><span>${money(doc.remaining)}</span></div>` : ""}
  ${customer ? `<div><span>رصيد العميل الحالي</span><span>${money(customer.balance)}</span></div>` : ""}
</div>
${doc.notes || doc.reason ? `<p><b>ملاحظات:</b> ${esc(doc.notes || doc.reason)}</p>` : ""}
<div class="sign"><div>توقيع البائع</div><div>توقيع العميل</div></div>
<div class="foot">${esc(org?.invoice_footer || "شكراً لتعاملكم معنا")}</div>
</body></html>`;
}

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

const normPhone = (p?: string) => (p ?? "").replace(/[^\d]/g, "").replace(/^00/, "");

export function InvoiceActions({ doc }: { doc: any }) {
  const toast = useToast();
  const org = useApi<any>("/org/profile");
  const logo = useApi<any>("/org/logo");
  const customers = useApi<any[]>("/customers");
  const customer = customers.data?.find((c) => c.id === doc.customer_id);
  const html = () => invoiceHtml(doc, org.data, logo.data?.data_uri ?? null, customer);

  const share = async () => {
    try {
      if (Platform.OS === "web") return await Print.printAsync({ html: html() });
      const { uri } = await Print.printToFileAsync({ html: html() });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: doc.invoice_no ?? doc.return_no });
    } catch (e: any) {
      toast(e.message ?? "تعذر إنشاء الملف", "error");
    }
  };
  const print = async () => {
    try {
      await Print.printAsync({ html: html() });
    } catch {}
  };
  const whatsapp = () => {
    const url = `https://wa.me/${normPhone(customer?.phone)}?text=${encodeURIComponent(waText(doc, org.data))}`;
    Linking.openURL(url).catch(() => toast("تعذر فتح واتساب", "error"));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Btn testID="invoice-share-pdf-button" style={{ flex: 1 }} small title="PDF / مشاركة" icon="document-text-outline" onPress={share} />
        <Btn testID="invoice-print-button" style={{ flex: 1 }} small variant="secondary" title="طباعة" icon="print-outline" onPress={print} />
      </View>
      <Btn testID="invoice-whatsapp-button" small variant="secondary" title={customer?.phone ? `إرسال واتساب إلى ${customer.phone}` : "إرسال عبر واتساب"} icon="logo-whatsapp" onPress={whatsapp} />
    </View>
  );
}
