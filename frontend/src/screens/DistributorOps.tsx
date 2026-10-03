import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { SyncBanner } from "@/src/components/SyncBanner";
import { VoucherKind, VoucherSheet, wreturnStatus } from "@/src/components/VoucherSheet";
import { useApi, useBottomChrome } from "@/src/hooks";
import { offlineCollection, offlinePayment, offlineWarehouseReturn } from "@/src/offlineActions";
import { InvoiceSheet, ReturnSheet } from "@/src/screens/Sales";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, Field, Header, IconBtn, Loading, Row, Segments, Select, Sheet, T, useToast } from "@/src/ui";

type OpsTab = "receipts" | "payments" | "returns" | "wreturns";
const isToday = (s: string) => new Date(s).toDateString() === new Date().toDateString();

function NewReceiptSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const customers = useApi<any[]>("/customers", visible);
  const debtors = (customers.data ?? []).filter((c) => c.balance > 0 && !c.pending);
  const [cust, setCust] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!cust) return toast("اختر العميل", "error");
    if (!(+amount > 0)) return toast("أدخل مبلغاً صحيحاً", "error");
    if (+amount > cust.balance + 0.001) return toast("المبلغ أكبر من دين العميل", "error");
    setSaving(true);
    try {
      await offlineCollection({ customer: cust, amount: +amount, notes, userName: user?.name });
      toast("تم تسجيل سند القبض");
      setCust(null); setAmount(""); setNotes("");
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet testID="new-receipt-sheet" visible={visible} onClose={onClose} title="سند قبض جديد" footer={<Btn testID="save-receipt-button" title="حفظ سند القبض" icon="checkmark" loading={saving} onPress={submit} />}>
      <Select
        testID="receipt-customer-select"
        label="العميل"
        placeholder={debtors.length ? "اختر عميلاً مديناً" : "لا يوجد عملاء مدينون"}
        value={cust?.name ?? null}
        options={debtors}
        getLabel={(c: any) => c.name}
        getSub={(c: any) => `الدين: ${money(c.balance)}`}
        onSelect={(c: any) => { setCust(c); setAmount(String(c.balance)); }}
      />
      <Field testID="receipt-amount-input" label="المبلغ المستلم" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Field testID="receipt-notes-input" label="ملاحظات" value={notes} onChangeText={setNotes} />
    </Sheet>
  );
}

function NewPaymentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const customers = useApi<any[]>("/customers", visible);
  const creditors = (customers.data ?? []).filter((c) => c.balance < 0 && !c.pending);
  const [cust, setCust] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!cust) return toast("اختر العميل", "error");
    if (!(+amount > 0)) return toast("أدخل مبلغاً صحيحاً", "error");
    if (+amount > -cust.balance + 0.001) return toast(`المبلغ أكبر من الرصيد الدائن للعميل (${money(-cust.balance)})`, "error");
    if (!notes.trim()) return toast("اكتب سبب رد المبلغ", "error");
    setSaving(true);
    try {
      await offlinePayment({ customer: cust, amount: +amount, notes, userName: user?.name });
      toast("تم تسجيل سند الصرف");
      setCust(null); setAmount(""); setNotes("");
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet testID="new-payment-sheet" visible={visible} onClose={onClose} title="سند صرف جديد (رد مبلغ لعميل)" footer={<Btn testID="save-payment-button" title="حفظ سند الصرف" icon="checkmark" loading={saving} onPress={submit} />}>
      <T v="caption">سند الصرف مخصص لرد المبالغ للعملاء الذين لديهم رصيد دائن (مثلاً بعد مرتجع لفاتورة مدفوعة).</T>
      <Select
        testID="payment-customer-select"
        label="العميل"
        placeholder={creditors.length ? "اختر عميلاً له رصيد دائن" : "لا يوجد عملاء لهم رصيد دائن"}
        value={cust?.name ?? null}
        options={creditors}
        getLabel={(c: any) => c.name}
        getSub={(c: any) => `رصيد دائن: ${money(-c.balance)}`}
        onSelect={(c: any) => { setCust(c); setAmount(String(-c.balance)); }}
      />
      <Field testID="payment-amount-input" label="المبلغ المصروف" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <Field testID="payment-notes-input" label="البيان (سبب الرد)" value={notes} onChangeText={setNotes} />
    </Sheet>
  );
}

function WarehouseReturnSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const inv = useApi<any[]>("/my/inventory", visible);
  const [lines, setLines] = useState<{ item: any; qty: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const stock = (inv.data ?? []).filter((i) => i.quantity > 0 && !lines.some((l) => l.item.product_id === i.product_id));
  const submit = async () => {
    if (!lines.length) return toast("أضف صنفاً واحداً على الأقل", "error");
    const bad = lines.find((l) => !(+l.qty > 0) || +l.qty > l.item.quantity);
    if (bad) return toast(`كمية غير صحيحة: ${bad.item.product_name}`, "error");
    setSaving(true);
    try {
      await offlineWarehouseReturn(lines.map((l) => ({ product_id: l.item.product_id, product_name: l.item.product_name, quantity: +l.qty })), notes, user?.name);
      toast("تم إرسال المرتجع بانتظار تأكيد المستودع");
      setLines([]); setNotes("");
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet testID="wreturn-form-sheet" visible={visible} onClose={onClose} title="إرجاع بضاعة إلى المستودع" footer={<Btn testID="save-wreturn-button" title="إرسال المرتجع" icon="business-outline" loading={saving} onPress={submit} />}>
      <T v="caption">تُخصم الكميات من مخزونك الآن، وتُضاف إلى المستودع بعد تأكيد الإدارة للاستلام. عند الرفض تعود إليك.</T>
      <Select testID="wreturn-product-select" label="إضافة صنف" placeholder={stock.length ? "اختر صنفاً من مخزونك" : "لا توجد أصناف أخرى"} value={null} options={stock} getLabel={(i: any) => i.product_name} getSub={(i: any) => `المتوفر: ${money(i.quantity)}`} onSelect={(i: any) => setLines([...lines, { item: i, qty: "" }])} />
      {lines.map((l, idx) => (
        <View key={l.item.product_id} style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field testID={`wreturn-qty-${l.item.product_id}`} label={`${l.item.product_name} (المتوفر ${money(l.item.quantity)})`} keyboardType="decimal-pad" value={l.qty} onChangeText={(v) => setLines(lines.map((x, i) => (i === idx ? { ...x, qty: v } : x)))} />
          </View>
          <IconBtn testID={`wreturn-remove-${l.item.product_id}`} icon="trash-outline" onPress={() => setLines(lines.filter((_, i) => i !== idx))} />
        </View>
      ))}
      <Field testID="wreturn-notes-input" label="ملاحظات (سبب الإرجاع)" value={notes} onChangeText={setNotes} />
    </Sheet>
  );
}

// Distributor financial & inventory operations tab.
export default function DistributorOps() {
  const { colors } = useTheme();
  const bottom = useBottomChrome();
  const [tab, setTab] = useState<OpsTab>("receipts");
  const [create, setCreate] = useState<OpsTab | null>(null);
  const [voucher, setVoucher] = useState<{ kind: VoucherKind; doc: any } | null>(null);
  const [doc, setDoc] = useState<any>(null);
  const cols = useApi<any[]>("/collections");
  const pays = useApi<any[]>("/payment-vouchers");
  const rets = useApi<any[]>("/sales-returns", tab === "returns");
  const wrets = useApi<any[]>("/warehouse-returns", tab === "wreturns");
  const q = { receipts: cols, payments: pays, returns: rets, wreturns: wrets }[tab];
  const inToday = (cols.data ?? []).filter((c) => isToday(c.created_at)).reduce((s, c) => s + c.amount, 0);
  const outToday = (pays.data ?? []).filter((p) => isToday(p.created_at)).reduce((s, p) => s + p.amount, 0);
  const newLabel: Record<OpsTab, string> = { receipts: "سند قبض جديد", payments: "سند صرف جديد", returns: "مرتجع من عميل", wreturns: "إرجاع بضاعة للمستودع" };
  const newIcon = { receipts: "cash-outline", payments: "arrow-up-circle-outline", returns: "return-down-back-outline", wreturns: "business-outline" } as const;

  const renderItem = ({ item }: { item: any }) => {
    if (tab === "receipts" || tab === "payments") {
      const kind: VoucherKind = tab === "receipts" ? "collection" : "payment";
      return (
        <Row
          testID={`ops-${tab}-row-${item.id}`}
          icon={tab === "receipts" ? "cash-outline" : "arrow-up-circle-outline"}
          title={`${item.receipt_no ?? item.voucher_no} · ${item.customer_name}`}
          subtitle={`${fmtDate(item.created_at)}${item.notes ? ` · ${item.notes}` : ""}`}
          onPress={() => setVoucher({ kind, doc: item })}
          right={
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <T v="label" color={tab === "receipts" ? "success" : "warning"}>{money(item.amount)}</T>
              {item.pending && <Badge text="غير متزامن" tone="warning" />}
            </View>
          }
        />
      );
    }
    if (tab === "returns") {
      return (
        <Row testID={`ops-returns-row-${item.id}`} icon="return-down-back-outline" title={`${item.return_no} · ${item.customer_name}`} subtitle={`${item.items.map((i: any) => `${i.product_name} ×${money(i.quantity)}`).join("، ")} · ${fmtDate(item.created_at)}`} onPress={() => setDoc(item)} right={<T v="label">{money(item.total)}</T>} />
      );
    }
    const st = wreturnStatus(item.status);
    return (
      <Row testID={`ops-wreturns-row-${item.id}`} icon="business-outline" title={item.return_no} subtitle={`${item.items.map((i: any) => `${i.product_name} ×${money(i.quantity)}`).join("، ")} · ${fmtDate(item.created_at)}`} onPress={() => setVoucher({ kind: "wreturn", doc: item })} right={<Badge text={item.pending ? "غير متزامن" : st.text} tone={item.pending ? "warning" : st.tone} />} />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="distributor-ops-screen">
      <Header title="العمليات" subtitle="المالية والمخزون" right={<AccountButton />} />
      <SyncBanner />
      <Segments value={tab} onChange={setTab} options={[{ key: "receipts", label: "سندات القبض" }, { key: "payments", label: "سندات الصرف" }, { key: "returns", label: "مرتجعات العملاء" }, { key: "wreturns", label: "مرتجع للمستودع" }]} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Card style={{ flex: 1, gap: 2, padding: spacing.md }}>
                <T v="caption">مقبوضات اليوم</T>
                <T v="h2" color="success" testID="ops-in-today">{money(inToday)}</T>
              </Card>
              <Card style={{ flex: 1, gap: 2, padding: spacing.md }}>
                <T v="caption">مدفوعات اليوم</T>
                <T v="h2" color="warning" testID="ops-out-today">{money(outToday)}</T>
              </Card>
              <Card style={{ flex: 1, gap: 2, padding: spacing.md }}>
                <T v="caption">صافي النقدية</T>
                <T v="h2" testID="ops-net-today">{money(inToday - outToday)}</T>
              </Card>
            </View>
            <Btn testID={`ops-new-${tab}-button`} title={newLabel[tab]} icon={newIcon[tab]} onPress={() => setCreate(tab)} />
          </View>
        }
        ListEmptyComponent={q.isLoading ? <Loading /> : <Empty icon={newIcon[tab]} text="لا توجد عمليات بعد" />}
        renderItem={renderItem}
      />
      <NewReceiptSheet visible={create === "receipts"} onClose={() => setCreate(null)} />
      <NewPaymentSheet visible={create === "payments"} onClose={() => setCreate(null)} />
      <ReturnSheet visible={create === "returns"} onClose={() => setCreate(null)} />
      <WarehouseReturnSheet visible={create === "wreturns"} onClose={() => setCreate(null)} />
      <VoucherSheet kind={voucher?.kind ?? "collection"} doc={voucher?.doc ?? null} onClose={() => setVoucher(null)} />
      <InvoiceSheet doc={doc} onClose={() => setDoc(null)} />
    </View>
  );
}
