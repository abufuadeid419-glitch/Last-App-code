import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Linking, Platform, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { esc, normPhone } from "@/src/components/InvoiceActions";
import { useApi } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Btn, T, useToast } from "@/src/ui";

const typeLabel: Record<string, string> = { SALE: "فاتورة مبيعات", COLLECTION: "سند قبض", RETURN: "مرتجع مبيعات" };

function totals(rows: any[]) {
  return rows.reduce((t, r) => ({ debit: t.debit + r.debit, credit: t.credit + r.credit }), { debit: 0, credit: 0 });
}

export function statementHtml(data: any, org: any, logo: string | null) {
  const c = data.customer;
  const t = totals(data.rows);
  let bal = 0;
  const rows = data.rows
    .map((r: any, i: number) => {
      bal += r.debit - r.credit;
      return `<tr><td>${i + 1}</td><td>${fmtDate(r.date)}</td><td>${typeLabel[r.type] ?? r.type}</td><td>${esc(r.ref)}</td><td class="d">${r.debit ? money(r.debit) : "—"}</td><td class="c">${r.credit ? money(r.credit) : "—"}</td><td><b>${money(bal)}</b></td></tr>`;
    })
    .join("");
  const cur = esc(org?.currency ?? "");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
*{box-sizing:border-box} body{font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;color:#191C1B;margin:0;padding:28px;font-size:12.5px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #264E3F;padding-bottom:14px}
.org h1{margin:0;color:#264E3F;font-size:22px} .org p{margin:2px 0;color:#4A524F}
.logo{width:84px;height:84px;object-fit:contain;border-radius:10px}
.title{display:flex;justify-content:space-between;align-items:center;margin:18px 0;background:#EFF5F1;padding:12px 14px;border-radius:10px}
.title h2{margin:0;font-size:18px;color:#264E3F} .muted{color:#707975}
.box{display:flex;gap:12px;margin-bottom:16px} .box div{flex:1;border:1px solid #E3E7E5;border-radius:10px;padding:10px 12px}
.sum{display:flex;gap:10px;margin-bottom:16px} .sum div{flex:1;border-radius:10px;padding:10px 12px;background:#F4F7F5;text-align:center}
.sum b{display:block;font-size:16px;margin-top:2px} .sum .bal{background:#264E3F;color:#fff}
table{width:100%;border-collapse:collapse} th{background:#264E3F;color:#fff;padding:8px;font-weight:600;text-align:right}
td{padding:8px;border-bottom:1px solid #E8ECE9} tr:nth-child(even) td{background:#F4F7F5}
td.d{color:#B3261E} td.c{color:#1E7A46} tfoot td{font-weight:700;background:#EFF5F1;border-top:2px solid #264E3F}
.foot{margin-top:28px;border-top:1px dashed #BFC9C4;padding-top:12px;text-align:center;color:#707975}
.sign{display:flex;justify-content:space-between;margin-top:36px} .sign div{width:40%;border-top:1px solid #BFC9C4;padding-top:6px;text-align:center;color:#707975}
</style></head><body>
<div class="head">
  <div class="org"><h1>${esc(org?.name)}</h1>
    ${org?.address ? `<p>${esc(org.address)}</p>` : ""}
    ${org?.phone ? `<p>هاتف: ${esc(org.phone)}</p>` : ""}
    ${org?.tax_no ? `<p>الرقم الضريبي: ${esc(org.tax_no)}</p>` : ""}
  </div>
  ${logo ? `<img class="logo" src="${logo}"/>` : ""}
</div>
<div class="title"><h2>كشف حساب عميل</h2><div class="muted">تاريخ الإصدار: ${fmtDate(new Date().toISOString())}</div></div>
<div class="box">
  <div><span class="muted">العميل</span><br/><b>${esc(c.name)}</b>${c.phone ? `<br/>${esc(c.phone)}` : ""}${c.address ? `<br/>${esc(c.address)}` : ""}</div>
  <div><span class="muted">عدد الحركات</span><br/><b>${data.rows.length}</b>${data.rows.length ? `<br/><span class="muted">من ${fmtDate(data.rows[0].date)} إلى ${fmtDate(data.rows[data.rows.length - 1].date)}</span>` : ""}</div>
</div>
<div class="sum">
  <div><span class="muted">إجمالي المدين</span><b>${money(t.debit)}</b></div>
  <div><span class="muted">إجمالي الدائن</span><b>${money(t.credit)}</b></div>
  <div class="bal"><span>الرصيد المستحق</span><b>${money(c.balance)} ${cur}</b></div>
</div>
<table><thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
<tbody>${rows || `<tr><td colspan="7" style="text-align:center" class="muted">لا توجد حركات</td></tr>`}</tbody>
<tfoot><tr><td colspan="4">الإجمالي</td><td>${money(t.debit)}</td><td>${money(t.credit)}</td><td>${money(t.debit - t.credit)}</td></tr></tfoot></table>
<div class="sign"><div>توقيع المحاسب</div><div>توقيع العميل</div></div>
<div class="foot">${esc(org?.invoice_footer || "شكراً لتعاملكم معنا")}</div>
</body></html>`;
}

function waText(data: any, org: any) {
  const c = data.customer;
  const t = totals(data.rows);
  const last = data.rows.slice(-5).map((r: any) => `• ${fmtDate(r.date)} ${typeLabel[r.type] ?? r.type} ${r.ref}: ${r.debit ? `مدين ${money(r.debit)}` : ""}${r.debit && r.credit ? " / " : ""}${r.credit ? `دائن ${money(r.credit)}` : ""}`);
  const lines = [`*${org?.name ?? ""}*`, `كشف حساب: ${c.name}`, `التاريخ: ${fmtDate(new Date().toISOString())}`, "", `إجمالي المدين: ${money(t.debit)}`, `إجمالي الدائن: ${money(t.credit)}`, `*الرصيد المستحق: ${money(c.balance)} ${org?.currency ?? ""}*`];
  if (last.length) lines.push("", "آخر الحركات:", ...last);
  if (org?.phone) lines.push("", `للاستفسار: ${org.phone}`);
  return lines.join("\n");
}

// PDF / print / WhatsApp for a customer statement (data = GET /customers/{id}/statement).
export function StatementActions({ data }: { data: any }) {
  const toast = useToast();
  const org = useApi<any>("/org/profile");
  const logo = useApi<any>("/org/logo");
  const html = () => statementHtml(data, org.data, logo.data?.data_uri ?? null);
  const title = `كشف حساب - ${data.customer.name}`;

  const share = async () => {
    try {
      if (Platform.OS === "web") return await Print.printAsync({ html: html() });
      const { uri } = await Print.printToFileAsync({ html: html() });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
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
    const url = `https://wa.me/${normPhone(data.customer.phone)}?text=${encodeURIComponent(waText(data, org.data))}`;
    Linking.openURL(url).catch(() => toast("تعذر فتح واتساب", "error"));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Btn testID="statement-share-pdf-button" style={{ flex: 1 }} small title="مشاركة PDF" icon="document-text-outline" onPress={share} />
        <Btn testID="statement-print-button" style={{ flex: 1 }} small variant="secondary" title="طباعة" icon="print-outline" onPress={print} />
      </View>
      <Btn testID="statement-whatsapp-button" small variant="secondary" icon="logo-whatsapp" title={data.customer.phone ? `إرسال ملخص واتساب إلى ${data.customer.phone}` : "إرسال ملخص عبر واتساب"} onPress={whatsapp} />
      {Platform.OS !== "web" && <T v="caption" style={{ textAlign: "center" }}>لإرسال ملف PDF عبر واتساب اضغط «مشاركة PDF» ثم اختر واتساب</T>}
    </View>
  );
}
