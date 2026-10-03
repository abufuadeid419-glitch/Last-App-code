import { useMemo, useState } from "react";
import { FlatList, Linking, Platform, RefreshControl, TextInput, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { CollectSheet } from "@/src/components/CollectSheet";
import { StatementActions } from "@/src/components/StatementActions";
import { SyncBanner } from "@/src/components/SyncBanner";
import { isStale, useDebtReminder } from "@/src/debtReminder";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { currentCoords } from "@/src/location";
import { mapOpenUrl } from "@/src/maps";
import { offlineCustomer } from "@/src/offlineActions";
import { useTypeName } from "@/src/pricing";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, ErrorBox, Field, Header, IconBtn, IconName, Ionicons, Loading, Row, Segments, Select, Sheet, T, useToast } from "@/src/ui";

const typeLabel: Record<string, string> = { SALE: "فاتورة", COLLECTION: "تحصيل", RETURN: "مرتجع", PAYMENT: "سند صرف" };

function Detail({ icon, text, testID }: { icon: IconName; text: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }} testID={testID}>
      <Ionicons name={icon} size={16} color={colors.onSurfaceSecondary} />
      <T style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

export function StatementSheet({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const { user } = useAuth();
  const typeName = useTypeName();
  const st = useApi<any>(`/customers/${customerId}/statement`, !!customerId);
  const c = st.data?.customer;
  let bal = 0;
  return (
    <Sheet testID="statement-sheet" visible={!!customerId} onClose={onClose} title="بيانات العميل وكشف الحساب">
      {st.isLoading || !st.data ? (
        <Loading />
      ) : (
        <>
          <Card style={{ gap: spacing.sm }} testID="customer-details-card">
            <T v="h2">{c.name}</T>
            <Detail icon="call-outline" text={c.phone || "—"} testID="customer-detail-phone" />
            <Detail icon="location-outline" text={c.address || "—"} />
            <Detail icon="pricetag-outline" text={`فئة الأسعار: ${typeName(c.type_id) ?? "سعر عادي"}`} />
            {user?.employee_type !== "FIELD_AGENT" && <Detail icon="car-outline" text={`الموزع المسؤول: ${c.distributor_name || "—"}`} testID="customer-detail-distributor" />}
            <Detail icon="calendar-outline" text={`تاريخ الإضافة: ${c.created_at ? fmtDate(c.created_at) : "—"}`} />
            {!!c.last_reminder_at && <Detail icon="logo-whatsapp" text={`آخر تذكير بالدين: ${fmtDate(c.last_reminder_at)}`} />}
            {c.lat != null && <Btn testID="customer-open-map" small variant="ghost" icon="map-outline" title="عرض موقع العميل على خرائط Google" onPress={() => Linking.openURL(mapOpenUrl(c.lat, c.lng))} />}
            <T v="label" color={c.balance > 0 ? "warning" : "success"} testID="statement-balance">الرصيد المستحق: {money(c.balance)}</T>
          </Card>
          <StatementActions data={st.data} />
          {!st.data.rows.length && <Empty text="لا توجد حركات" />}
          {st.data.rows.map((r: any, i: number) => {
            bal += r.debit - r.credit;
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <T v="label">{typeLabel[r.type] ?? r.type} {r.ref}</T>
                  <T v="caption">{fmtDate(r.date)}</T>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {r.debit > 0 && <T v="caption" color="error">مدين {money(r.debit)}</T>}
                  {r.credit > 0 && <T v="caption" color="success">دائن {money(r.credit)}</T>}
                  <T v="label">{money(bal)}</T>
                </View>
              </View>
            );
          })}
        </>
      )}
    </Sheet>
  );
}

type Form = { id?: string; name: string; phone: string; address: string; type_id: string | null; typeChosen: boolean; lat: number | null; lng: number | null; location?: string };

// Every customer field is mandatory.
function validate(f: Form) {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "اسم العميل مطلوب";
  const digits = f.phone.replace(/\D/g, "");
  if (!digits) e.phone = "رقم الهاتف مطلوب";
  else if (digits.length < 7) e.phone = "رقم الهاتف غير صالح";
  if (!f.address.trim()) e.address = "العنوان مطلوب";
  if (!f.typeChosen) e.type = "اختر فئة العميل";
  if (f.lat == null || f.lng == null) e.location = "حدد موقع العميل عبر GPS";
  return e;
}

