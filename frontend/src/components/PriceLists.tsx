import { useState } from "react";
import { View } from "react-native";

import { money } from "@/src/api";
import { useApi, useMutate } from "@/src/hooks";
import { spacing } from "@/src/theme";
import { Badge, Btn, Card, Empty, Field, Row, Sheet, T, useToast } from "@/src/ui";

// Owner: customer types with a fixed price per product (blank = normal price).
export function PriceLists() {
  const toast = useToast();
  const types = useApi<any[]>("/customer-types");
  const products = useApi<any[]>("/products");
  const customers = useApi<any[]>("/customers");
  const [form, setForm] = useState<any>(null);
  const create = useMutate("POST", "/customer-types", "تم إنشاء الفئة", () => setForm(null));
  const update = useMutate<any>("PUT", (b) => `/customer-types/${b.id}`, "تم تحديث الأسعار", () => setForm(null));
  const del = useMutate<any>("DELETE", (b) => `/customer-types/${b.id}`, "تم حذف الفئة", () => setForm(null));

  const open = (t?: any) =>
    setForm(t ? { ...t, prices: Object.fromEntries(Object.entries(t.prices ?? {}).map(([k, v]) => [k, String(v)])) } : { name: "", prices: {} });
  const submit = () => {
    if (!form.name.trim()) return toast("اسم الفئة مطلوب", "error");
    const prices = Object.fromEntries(Object.entries(form.prices).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, +(v as string)]));
    if (form.id) update.mutate({ id: form.id, name: form.name, prices });
    else create.mutate({ name: form.name, prices });
  };

  return (
    <View style={{ gap: spacing.lg }} testID="price-lists">
      <T v="caption">أنشئ فئات للعملاء (جملة، مفرق، VIP...) وحدد سعراً لكل منتج. تُطبق الأسعار تلقائياً ولا يمكن للموزع تعديلها.</T>
      <Btn testID="add-customer-type-button" icon="add" title="فئة أسعار جديدة" onPress={() => open()} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {!types.data?.length ? (
          <Empty icon="pricetags-outline" text="لا توجد فئات أسعار بعد" />
        ) : (
          types.data.map((t) => (
            <Row
              key={t.id}
              testID={`customer-type-${t.id}`}
              icon="pricetags-outline"
              title={t.name}
              subtitle={`${Object.keys(t.prices ?? {}).length} سعر خاص · ${(customers.data ?? []).filter((c) => c.type_id === t.id).length} عميل`}
              onPress={() => open(t)}
            />
          ))
        )}
      </Card>
      <Sheet
        testID="customer-type-sheet"
        visible={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "تعديل فئة الأسعار" : "فئة أسعار جديدة"}
        footer={
          <>
            <Btn testID="save-customer-type-button" title="حفظ" icon="checkmark" loading={create.isPending || update.isPending} onPress={submit} />
            {form?.id && <Btn testID="delete-customer-type-button" variant="ghost" title="حذف الفئة" onPress={() => del.mutate({ id: form.id })} />}
          </>
        }
      >
        {form && (
          <>
            <Field testID="customer-type-name-input" label="اسم الفئة" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <T v="label">أسعار المنتجات لهذه الفئة</T>
            {(products.data ?? []).map((p, i) => (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <T v="label" numberOfLines={1}>{p.name}</T>
                  <T v="caption">السعر العادي: {money(p.sale_price)}</T>
                </View>
                <View style={{ width: 120 }}>
                  <Field testID={`type-price-input-${i}`} label="سعر الفئة" keyboardType="decimal-pad" placeholder={String(p.sale_price)} value={form.prices[p.id] ?? ""} onChangeText={(v) => setForm({ ...form, prices: { ...form.prices, [p.id]: v } })} />
                </View>
                {form.prices[p.id] ? <Badge text="خاص" tone="success" /> : null}
              </View>
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}
