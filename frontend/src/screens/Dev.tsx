import { useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";

import { fmtDate } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AccountButton } from "@/src/components/AccountButton";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, ErrorBox, Field, Header, IconBtn, Loading, Row, Sheet, Stat, T, useToast } from "@/src/ui";

export function DevHome() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const bottom = useBottomChrome();
  const s = useApi<any>("/dev/stats");
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="dev-home-screen">
      <Header title="لوحة المطور" subtitle={user?.email} right={<AccountButton />} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottom + spacing.xl }} refreshControl={<RefreshControl refreshing={s.isRefetching} onRefresh={s.refetch} tintColor={colors.brandPrimary} />}>
        {s.isLoading ? <Loading /> : s.error ? <ErrorBox message={(s.error as Error).message} onRetry={s.refetch} /> : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            <Stat testID="dev-stat-orgs" label="المؤسسات" value={String(s.data.orgs)} icon="business-outline" />
            <Stat testID="dev-stat-active" label="مؤسسات فعّالة" value={String(s.data.active_orgs)} icon="checkmark-circle-outline" tone="success" />
            <Stat testID="dev-stat-trials" label="تجريبية" value={String(s.data.trials)} icon="hourglass-outline" tone="warning" />
            <Stat testID="dev-stat-licenses" label="تراخيص جاهزة" value={String(s.data.licenses_ready)} icon="key-outline" tone="info" />
            <Stat testID="dev-stat-users" label="المستخدمون" value={String(s.data.users)} icon="people-outline" />
            <Stat testID="dev-stat-sales" label="الفواتير" value={String(s.data.sales)} icon="receipt-outline" tone="success" />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export function DevLicenses() {
  const { colors } = useTheme();
  const toast = useToast();
  const bottom = useBottomChrome();
  const q = useApi<any[]>("/dev/licenses");
  const [form, setForm] = useState<any>(null);
  const create = useMutate("POST", "/dev/licenses", "تم إنشاء الترخيص", () => setForm(null));
  const del = useMutate<any>("DELETE", (b) => `/dev/licenses/${b.id}`, "تم حذف الترخيص");
  const submit = () => {
    if (!form.org_name.trim()) return toast("اسم المؤسسة مطلوب", "error");
    create.mutate({ org_name: form.org_name, days: +form.days || 365, max_employees: +form.max_employees || 10 });
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="dev-licenses-screen">
      <Header title="التراخيص" subtitle={`${q.data?.length ?? 0} ترخيص`} right={<IconBtn testID="add-license-button" icon="add" tone="brand" onPress={() => setForm({ org_name: "", days: "365", max_employees: "10" })} />} />
      {q.isLoading ? <Loading /> : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty icon="key-outline" text="لا توجد تراخيص. أنشئ ترخيصاً لمؤسسة جديدة." />}
          renderItem={({ item }) => (
            <Row testID={`license-row-${item.id}`} icon="key-outline" title={item.code} subtitle={`${item.org_name} · ${item.days} يوم · ${item.max_employees} موظف${item.used_by ? " · " + item.used_by : ""}`}
              right={
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Badge text={item.status === "READY" ? "جاهز" : "مفعّل"} tone={item.status === "READY" ? "brand" : "success"} />
                  {item.status === "READY" && <IconBtn testID={`delete-license-${item.id}`} icon="trash-outline" onPress={() => del.mutate(item)} />}
                </View>
              } />
          )}
        />
      )}
      <Sheet testID="license-form-sheet" visible={!!form} onClose={() => setForm(null)} title="ترخيص جديد" footer={<Btn testID="save-license-button" title="إنشاء الترخيص" icon="key-outline" onPress={submit} loading={create.isPending} />}>
        {form && (
          <>
            <Field testID="license-org-input" label="اسم المؤسسة" value={form.org_name} onChangeText={(v) => setForm({ ...form, org_name: v })} />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field testID="license-days-input" label="المدة (أيام)" keyboardType="number-pad" value={form.days} onChangeText={(v) => setForm({ ...form, days: v })} /></View>
              <View style={{ flex: 1 }}><Field testID="license-max-input" label="أقصى عدد موظفين" keyboardType="number-pad" value={form.max_employees} onChangeText={(v) => setForm({ ...form, max_employees: v })} /></View>
            </View>
          </>
        )}
      </Sheet>
    </View>
  );
}

export function DevOrgs() {
  const { colors } = useTheme();
  const bottom = useBottomChrome();
  const q = useApi<any[]>("/dev/orgs");
  const [sel, setSel] = useState<any>(null);
  const patch = useMutate<any>("PATCH", (b) => `/dev/orgs/${b.id}`, "تم تحديث المؤسسة", () => setSel(null));
  const expired = (o: any) => new Date(o.expires_at) < new Date();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="dev-orgs-screen">
      <Header title="المؤسسات" subtitle={`${q.data?.length ?? 0} مؤسسة`} />
      {q.isLoading ? <Loading /> : (
        <FlatList
          data={q.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={<Empty icon="business-outline" text="لا توجد مؤسسات بعد" />}
          renderItem={({ item }) => (
            <Row testID={`org-row-${item.id}`} icon="business-outline" title={item.name} subtitle={`${item.owner_email} · ${item.employees} موظف · حتى ${fmtDate(item.expires_at)}`} onPress={() => setSel(item)}
              right={<Badge text={item.status !== "ACTIVE" ? "موقوف" : expired(item) ? "منتهي" : item.plan === "TRIAL" ? "تجريبي" : "فعّال"} tone={item.status !== "ACTIVE" || expired(item) ? "error" : item.plan === "TRIAL" ? "warning" : "success"} />} />
          )}
        />
      )}
      <Sheet testID="org-manage-sheet" visible={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && (
          <>
            <Card style={{ gap: spacing.xs }}>
              <T v="label">{sel.owner_email}</T>
              <T v="caption">ينتهي: {fmtDate(sel.expires_at)} · الحد: {sel.max_employees} موظفين</T>
            </Card>
            <Btn testID="extend-30-button" title="تمديد 30 يوماً" icon="time-outline" onPress={() => patch.mutate({ id: sel.id, extend_days: 30 })} loading={patch.isPending} />
            <Btn testID="extend-365-button" variant="secondary" title="تمديد سنة" icon="calendar-outline" onPress={() => patch.mutate({ id: sel.id, extend_days: 365 })} />
            {sel.status === "ACTIVE" ? (
              <Btn testID="suspend-org-button" variant="danger" title="إيقاف المؤسسة" icon="pause-circle-outline" onPress={() => patch.mutate({ id: sel.id, status: "SUSPENDED" })} />
            ) : (
              <Btn testID="activate-org-button" variant="secondary" title="إعادة التفعيل" icon="play-circle-outline" onPress={() => patch.mutate({ id: sel.id, status: "ACTIVE" })} />
            )}
          </>
        )}
      </Sheet>
    </View>
  );
}
