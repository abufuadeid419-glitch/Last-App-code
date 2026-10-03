import { useMemo, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { InvoiceActions } from "@/src/components/InvoiceActions";
import { SyncBanner } from "@/src/components/SyncBanner";
import { useApi, useBottomChrome } from "@/src/hooks";
import { useSyncState } from "@/src/offline";
import { offlineSale } from "@/src/offlineActions";
import { usePriceResolver } from "@/src/pricing";
import { radius, spacing, useTheme } from "@/src/theme";
import { Btn, Card, Empty, Field, Header, IconBtn, Loading, Segments, Select, T, useToast } from "@/src/ui";

type Line = { product_id: string; name: string; available: number; quantity: string; price: string };

export default function NewSale() {
  const { colors } = useTheme();
  const toast = useToast();
  const bottom = useBottomChrome();
  const customers = useApi<any[]>("/customers");
  const inv = useApi<any[]>("/my/inventory");
  const [cust, setCust] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [last, setLast] = useState<any>(null);
  const { user } = useAuth();
  const { online } = useSyncState();

  const resolve = usePriceResolver();
  const priceOf = (l: Line) => resolve(cust, l.product_id, +l.price);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subtotal = useMemo(() => lines.reduce((s, l) => s + (+l.quantity || 0) * priceOf(l), 0), [lines, cust, resolve]);
  const [dType, setDType] = useState<"NONE" | "PERCENT" | "FIXED">("NONE");
  const [dVal, setDVal] = useState("");
  const discount = dType === "PERCENT" ? (subtotal * Math.min(+dVal || 0, 100)) / 100 : dType === "FIXED" ? Math.min(+dVal || 0, subtotal) : 0;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const [saving, setSaving] = useState(false);

  const addLine = (p: any) => {
    if (lines.find((l) => l.product_id === p.product_id)) return toast("المنتج مضاف مسبقاً", "error");
    setLines([...lines, { product_id: p.product_id, name: p.product_name, available: p.quantity, quantity: "1", price: String(p.sale_price) }]);
  };
  const upd = (i: number, k: "quantity", v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const submit = async () => {
    if (!cust) return toast("اختر العميل", "error");
    if (!lines.length) return toast("أضف منتجاً واحداً على الأقل", "error");
    const bad = lines.find((l) => !(+l.quantity > 0) || +l.quantity > l.available);
    if (bad) return toast(`كمية غير صالحة: ${bad.name}`, "error");
    setSaving(true);
    try {
      const doc = await offlineSale({
        customer: cust,
        lines: lines.map((l) => ({ product_id: l.product_id, product_name: l.name, quantity: +l.quantity, price: priceOf(l) })),
        paid: paid === "" ? null : +paid || 0,
        notes,
        userName: user?.name,
        discountType: dType,
        discountValue: +dVal || 0,
      });
      setDType("NONE");
      setDVal("");
      setLast(doc);
      setCust(null);
      setLines([]);
      setPaid("");
      setNotes("");
      toast(online ? "تم حفظ الفاتورة" : "تم حفظ الفاتورة دون اتصال وستتم مزامنتها لاحقاً");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (customers.isLoading || inv.isLoading) return <View style={{ flex: 1, backgroundColor: colors.surface }}><Header title="فاتورة جديدة" /><Loading /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="new-sale-screen">
      <Header title="فاتورة جديدة" subtitle="بيع من مخزونك" right={<AccountButton />} />
      <SyncBanner />
      <KeyboardAwareScrollView bottomOffset={120} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {last && (
          <Card testID="last-invoice-card" style={{ backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary, gap: spacing.xs }}>
            <T v="label" color="brandPrimary">تم إنشاء الفاتورة {last.invoice_no}{last.pending ? " (بانتظار المزامنة)" : ""}</T>
            <T v="caption">{last.customer_name} · الإجمالي {money(last.total)} · المتبقي {money(last.remaining)}</T>
            <InvoiceActions doc={last} />
          </Card>
        )}
        <Select testID="sale-customer-select" label="العميل" placeholder="اختر العميل" value={cust?.name ?? null} options={customers.data ?? []} getLabel={(c: any) => c.name} getSub={(c: any) => `الدين: ${money(c.balance)}`} onSelect={setCust} />

        <View style={{ gap: spacing.md }}>
          <T v="h2">المنتجات</T>
          {!inv.data?.length && <Empty icon="cube-outline" text="لا يوجد مخزون لديك للبيع" />}
          {lines.map((l, i) => (
            <View key={l.product_id} testID={`sale-line-${i}`} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <T v="label">{l.name}</T>
                  <T v="caption">المتوفر: {money(l.available)}</T>
                </View>
                <IconBtn testID={`remove-line-${i}`} icon="trash-outline" onPress={() => setLines(lines.filter((_, j) => j !== i))} />
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}><Field testID={`line-qty-input-${i}`} label="الكمية" keyboardType="decimal-pad" value={l.quantity} onChangeText={(v) => upd(i, "quantity", v)} /></View>
                <View style={{ flex: 1, justifyContent: "flex-end", gap: 2, paddingBottom: spacing.sm }}><T v="caption">السعر {cust?.type_id ? "(حسب فئة العميل)" : ""}</T><T v="h2" testID={`line-price-${i}`}>{money(priceOf(l))}</T><T v="caption">المجموع: {money((+l.quantity || 0) * priceOf(l))}</T></View>
              </View>
            </View>
          ))}
          {!!inv.data?.length && (
            <Select testID="add-line-select" label="إضافة منتج" placeholder="+ اختر منتجاً من مخزونك" value={null} options={inv.data.filter((p: any) => p.quantity > 0)} getLabel={(p: any) => p.product_name} getSub={(p: any) => `متوفر ${p.quantity} · ${money(resolve(cust, p.product_id, p.sale_price))}`} onSelect={addLine} />
          )}
        </View>

        <View style={{ gap: spacing.xs }}>
          <T v="label" color="onSurfaceSecondary">الخصم (اختياري)</T>
          <View style={{ marginHorizontal: -spacing.lg }}>
            <Segments value={dType} onChange={setDType} options={[{ key: "NONE", label: "بدون خصم" }, { key: "PERCENT", label: "نسبة %" }, { key: "FIXED", label: "مبلغ ثابت" }]} />
          </View>
          {dType !== "NONE" && <Field testID="sale-discount-input" label={dType === "PERCENT" ? "نسبة الخصم %" : "قيمة الخصم"} keyboardType="decimal-pad" value={dVal} onChangeText={setDVal} />}
          {discount > 0 && <T v="caption" testID="sale-discount-amount">المجموع {money(subtotal)} − خصم {money(discount)}</T>}
        </View>
        <Field testID="sale-paid-input" label="المبلغ المدفوع (اتركه فارغاً للدفع الكامل)" keyboardType="decimal-pad" value={paid} onChangeText={setPaid} placeholder={money(total)} />
        <Field testID="sale-notes-input" label="ملاحظات" value={notes} onChangeText={setNotes} />
      </KeyboardAwareScrollView>
      <View style={{ padding: spacing.lg, paddingBottom: bottom + spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.surface, gap: spacing.sm }}>
        <View style={{ flexDirection: "row" }}>
          <T v="label" style={{ flex: 1 }}>الإجمالي</T>
          <T v="title" color="brandPrimary" testID="sale-total">{money(total)}</T>
        </View>
        <Btn testID="submit-sale-button" title="حفظ الفاتورة" icon="checkmark-circle-outline" onPress={submit} loading={saving} />
      </View>
    </View>
  );
}
