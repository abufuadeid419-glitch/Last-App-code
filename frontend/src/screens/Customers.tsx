import { useMemo, useState } from "react";
import { FlatList, Platform, RefreshControl, TextInput, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { CollectSheet } from "@/src/components/CollectSheet";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { fonts, radius, spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, ErrorBox, Field, Header, IconBtn, Loading, Row, Sheet, T, useToast } from "@/src/ui";

const typeLabel: Record<string, string> = { SALE: "فاتورة", COLLECTION: "تحصيل", RETURN: "مرتجع" };

export function StatementSheet({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const st = useApi<any>(`/customers/${customerId}/statement`, !!customerId);
  let bal = 0;
  return (
    <Sheet testID="statement-sheet" visible={!!customerId} onClose={onClose} title="كشف حساب العميل">
      {st.isLoading || !st.data ? (
        <Loading />
      ) : (
        <>
          <Card style={{ gap: spacing.xs }}>
            <T v="h2">{st.data.customer.name}</T>
            <T v="caption">{st.data.customer.phone} {st.data.customer.address}</T>
            <T v="label" color={st.data.customer.balance > 0 ? "warning" : "success"} testID="statement-balance">الرصيد المستحق: {money(st.data.customer.balance)}</T>
          </Card>
          {!st.data.rows.length && <Empty text="لا توجد حركات" />}
          {st.data.rows.map((r: any, i: number) => {
            bal += r.debit - r.credit;
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <T v="label">{typeLabel[r.type]} {r.ref}</T>
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

export default function Customers({ debtsOnly = false }: { debtsOnly?: boolean }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const bottom = useBottomChrome();
  const list = useApi<any[]>("/customers");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any | null>(null);
  const [statement, setStatement] = useState<string | null>(null);
  const [collect, setCollect] = useState<any | null>(null);
  const create = useMutate("POST", "/customers", "تمت إضافة العميل", () => setForm(null));
  const update = useMutate<any>("PUT", (b) => `/customers/${b.id}`, "تم تحديث العميل", () => setForm(null));
  const canEdit = user?.role === "OWNER" || user?.employee_type === "ACCOUNTANT";

  const data = useMemo(
    () => (list.data ?? []).filter((c) => (!debtsOnly || c.balance > 0) && (c.name.includes(q) || c.phone.includes(q))),
    [list.data, q, debtsOnly],
  );
  const totalDebt = data.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);

  const submit = () => {
    if (!form.name.trim()) return toast("اسم العميل مطلوب", "error");
    const body = { name: form.name, phone: form.phone, address: form.address, location: form.location ?? "" };
    if (form.id) update.mutate({ ...body, id: form.id });
    else create.mutate(body);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID={debtsOnly ? "debts-screen" : "customers-screen"}>
      <Header
        title={debtsOnly ? "الديون" : "العملاء"}
        subtitle={debtsOnly ? `إجمالي المستحق: ${money(totalDebt)}` : `${list.data?.length ?? 0} عميل`}
        right={
          <>
            {!debtsOnly && <IconBtn testID="add-customer-button" icon="person-add-outline" tone="brand" onPress={() => setForm({ name: "", phone: "", address: "" })} />}
            <AccountButton />
          </>
        }
      />
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <TextInput
          testID="customer-search-input"
          value={q}
          onChangeText={setQ}
          placeholder="ابحث بالاسم أو الهاتف"
          placeholderTextColor={colors.muted}
          style={{ minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, fontFamily: fonts.regular, color: colors.onSurface, textAlign: Platform.OS === "web" ? "right" : undefined }}
        />
      </View>
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
          ListEmptyComponent={<Empty icon={debtsOnly ? "checkmark-done-outline" : "people-outline"} text={debtsOnly ? "لا توجد ديون مستحقة" : "لا يوجد عملاء بعد"} />}
          renderItem={({ item }) => (
            <Row
              testID={`customer-row-${item.id}`}
              icon="person-outline"
              title={item.name}
              subtitle={[item.phone, item.address].filter(Boolean).join(" · ") || "—"}
              onPress={() => setStatement(item.id)}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Badge text={money(item.balance)} tone={item.balance > 0 ? "warning" : "success"} />
                  {item.balance > 0 && <IconBtn testID={`collect-customer-${item.id}`} icon="cash-outline" onPress={() => setCollect(item)} />}
                  {canEdit && !debtsOnly && <IconBtn testID={`edit-customer-${item.id}`} icon="create-outline" onPress={() => setForm(item)} />}
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
        footer={<Btn testID="save-customer-button" title="حفظ" icon="checkmark" onPress={submit} loading={create.isPending || update.isPending} />}
      >
        {form && (
          <>
            <Field testID="customer-name-input" label="اسم العميل / المحل" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <Field testID="customer-phone-input" label="الهاتف" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
            <Field testID="customer-address-input" label="العنوان" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
          </>
        )}
      </Sheet>
      <StatementSheet customerId={statement} onClose={() => setStatement(null)} />
      <CollectSheet customer={collect} onClose={() => setCollect(null)} />
    </View>
  );
}
