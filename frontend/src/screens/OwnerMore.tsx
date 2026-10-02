import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { fmtDate } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { AgentsMap } from "@/src/components/AgentsMap";
import { OrgProfile } from "@/src/components/OrgProfile";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, Field, Header, IconBtn, Loading, Row, Section, Segments, Select, Sheet, T, useToast } from "@/src/ui";

function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<"FIELD_AGENT" | "ACCOUNTANT">("FIELD_AGENT");
  const [code, setCode] = useState<string | null>(null);
  const m = useMutate("POST", "/employees/invite", "تم إنشاء رمز الدعوة", (r) => setCode(r.code));
  const close = () => { setCode(null); setName(""); onClose(); };
  return (
    <Sheet testID="invite-sheet" visible={visible} onClose={close} title="إضافة موظف"
      footer={code ? <Btn testID="invite-done-button" title="تم" onPress={close} /> : <Btn testID="create-invite-button" title="إنشاء رمز التفعيل" icon="key-outline" loading={m.isPending} onPress={() => (name.trim() ? m.mutate({ name, employee_type: type }) : toast("أدخل اسم الموظف", "error"))} />}>
      {code ? (
        <Card style={{ alignItems: "center", gap: spacing.sm }}>
          <T v="caption">أرسل هذا الرمز للموظف ليفعّل حسابه بعد تسجيل الدخول</T>
          <T v="title" color="brandPrimary" selectable testID="invite-code-text">{code}</T>
        </Card>
      ) : (
        <>
          <Field testID="invite-name-input" label="اسم الموظف" value={name} onChangeText={setName} />
          <T v="label" color="onSurfaceSecondary">نوع الحساب</T>
          <View style={{ marginHorizontal: -spacing.lg }}>
            <Segments value={type} onChange={setType} options={[{ key: "FIELD_AGENT", label: "موزع ميداني" }, { key: "ACCOUNTANT", label: "محاسب" }]} />
          </View>
        </>
      )}
    </Sheet>
  );
}

