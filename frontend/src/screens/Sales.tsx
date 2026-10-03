import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { InvoiceActions } from "@/src/components/InvoiceActions";
import { SyncBanner } from "@/src/components/SyncBanner";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { offlineReturn } from "@/src/offlineActions";
import { usePriceResolver } from "@/src/pricing";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, ErrorBox, Field, Header, IconBtn, Loading, Row, Segments, Select, Sheet, T, useToast } from "@/src/ui";

type Tab = "sales" | "returns" | "collections" | "purchases" | "purchase_returns";
type Range = "all" | "today" | "week" | "month";
const since = (r: Range) => {
  const d = new Date();
  if (r === "today") d.setHours(0, 0, 0, 0);
  else if (r === "week") d.setDate(d.getDate() - 7);
  else if (r === "month") d.setDate(d.getDate() - 30);
  else return 0;
  return d.getTime();
};

function InvoiceSheet({ doc, onClose }: { doc: any | null; onClose: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const voidM = useMutate<any>("POST", (b) => `/sales/${b.id}/void`, "تم إلغاء الفاتورة", onClose);
  const canVoid = doc?.invoice_no && !doc.voided && !doc.pending && (user?.role === "OWNER" || user?.employee_type === "ACCOUNTANT");
  return (
    <Sheet testID="invoice-detail-sheet" visible={!!doc} onClose={onClose} title={doc?.invoice_no ?? doc?.return_no ?? ""}>
      {doc && (
        <>
          <Card style={{ gap: spacing.xs }}>
            <T v="h2">{doc.customer_name}</T>
            <T v="caption">الموزع: {doc.distributor_name} · {fmtDate(doc.created_at)}</T>
            {doc.payment_type && <Badge text={doc.payment_type === "CASH" ? "نقدي" : "آجل"} tone={doc.payment_type === "CASH" ? "success" : "warning"} />}
            {doc.voided && <Badge testID="invoice-voided-badge" text={`ملغاة · ${doc.void_reason || ""}`} tone="error" />}
          </Card>
          {doc.items.map((it: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.sm }}>
              <T style={{ flex: 1 }}>{it.product_name}</T>
              <T v="caption">{money(it.quantity)} × {money(it.price)}</T>
              <T v="label">{money(it.total)}</T>
            </View>
          ))}
          <Card style={{ gap: spacing.xs }}>
            {doc.discount_amount > 0 && <T v="caption">المجموع قبل الخصم: {money(doc.subtotal)} · الخصم: {money(doc.discount_amount)}{doc.discount_type === "PERCENT" ? ` (${doc.discount_value}%)` : ""}</T>}
            <T v="h2" testID="invoice-detail-total">الإجمالي: {money(doc.voided ? doc.orig_total : doc.total)}</T>
            {doc.paid_amount !== undefined && (
              <>
                <T color="success">المدفوع: {money(doc.paid_amount)}</T>
                <T color="warning">المتبقي: {money(doc.remaining)}</T>
              </>
            )}
            {!!(doc.notes || doc.reason) && <T v="caption">{doc.notes || doc.reason}</T>}
          </Card>
          {doc.pending && <Badge text="بانتظار المزامنة" tone="warning" />}
          {!doc.voided && <InvoiceActions doc={doc} />}
          {canVoid && (
            <Card style={{ gap: spacing.sm }}>
              <Field testID="void-reason-input" label="سبب الإلغاء" value={reason} onChangeText={setReason} />
              <Btn testID="void-invoice-button" small variant="danger" icon="ban-outline" title="إلغاء الفاتورة (إرجاع المخزون للموزع)" loading={voidM.isPending} onPress={() => voidM.mutate({ id: doc.id, reason })} />
            </Card>
          )}
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
  const resolve = usePriceResolver();
  const price = prod ? resolve(cust, prod.id, prod.sale_price) : 0;
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!cust || !prod || !(+qty > 0)) return toast("أكمل بيانات المرتجع", "error");
    setSaving(true);
    try {
      await offlineReturn({ customer: cust, line: { product_id: prod.id, product_name: prod.name, quantity: +qty, price }, reason, userName: user?.name });
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
      <Select testID="return-product-select" label="المنتج" placeholder="اختر المنتج" value={prod?.name ?? null} options={products.data ?? []} getLabel={(p: any) => p.name} onSelect={setProd} />
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}><Field testID="return-qty-input" label="الكمية" keyboardType="decimal-pad" value={qty} onChangeText={setQty} /></View>
        <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: spacing.sm }}><T v="caption">السعر</T><T v="h2" testID="return-price">{money(price)}</T></View>
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
  const paths: Record<Tab, string> = { sales: "/sales", returns: "/sales-returns", collections: "/collections", purchases: "/purchases", purchase_returns: "/purchase-returns" };
  const q = useApi<any[]>(paths[tab]);
  const labels: Record<Tab, string> = { sales: "المبيعات", returns: "المرتجعات", collections: "التحصيلات", purchases: "المشتريات", purchase_returns: "مرتجع المشتريات" };
  const [range, setRange] = useState<Range>("all");
  const data = (q.data ?? []).filter((x) => new Date(x.created_at).getTime() >= since(range));
  const total = data.reduce((s, x) => s + (x.total ?? x.amount ?? 0), 0);

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
      <View style={{ marginTop: -spacing.md }}>
        <Segments value={range} onChange={setRange} options={[{ key: "all", label: "الكل" }, { key: "today", label: "اليوم" }, { key: "week", label: "7 أيام" }, { key: "month", label: "30 يوماً" }]} />
      </View>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox message={(q.error as Error).message} onRetry={q.refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty icon="receipt-outline" text={`لا توجد ${labels[tab]} بعد`} />}
          renderItem={({ item }) =>
            tab === "purchases" || tab === "purchase_returns" ? (
              <Row testID={`${tab}-row-${item.id}`} icon={tab === "purchases" ? "download-outline" : "arrow-undo-outline"} title={`${item.product_name} × ${money(item.quantity)}`} subtitle={`${item.supplier || "بدون مورد"} · ${fmtDate(item.created_at)}${item.reason ? " · " + item.reason : ""}`} right={<T v="label">{money(item.total)}</T>} />
            ) : tab === "collections" ? (
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
                    <T v="label" style={item.voided ? { textDecorationLine: "line-through" } : undefined}>{money(item.voided ? item.orig_total : item.total)}</T>
                    {item.voided && <Badge text="ملغاة" tone="error" />}
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
