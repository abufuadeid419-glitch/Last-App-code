import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { fmtDate, money } from "@/src/api";
import { AccountButton } from "@/src/components/AccountButton";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, Field, Header, IconBtn, Loading, Segments, Sheet, T, useToast } from "@/src/ui";

const blankPlan = { name: "", price: "", currency: "USD", days: "30", max_employees: "5", features: "", active: true };

export default function DevBilling() {
  const { colors } = useTheme();
  const toast = useToast();
  const bottom = useBottomChrome();
  const [tab, setTab] = useState<"requests" | "plans" | "payment">("requests");
  const reqs = useApi<any[]>("/upgrade-requests");
  const plans = useApi<any[]>("/plans");
  const pay = useApi<any>("/settings/payment");
  const [plan, setPlan] = useState<any>(null);
  const [payForm, setPayForm] = useState<any>(null);
  const review = useMutate<any>("PATCH", (b) => `/dev/upgrade-requests/${b.id}`, "تم تحديث الطلب");
  const createPlan = useMutate("POST", "/dev/plans", "تم إنشاء الخطة", () => setPlan(null));
  const updatePlan = useMutate<any>("PUT", (b) => `/dev/plans/${b.id}`, "تم تحديث الخطة", () => setPlan(null));
  const delPlan = useMutate<any>("DELETE", (b) => `/dev/plans/${b.id}`, "تم حذف الخطة", () => setPlan(null));
  const savePay = useMutate("PUT", "/dev/settings/payment", "تم حفظ إعدادات الدفع");

  useEffect(() => {
    if (pay.data && !payForm) setPayForm(pay.data);
  }, [pay.data, payForm]);

  const submitPlan = () => {
    if (!plan.name.trim() || plan.price === "") return toast("أدخل اسم الخطة والسعر", "error");
    const body = { name: plan.name, price: +plan.price || 0, currency: plan.currency || "USD", days: +plan.days || 30, max_employees: +plan.max_employees || 1, features: plan.features.split("\n").map((s: string) => s.trim()).filter(Boolean), active: plan.active };
    if (plan.id) updatePlan.mutate({ ...body, id: plan.id });
    else createPlan.mutate(body);
  };
  const pending = reqs.data?.filter((r) => r.status === "PENDING").length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="dev-billing-screen">
      <Header title="الاشتراكات" subtitle={`${pending} طلب بانتظار المراجعة`} right={<>{tab === "plans" && <IconBtn testID="add-plan-button" icon="add" tone="brand" onPress={() => setPlan(blankPlan)} />}<AccountButton /></>} />
      <Segments value={tab} onChange={setTab} options={[{ key: "requests", label: "طلبات الترقية" }, { key: "plans", label: "الخطط" }, { key: "payment", label: "إعدادات الدفع" }]} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottom + spacing.xl }} refreshControl={<RefreshControl refreshing={reqs.isRefetching} onRefresh={() => { reqs.refetch(); plans.refetch(); }} tintColor={colors.brandPrimary} />}>
        {tab === "requests" &&
          (reqs.isLoading ? <Loading /> : !reqs.data?.length ? <Empty icon="document-outline" text="لا توجد طلبات ترقية" /> : reqs.data.map((r) => (
            <Card key={r.id} testID={`upgrade-request-${r.id}`} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <T v="label" style={{ flex: 1 }}>{r.org_name}</T>
                <Badge text={r.status === "PENDING" ? "قيد المراجعة" : r.status === "APPROVED" ? "مقبول" : "مرفوض"} tone={r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "success" : "error"} />
              </View>
              <T v="caption">{r.owner_email} · {fmtDate(r.created_at)}</T>
              <T>{r.plan_name} · {money(r.price)} {r.currency} · {r.days} يوم · {r.max_employees} موظف</T>
              <T v="label" selectable>مرجع الدفع: {r.payment_ref}</T>
              {!!r.notes && <T v="caption">{r.notes}</T>}
              {r.status === "PENDING" && (
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                  <Btn testID={`approve-request-${r.id}`} style={{ flex: 1 }} small title="موافقة وتفعيل" icon="checkmark" onPress={() => review.mutate({ id: r.id, action: "approve" })} />
                  <Btn testID={`reject-request-${r.id}`} style={{ flex: 1 }} small variant="danger" title="رفض" icon="close" onPress={() => review.mutate({ id: r.id, action: "reject" })} />
                </View>
              )}
            </Card>
          )))}
        {tab === "plans" &&
          (plans.isLoading ? <Loading /> : !plans.data?.length ? <Empty icon="pricetags-outline" text="لا توجد خطط. أنشئ خطة لتظهر للمالكين." action={<Btn small testID="empty-add-plan-button" title="خطة جديدة" icon="add" onPress={() => setPlan(blankPlan)} />} /> : plans.data.map((p) => (
            <Card key={p.id} testID={`plan-row-${p.id}`} onPress={() => setPlan({ ...p, price: String(p.price), days: String(p.days), max_employees: String(p.max_employees), features: (p.features ?? []).join("\n") })} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <T v="h2" style={{ flex: 1 }}>{p.name}</T>
                <Badge text={p.active ? "ظاهرة" : "مخفية"} tone={p.active ? "success" : "warning"} />
              </View>
              <T>{money(p.price)} {p.currency} · {p.days} يوم · {p.max_employees} موظف</T>
              {!!p.features?.length && <T v="caption">{p.features.join(" · ")}</T>}
            </Card>
          )))}
        {tab === "payment" && payForm && (
          <View style={{ gap: spacing.lg }}>
            <T v="caption">تظهر هذه البيانات للمالكين عند طلب الترقية.</T>
            <Field testID="payment-address-input" label="عنوان/حساب الدفع (شام كاش، بنك...)" value={payForm.payment_address} onChangeText={(v) => setPayForm({ ...payForm, payment_address: v })} />
            <Field testID="payment-whatsapp-input" label="رقم واتساب الدعم (مع رمز الدولة)" keyboardType="phone-pad" value={payForm.whatsapp} onChangeText={(v) => setPayForm({ ...payForm, whatsapp: v })} />
            <Field testID="payment-instructions-input" label="تعليمات الدفع" multiline value={payForm.instructions} onChangeText={(v) => setPayForm({ ...payForm, instructions: v })} />
            <Btn testID="save-payment-settings-button" title="حفظ" icon="checkmark" loading={savePay.isPending} onPress={() => savePay.mutate(payForm)} />
          </View>
        )}
      </ScrollView>
      <Sheet
        testID="plan-form-sheet"
        visible={!!plan}
        onClose={() => setPlan(null)}
        title={plan?.id ? "تعديل خطة" : "خطة جديدة"}
        footer={<>
          <Btn testID="save-plan-button" title="حفظ الخطة" icon="checkmark" loading={createPlan.isPending || updatePlan.isPending} onPress={submitPlan} />
          {plan?.id && <Btn testID="delete-plan-button" variant="ghost" title="حذف الخطة" onPress={() => delPlan.mutate({ id: plan.id })} />}
        </>}
      >
        {plan && (
          <>
            <Field testID="plan-name-input" label="اسم الخطة" value={plan.name} onChangeText={(v) => setPlan({ ...plan, name: v })} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field testID="plan-price-input" label="السعر" keyboardType="decimal-pad" value={plan.price} onChangeText={(v) => setPlan({ ...plan, price: v })} /></View>
              <View style={{ flex: 1 }}><Field testID="plan-currency-input" label="العملة" value={plan.currency} onChangeText={(v) => setPlan({ ...plan, currency: v })} /></View>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field testID="plan-days-input" label="المدة (أيام)" keyboardType="number-pad" value={plan.days} onChangeText={(v) => setPlan({ ...plan, days: v })} /></View>
              <View style={{ flex: 1 }}><Field testID="plan-max-input" label="عدد الموظفين" keyboardType="number-pad" value={plan.max_employees} onChangeText={(v) => setPlan({ ...plan, max_employees: v })} /></View>
            </View>
            <Field testID="plan-features-input" label="المميزات (سطر لكل ميزة)" multiline value={plan.features} onChangeText={(v) => setPlan({ ...plan, features: v })} style={{ minHeight: 90 }} />
            <Btn testID="toggle-plan-active-button" small variant="secondary" title={plan.active ? "الخطة ظاهرة للمالكين · إخفاء" : "الخطة مخفية · إظهار"} icon={plan.active ? "eye-outline" : "eye-off-outline"} onPress={() => setPlan({ ...plan, active: !plan.active })} />
          </>
        )}
      </Sheet>
    </View>
  );
}