function DeliverySheet({ visible, onClose, agents }: { visible: boolean; onClose: () => void; agents: any[] }) {
  const toast = useToast();
  const products = useApi<any[]>("/products", visible);
  const [agent, setAgent] = useState<any>(null);
  const [lines, setLines] = useState<{ product: any; qty: string }[]>([]);
  const m = useMutate("POST", "/deliveries", "تم تسليم البضاعة للموزع", () => { setLines([]); setAgent(null); onClose(); });
  const submit = () => {
    if (!agent || !lines.length || lines.some((l) => !(+l.qty > 0))) return toast("اختر الموزع وأدخل الكميات", "error");
    m.mutate({ distributor_id: agent.user_id, items: lines.map((l) => ({ product_id: l.product.id, quantity: +l.qty })) });
  };
  return (
    <Sheet testID="delivery-sheet" visible={visible} onClose={onClose} title="تسليم بضاعة لموزع" footer={<Btn testID="save-delivery-button" title="تأكيد التسليم" icon="car-outline" onPress={submit} loading={m.isPending} />}>
      <Select testID="delivery-agent-select" label="الموزع" placeholder="اختر الموزع" value={agent?.name ?? null} options={agents} getLabel={(a: any) => a.name ?? a.email} onSelect={setAgent} />
      {lines.map((l, i) => (
        <View key={l.product.id} style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field testID={`delivery-qty-input-${i}`} label={`${l.product.name} (المستودع: ${l.product.stock})`} keyboardType="decimal-pad" value={l.qty} onChangeText={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: v } : x)))} />
          </View>
          <IconBtn testID={`delivery-remove-${i}`} icon="trash-outline" onPress={() => setLines(lines.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Select testID="delivery-product-select" label="إضافة منتج" placeholder="+ اختر منتجاً" value={null} options={(products.data ?? []).filter((p) => p.stock > 0 && !lines.find((l) => l.product.id === p.id))} getLabel={(p: any) => p.name} getSub={(p: any) => `المستودع: ${p.stock}`} onSelect={(p) => setLines([...lines, { product: p, qty: "" }])} />
    </Sheet>
  );
}

export default function OwnerMore() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const bottom = useBottomChrome();
  const [tab, setTab] = useState<"team" | "deliveries" | "tracking" | "profile">("team");
  const tracking = useApi<any[]>("/tracking/agents", tab === "tracking");
  const emps = useApi<any>("/employees");
  const deliveries = useApi<any[]>("/deliveries");
  const [invite, setInvite] = useState(false);
  const [deliver, setDeliver] = useState(false);
  const delInvite = useMutate<any>("DELETE", (b) => `/employees/invite/${b.id}`, "تم حذف الدعوة");
  const removeEmp = useMutate<any>("DELETE", (b) => `/employees/${b.user_id}`, "تمت إزالة الموظف");
  const agents = (emps.data?.employees ?? []).filter((e: any) => e.employee_type === "FIELD_AGENT");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="owner-more-screen">
      <Header title="الإدارة" subtitle={`${user?.org?.name ?? ""} · حتى ${user?.org?.max_employees ?? 0} موظفين`} right={<AccountButton />} />
      <Segments value={tab} onChange={setTab} options={[{ key: "team", label: "الموظفون" }, { key: "deliveries", label: "تسليم البضاعة" }, { key: "tracking", label: "تتبع GPS" }, { key: "profile", label: "ملف المؤسسة" }]} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={emps.isRefetching || deliveries.isRefetching} onRefresh={() => { emps.refetch(); deliveries.refetch(); tracking.refetch(); }} tintColor={colors.brandPrimary} />}
      >
        {tab === "profile" ? (
          <OrgProfile />
        ) : tab === "tracking" ? (
          tracking.isLoading ? <Loading /> : <AgentsMap agents={tracking.data ?? []} />
        ) : tab === "team" ? (
          <>
            <Btn testID="open-invite-button" title="إضافة موظف جديد" icon="person-add-outline" onPress={() => setInvite(true)} />
            <Section title="الموظفون">
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {!emps.data?.employees?.length ? <Empty icon="people-outline" text="لا يوجد موظفون مفعّلون" /> : emps.data.employees.map((e: any) => (
                  <Row key={e.user_id} testID={`employee-row-${e.user_id}`} icon={e.employee_type === "ACCOUNTANT" ? "calculator-outline" : "car-outline"} title={e.name ?? e.email} subtitle={`${e.employee_type === "ACCOUNTANT" ? "محاسب" : "موزع ميداني"} · ${e.email}`}
                    right={<IconBtn testID={`remove-employee-${e.user_id}`} icon="person-remove-outline" onPress={() => removeEmp.mutate(e)} />} />
                ))}
              </Card>
            </Section>
            <Section title="دعوات بانتظار التفعيل">
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {!emps.data?.invitations?.length ? <Empty icon="mail-outline" text="لا توجد دعوات معلّقة" /> : emps.data.invitations.map((i: any) => (
                  <Row key={i.id} testID={`invite-row-${i.id}`} icon="key-outline" title={i.name} subtitle={i.code}
                    right={<IconBtn testID={`delete-invite-${i.id}`} icon="trash-outline" onPress={() => delInvite.mutate(i)} />} />
                ))}
              </Card>
            </Section>
          </>
        ) : (
          <>
            <Btn testID="open-delivery-button" title="تسليم بضاعة لموزع" icon="car-outline" onPress={() => setDeliver(true)} disabled={!agents.length} />
            {!agents.length && <T v="caption" style={{ textAlign: "center" }}>أضف موزعاً ميدانياً أولاً من تبويب الموظفين</T>}
            <Section title="سجل التسليمات">
              <Card style={{ padding: 0, overflow: "hidden" }}>
                {!deliveries.data?.length ? <Empty icon="car-outline" text="لا توجد تسليمات" /> : deliveries.data.map((d) => (
                  <Row key={d.id} testID={`delivery-row-${d.id}`} icon="car-outline" title={d.distributor_name ?? "موزع"} subtitle={`${d.items.map((x: any) => `${x.product_name} ×${x.quantity}`).join("، ")} · ${fmtDate(d.created_at)}`} right={<Badge text={`${d.items.length} صنف`} />} />
                ))}
              </Card>
            </Section>
          </>
        )}
      </KeyboardAwareScrollView>
      <InviteSheet visible={invite} onClose={() => setInvite(false)} />
      <DeliverySheet visible={deliver} onClose={() => setDeliver(false)} agents={agents} />
    </View>
  );
}