export default function Customers({ debtsOnly = false }: { debtsOnly?: boolean }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const bottom = useBottomChrome();
  const list = useApi<any[]>("/customers");
  const types = useApi<any[]>("/customer-types");
  const typeName = useTypeName();
  const remind = useDebtReminder();
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [tried, setTried] = useState(false);
  const [statement, setStatement] = useState<string | null>(null);
  const [collect, setCollect] = useState<any | null>(null);
  const [dist, setDist] = useState("all");
  const [debtFilter, setDebtFilter] = useState<"all" | "stale">("all");
  const update = useMutate<any>("PUT", (b) => `/customers/${b.id}`, "تم تحديث العميل", () => setForm(null));
  const isAgent = user?.employee_type === "FIELD_AGENT";
  const isOwner = user?.role === "OWNER";
  // Only distributors add/edit customers; owner & accountant see a read-only database.
  const canEdit = isAgent;

  const distributors = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of list.data ?? []) if (c.distributor_id) m.set(c.distributor_id, c.distributor_name || "موزع");
    return [...m].map(([key, label]) => ({ key, label }));
  }, [list.data]);

  const data = useMemo(
    () =>
      (list.data ?? []).filter(
        (c) =>
          (!debtsOnly || c.balance > 0) &&
          (!debtsOnly || debtFilter === "all" || isStale(c)) &&
          (dist === "all" || c.distributor_id === dist) &&
          [c.name, c.phone, c.address, c.distributor_name].some((v) => (v ?? "").includes(q)),
      ),
    [list.data, q, debtsOnly, dist, debtFilter],
  );
  const totalDebt = data.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
  const errors = form ? validate(form) : {};
  const err = (k: string) => (tried ? errors[k] : undefined);

  const openNew = () => {
    setTried(false);
    setForm({ name: "", phone: "", address: "", type_id: null, typeChosen: false, lat: null, lng: null });
  };
  const submit = () => {
    if (!form) return;
    setTried(true);
    if (Object.keys(errors).length) return toast("جميع بيانات العميل إلزامية، أكمل الحقول المطلوبة", "error");
    const body = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), type_id: form.type_id, lat: form.lat, lng: form.lng };
    if (form.id) update.mutate({ ...body, location: form.location ?? "", id: form.id });
    else {
      offlineCustomer(body).then(() => {
        toast("تمت إضافة العميل");
        setForm(null);
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID={debtsOnly ? "debts-screen" : "customers-screen"}>
      <Header
        title={debtsOnly ? "الديون" : "العملاء"}
        subtitle={debtsOnly ? `إجمالي المستحق: ${money(totalDebt)}` : `${list.data?.length ?? 0} عميل${canEdit ? "" : " · عرض فقط"}`}
        right={
          <>
            {canEdit && !debtsOnly && <IconBtn testID="add-customer-button" icon="person-add-outline" tone="brand" onPress={openNew} />}
            <AccountButton />
          </>
        }
      />
      <SyncBanner />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <TextInput
          testID="customer-search-input"
          value={q}
          onChangeText={setQ}
          placeholder={isAgent ? "ابحث بالاسم أو الهاتف" : "ابحث بالاسم أو الهاتف أو العنوان أو الموزع"}
          placeholderTextColor={colors.muted}
          style={{ minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, fontFamily: fonts.regular, color: colors.onSurface, textAlign: Platform.OS === "web" ? "right" : undefined }}
        />
        {debtsOnly && <T v="caption" style={{ marginTop: spacing.xs }}>اضغط أيقونة واتساب لإرسال تذكير بالرصيد المستحق للعميل</T>}
        {!isAgent && !debtsOnly && <T v="caption" style={{ marginTop: spacing.xs }} testID="customers-readonly-note">قاعدة بيانات عملاء الشركة للعرض فقط · يضيف كل موزع عملاءه من تطبيقه</T>}
      </View>
      {debtsOnly ? (
        <Segments value={debtFilter} onChange={setDebtFilter} options={[{ key: "all", label: "كل المدينين" }, { key: "stale", label: "لم يُذكَّروا منذ 7 أيام" }]} />
      ) : !isAgent && distributors.length > 0 ? (
        <Segments value={dist} onChange={setDist} options={[{ key: "all", label: "كل الموزعين" }, ...distributors]} />
      ) : (
        <View style={{ height: spacing.sm }} />
      )}
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox message={(list.error as Error).message} onRetry={list.refetch} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={list.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty icon={debtsOnly ? "checkmark-done-outline" : "people-outline"} text={debtsOnly ? "لا توجد ديون مستحقة" : isAgent ? "لا يوجد عملاء بعد. أضف أول عميل" : "لا يوجد عملاء بعد"} />}
          renderItem={({ item }) => (
            <Row
              testID={`customer-row-${item.id}`}
              icon="person-outline"
              title={item.name}
              subtitle={
                [
                  typeName(item.type_id),
                  item.phone,
                  item.address,
                  !isAgent && item.distributor_name ? `الموزع: ${item.distributor_name}` : "",
                  debtsOnly && item.last_reminder_at ? `آخر تذكير: ${fmtDate(item.last_reminder_at)}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
              onPress={() => (item.pending ? toast("العميل بانتظار المزامنة", "error") : setStatement(item.id))}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Badge text={money(item.balance)} tone={item.balance > 0 ? "warning" : "success"} />
                  {debtsOnly && item.balance > 0 && <IconBtn testID={`remind-customer-${item.id}`} icon="logo-whatsapp" tone="brand" onPress={() => remind(item)} />}
                  {!isOwner && item.balance > 0 && <IconBtn testID={`collect-customer-${item.id}`} icon="cash-outline" onPress={() => setCollect(item)} />}
                  {canEdit && !debtsOnly && !item.pending && <IconBtn testID={`edit-customer-${item.id}`} icon="create-outline" onPress={() => { setTried(false); setForm({ ...item, typeChosen: true }); }} />}
                </View>
              }
            />
          )}
        />
      )}
      <Sheet
        testID="customer-form-sheet"
        visible={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? "تعديل عميل" : "عميل جديد"}
        footer={<Btn testID="save-customer-button" title="حفظ" icon="checkmark" onPress={submit} loading={update.isPending} />}
      >
        {form && (
          <>
            <T v="caption">جميع الحقول إلزامية</T>
            <Field testID="customer-name-input" label="اسم العميل / المحل *" value={form.name} error={err("name")} onChangeText={(v) => setForm({ ...form, name: v })} />
            <Field testID="customer-phone-input" label="الهاتف *" keyboardType="phone-pad" value={form.phone} error={err("phone")} onChangeText={(v) => setForm({ ...form, phone: v })} />
            <Field testID="customer-address-input" label="العنوان *" value={form.address} error={err("address")} onChangeText={(v) => setForm({ ...form, address: v })} />
            <Select
              testID="customer-type-select"
              label="فئة العميل (قائمة الأسعار) *"
              placeholder="اختر فئة العميل"
              value={form.typeChosen ? (typeName(form.type_id) ?? "سعر عادي") : null}
              options={[{ id: null, name: "سعر عادي" }, ...(types.data ?? [])]}
              getLabel={(t: any) => t.name}
              onSelect={(t: any) => setForm({ ...form, type_id: t.id, typeChosen: true })}
            />
            {!!err("type") && <T v="caption" color="error" testID="customer-type-error">{err("type")}</T>}
            <Btn
              testID="customer-use-location-button"
              small
              variant="secondary"
              icon="location-outline"
              title={form.lat != null ? `الموقع محفوظ (${Number(form.lat).toFixed(4)}, ${Number(form.lng).toFixed(4)}) · تحديث` : "حفظ موقعي الحالي كموقع للعميل *"}
              onPress={async () => {
                const c = await currentCoords();
                if (c) setForm({ ...form, ...c });
                else toast("فعّل إذن الموقع أولاً", "error");
              }}
            />
            {!!err("location") && <T v="caption" color="error" testID="customer-location-error">{err("location")}</T>}
          </>
        )}
      </Sheet>
      <StatementSheet customerId={statement} onClose={() => setStatement(null)} />
      <CollectSheet customer={collect} onClose={() => setCollect(null)} />
    </View>
  );
}
