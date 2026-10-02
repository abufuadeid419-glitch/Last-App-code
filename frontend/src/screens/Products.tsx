import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { money } from "@/src/api";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Empty, ErrorBox, Field, Header, IconBtn, Loading, Row, Segments, Select, Sheet, T, useToast } from "@/src/ui";

const blank = { name: "", category: "", unit: "قطعة", cost_price: "", sale_price: "", stock: "", min_stock: "" };

export default function Products() {
  const { colors } = useTheme();
  const bottom = useBottomChrome();
  const toast = useToast();
  const [tab, setTab] = useState<"products" | "purchases">("products");
  const products = useApi<any[]>("/products");
  const purchases = useApi<any[]>("/purchases");
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(blank);
  const [buy, setBuy] = useState<any | null>(null);

  const save = useMutate("POST", "/products", "تم حفظ المنتج", () => setEdit(null));
  const update = useMutate<any>("PUT", (b) => `/products/${b.id}`, "تم تحديث المنتج", () => setEdit(null));
  const del = useMutate<any>("DELETE", (b) => `/products/${b.id}`, "تم حذف المنتج", () => setEdit(null));
  const purchase = useMutate("POST", "/purchases", "تمت إضافة الكمية للمستودع", () => setBuy(null));

  const open = (p?: any) => {
    setForm(p ? { ...p, cost_price: String(p.cost_price), sale_price: String(p.sale_price), stock: String(p.stock), min_stock: String(p.min_stock) } : blank);
    setEdit(p ?? {});
  };
  const submit = () => {
    if (!form.name.trim()) return toast("اسم المنتج مطلوب", "error");
    const body = { ...form, cost_price: +form.cost_price || 0, sale_price: +form.sale_price || 0, stock: +form.stock || 0, min_stock: +form.min_stock || 0 };
    if (edit?.id) update.mutate({ ...body, id: edit.id });
    else save.mutate(body);
  };
  const submitBuy = () => {
    if (!buy.product_id || !(+buy.quantity > 0)) return toast("اختر المنتج وأدخل الكمية", "error");
    purchase.mutate({ product_id: buy.product_id, quantity: +buy.quantity, unit_cost: +buy.unit_cost || 0, supplier: buy.supplier });
  };
  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  const q = tab === "products" ? products : purchases;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="products-screen">
      <Header
        title="المخزون"
        subtitle="المنتجات والمستودع"
        right={
          <>
            <IconBtn testID="add-purchase-button" icon="download-outline" onPress={() => setBuy({ product_id: null, quantity: "", unit_cost: "", supplier: "" })} />
            <IconBtn testID="add-product-button" icon="add" tone="brand" onPress={() => open()} />
          </>
        }
      />
      <Segments value={tab} onChange={setTab} options={[{ key: "products", label: "المنتجات" }, { key: "purchases", label: "المشتريات" }]} />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={(q.error as Error).message} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data as any[]}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={
            tab === "products" ? (
              <Empty icon="cube-outline" text="لا توجد منتجات بعد" action={<Btn small testID="empty-add-product-button" title="إضافة منتج" icon="add" onPress={() => open()} />} />
            ) : (
              <Empty icon="cart-outline" text="لا توجد مشتريات بعد" />
            )
          }
          renderItem={({ item }) =>
            tab === "products" ? (
              <Row
                testID={`product-row-${item.id}`}
                icon="cube-outline"
                title={item.name}
                subtitle={`بيع ${money(item.sale_price)} · تكلفة ${money(item.cost_price)}${item.category ? " · " + item.category : ""}`}
                onPress={() => open(item)}
                right={<Badge text={`${money(item.stock)} ${item.unit}`} tone={item.stock <= item.min_stock ? "warning" : "brand"} />}
              />
            ) : (
              <Row icon="download-outline" title={`${item.product_name} × ${money(item.quantity)}`} subtitle={`${item.supplier || "بدون مورد"} · ${new Date(item.created_at).toLocaleDateString("en-GB")}`} right={<T v="label">{money(item.total)}</T>} />
            )
          }
        />
      )}

      <Sheet
        testID="product-form-sheet"
        visible={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "تعديل منتج" : "منتج جديد"}
        footer={
          <>
            <Btn testID="save-product-button" title="حفظ" icon="checkmark" onPress={submit} loading={save.isPending || update.isPending} />
            {edit?.id && <Btn testID="delete-product-button" variant="ghost" title="حذف المنتج" onPress={() => del.mutate({ id: edit.id })} loading={del.isPending} />}
          </>
        }
      >
        <Field testID="product-name-input" label="اسم المنتج" value={form.name} onChangeText={set("name")} />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field testID="product-category-input" label="التصنيف" value={form.category} onChangeText={set("category")} /></View>
          <View style={{ flex: 1 }}><Field testID="product-unit-input" label="الوحدة" value={form.unit} onChangeText={set("unit")} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field testID="product-cost-input" label="سعر التكلفة" keyboardType="decimal-pad" value={form.cost_price} onChangeText={set("cost_price")} /></View>
          <View style={{ flex: 1 }}><Field testID="product-price-input" label="سعر البيع" keyboardType="decimal-pad" value={form.sale_price} onChangeText={set("sale_price")} /></View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}><Field testID="product-stock-input" label="الكمية بالمستودع" keyboardType="decimal-pad" value={form.stock} onChangeText={set("stock")} /></View>
          <View style={{ flex: 1 }}><Field testID="product-min-stock-input" label="حد التنبيه" keyboardType="decimal-pad" value={form.min_stock} onChangeText={set("min_stock")} /></View>
        </View>
      </Sheet>

      <Sheet
        testID="purchase-form-sheet"
        visible={!!buy}
        onClose={() => setBuy(null)}
        title="إضافة مشتريات للمستودع"
        footer={<Btn testID="save-purchase-button" title="حفظ المشتريات" icon="checkmark" onPress={submitBuy} loading={purchase.isPending} />}
      >
        {buy && (
          <>
            <Select
              testID="purchase-product-select"
              label="المنتج"
              placeholder="اختر المنتج"
              value={products.data?.find((p) => p.id === buy.product_id)?.name ?? null}
              options={products.data ?? []}
              getLabel={(p: any) => p.name}
              getSub={(p: any) => `المخزون: ${p.stock}`}
              onSelect={(p: any) => setBuy({ ...buy, product_id: p.id, unit_cost: String(p.cost_price) })}
            />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field testID="purchase-qty-input" label="الكمية" keyboardType="decimal-pad" value={buy.quantity} onChangeText={(v) => setBuy({ ...buy, quantity: v })} /></View>
              <View style={{ flex: 1 }}><Field testID="purchase-cost-input" label="تكلفة الوحدة" keyboardType="decimal-pad" value={buy.unit_cost} onChangeText={(v) => setBuy({ ...buy, unit_cost: v })} /></View>
            </View>
            <Field testID="purchase-supplier-input" label="المورد" value={buy.supplier} onChangeText={(v) => setBuy({ ...buy, supplier: v })} />
          </>
        )}
      </Sheet>
    </View>
  );
}

