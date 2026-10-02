import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { InvoiceActions } from "@/src/components/InvoiceActions";
import { SyncBanner } from "@/src/components/SyncBanner";
import { useApi, useBottomChrome } from "@/src/hooks";
import { offlineReturn } from "@/src/offlineActions";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, ErrorBox, Field, Header, IconBtn, Loading, Row, Segments, Select, Sheet, T, useToast } from "@/src/ui";

type Tab = "sales" | "returns" | "collections";

function InvoiceSheet({ doc, onClose }: { doc: any | null; onClose: () => void }) {
  return (
    <Sheet testID="invoice-detail-sheet" visible={!!doc} onClose={onClose} title={doc?.invoice_no ?? doc?.return_no ?? ""}>
      {doc && (
        <>
          <Card style={{ gap: spacing.xs }}>
            <T v="h2">{doc.customer_name}</T>
            <T v="caption">الموزع: {doc.distributor_name} · {fmtDate(doc.created_at)}</T>
            {doc.payment_type && <Badge text={doc.payment_type === "CASH" ? "نقدي" : "آجل"} tone={doc.payment_type === "CASH" ? "success" : "warning"} />}
          </Card>
          {doc.items.map((it: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
              <T style={{ flex: 1 }}>{it.product_name}</T>
              <T v="caption">{money(it.quantity)} × {money(it.price)}</T>
              <T v="label">{money(it.total)}</T>
            </View>
          ))}
          <Card style={{ gap: spacing.xs }}>
            <T v="h2" testID="invoice-detail-total">الإجمالي: {money(doc.total)}</T>
            {doc.paid_amount !== undefined && (
              <>
                <T color="success">المدفوع: {money(doc.paid_amount)}</T>
                <T color="warning">المتبقي: {money(doc.remaining)}</T>
              </>
            )}
            {!!(doc.notes || doc.reason) && <T v="caption">{doc.notes || doc.reason}</T>}
          </Card>
          {doc.pending && <Badge text="بانتظار المزامنة" tone="warning" />}
          <InvoiceActions doc={doc} />
        </>
      )}
    </Sheet>
  );
}

function ReturnSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const customers = useApi<any[]>("/customers", visible);
  const products = useApi<any[]>("/products", visible);
  const [cust, setCust] = useState<any>(null);
  const [prod, setProd] = useState<any>(null);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!cust || !prod || !(+qty > 0)) return toast("أكمل بيانات المرتجع", "error");
    setSaving(true);
    try {
      await offlineReturn({ customer: cust, line: { product_id: prod.id, product_name: prod.name, quantity: +qty, price: +price || 0 }, reason, userName: user?.name });
      toast("تم تسجيل المرتجع");
      setCust(null); setProd(null); setQty(""); setReason("");
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet testID="return-form-sheet" visible={visible} onClose={onClose} title="مرتجع مبيعات" footer={<Btn testID="save-return-button" title="حفظ المرتجع" icon="return-down-back-outline" onPress={submit} loading={saving} />}>
      <Select testID="return-customer-select" label="العميل" placeholder="اختر العميل" value={cust?.name ?? null} options={customers.data ?? []} getLabel={(c: any) => c.name} onSelect={setCust} />
      <Select testID="return-product-select" label="المنتج" placeholder="اختر المنتج" value={prod?.name ?? null} options={products.data ?? []} getLabel={(p: any) => p.name} onSelect={(p: any) => { setProd(p); setPrice(String(p.sale_price)); }} />
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}><Field testID="return-qty-input" label="الكمية" keyboardType="decimal-pad" value={qty} onChangeText={setQty} /></View>
        <View style={{ flex: 1 }}><Field testID="return-price-input" label="السعر" keyboardType="decimal-pad" value={price} onChangeText={setPrice} /></View>
      </View>
      <Field testID="return-reason-input" label="سبب الإرجاع" value={reason} onChangeText={setReason} />
    </Sheet>
  );
}

export default function Sales({ tabs = ["sales", "returns"], title = "الفواتير" }: { tabs?: Tab[]; title?: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const bottom = useBottomChrome();
  const [tab, setTab] = useState<Tab>(tabs[0]);
  const [doc, setDoc] = useState<any>(null);
  const [ret, setRet] = useState(false);
  const isAgent = user?.employee_type === "FIELD_AGENT";
  const path = tab === "sales" ? "/sales" : tab === "returns" ? "/sales-returns" : "/collections";
  const q = useApi<any[]>(path);
  const labels: Record<Tab, string> = { sales: "المبيعات", returns: "المرتجعات", collections: "التحصيلات" };
  const total = (q.data ?? []).reduce((s, x) => s + (x.total ?? x.amount ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="sales-screen">
      <Header
        title={title}
        subtitle={`الإجمالي: ${money(total)}`}
        right={
          <>
            {isAgent && tab === "returns" && <IconBtn testID="add-return-button" icon="add" tone="brand" onPress={() => setRet(true)} />}
            <AccountButton />
          </>
        }
      />
      <SyncBanner />
      {tabs.length > 1 && <Segments value={tab} onChange={setTab} options={tabs.map((k) => ({ key: k, label: labels[k] }))} />}
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={(q.error as Error).message} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty icon="receipt-outline" text={`لا توجد ${labels[tab]} بعد`} />}
          renderItem={({ item }) =>
            tab === "collections" ? (
              <Row testID={`collection-row-${item.id}`} icon="cash-outline" title={`${item.receipt_no} · ${item.customer_name}`} subtitle={`${item.collector_name ?? ""} · ${fmtDate(item.created_at)}`} right={<T v="label" color="success">{money(item.amount)}</T>} />
            ) : (
              <Row
                testID={`${tab}-row-${item.id}`}
                icon={tab === "sales" ? "receipt-outline" : "return-down-back-outline"}
                title={`${item.invoice_no ?? item.return_no} · ${item.customer_name}`}
                subtitle={`${item.distributor_name ?? ""} · ${fmtDate(item.created_at)}`}
                onPress={() => setDoc(item)}
                right={
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <T v="label">{money(item.total)}</T>
                    {item.pending && <Badge text="غير متزامن" tone="warning" />}
                    {tab === "sales" && item.remaining > 0 && <Badge text={`آجل ${money(item.remaining)}`} tone="warning" />}
                  </View>
                }
              />
            )
          }
        />
      )}
      <InvoiceSheet doc={doc} onClose={() => setDoc(null)} />
      {isAgent && <ReturnSheet visible={ret} onClose={() => setRet(false)} />}
    </View>
  );
}
