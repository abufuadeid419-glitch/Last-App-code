import { useState } from "react";
import { ScrollView, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Badge, Btn, Empty, Field, Loading, Row, Select, Sheet, T, useToast } from "@/src/ui";

const mvLabel: Record<string, string> = {
  PURCHASE: "شراء", DELIVERY: "تسليم لموزع", DELIVERY_REJECTED: "شحنة مرفوضة", SALE: "بيع", SALE_VOID: "إلغاء فاتورة",
  RETURN: "مرتجع مبيعات", PURCHASE_RETURN: "مرتجع مشتريات", ADJUSTMENT: "تعديل يدوي",
};

// Owner inventory sub-tabs: purchase returns and stock movements log (+ price changes).
export function StockLog({ tab, products }: { tab: "returns" | "movements"; products: any[] }) {
  const toast = useToast();
  const bottom = useBottomChrome();
  const returns = useApi<any[]>("/purchase-returns", tab === "returns");
  const moves = useApi<any[]>("/stock-movements", tab === "movements");
  const prices = useApi<any[]>("/price-history", tab === "movements");
  const [form, setForm] = useState<any>(null);
  const create = useMutate("POST", "/purchase-returns", "تم تسجيل مرتجع المشتريات", () => setForm(null));
  const submit = () => {
    if (!form.product_id || !(+form.quantity > 0)) return toast("اختر المنتج وأدخل الكمية", "error");
    create.mutate({ product_id: form.product_id, quantity: +form.quantity, unit_cost: +form.unit_cost || 0, supplier: form.supplier, reason: form.reason });
  };
  const q = tab === "returns" ? returns : moves;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottom + spacing.xl }} testID={`stock-log-${tab}`}>
      {tab === "returns" && (
        <View style={{ padding: spacing.lg }}>
          <Btn testID="add-purchase-return-button" icon="arrow-undo-outline" title="مرتجع مشتريات للمورد" onPress={() => setForm({ product_id: null, quantity: "", unit_cost: "", supplier: "", reason: "" })} />
        </View>
      )}
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty icon="file-tray-outline" text="لا توجد سجلات" /> : tab === "returns" ? (
        q.data.map((r) => (
          <Row key={r.id} testID={`purchase-return-row-${r.id}`} icon="arrow-undo-outline" title={`${r.return_no} · ${r.product_name} × ${money(r.quantity)}`} subtitle={`${r.supplier || "بدون مورد"} · ${fmtDate(r.created_at)}${r.reason ? " · " + r.reason : ""}`} right={<T v="label">{money(r.total)}</T>} />
        ))
      ) : (
        q.data.map((m) => (
          <Row key={m.id} testID={`movement-row-${m.id}`} icon={m.quantity >= 0 ? "arrow-down-circle-outline" : "arrow-up-circle-outline"} title={`${m.product_name} · ${mvLabel[m.type] ?? m.type}`} subtitle={`${m.location === "AGENT" ? "مخزون موزع" : "المستودع"} · ${m.by ?? ""} · ${fmtDate(m.created_at)}`} right={<Badge text={`${m.quantity > 0 ? "+" : ""}${money(m.quantity)}`} tone={m.quantity >= 0 ? "success" : "warning"} />} />
        ))
      )}
      {tab === "movements" && !!prices.data?.length && (
        <View style={{ marginTop: spacing.lg }}>
          <T v="h2" style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>سجل تغييرات الأسعار</T>
          {prices.data.map((p, i) => (
            <Row key={i} icon="pricetag-outline" title={p.product_name} subtitle={`${p.by ?? ""} · ${fmtDate(p.at)}`} right={<T v="label">{money(p.old_price)} ← {money(p.new_price)}</T>} />
          ))}
        </View>
      )}
      <Sheet testID="purchase-return-sheet" visible={!!form} onClose={() => setForm(null)} title="مرتجع مشتريات" footer={<Btn testID="save-purchase-return-button" title="حفظ المرتجع" icon="checkmark" loading={create.isPending} onPress={submit} />}>
        {form && (
          <>
            <Select testID="purchase-return-product-select" label="المنتج" placeholder="اختر المنتج" value={products.find((p) => p.id === form.product_id)?.name ?? null} options={products.filter((p) => p.stock > 0)} getLabel={(p: any) => p.name} getSub={(p: any) => `المستودع: ${p.stock}`} onSelect={(p: any) => setForm({ ...form, product_id: p.id, unit_cost: String(p.cost_price) })} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field testID="purchase-return-qty-input" label="الكمية" keyboardType="decimal-pad" value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} /></View>
              <View style={{ flex: 1 }}><Field testID="purchase-return-cost-input" label="تكلفة الوحدة" keyboardType="decimal-pad" value={form.unit_cost} onChangeText={(v) => setForm({ ...form, unit_cost: v })} /></View>
            </View>
            <Field testID="purchase-return-supplier-input" label="المورد" value={form.supplier} onChangeText={(v) => setForm({ ...form, supplier: v })} />
            <Field testID="purchase-return-reason-input" label="سبب الإرجاع" value={form.reason} onChangeText={(v) => setForm({ ...form, reason: v })} />
          </>
        )}
      </Sheet>
    </ScrollView>
  );
}
