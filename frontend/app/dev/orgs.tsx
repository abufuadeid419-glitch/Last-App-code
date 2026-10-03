import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { fmtDate } from "@/src/api";
import { useApi, useBottomChrome, useMutate } from "@/src/hooks";
import { DevOrgs } from "@/src/screens/Dev";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, Field, Header, IconBtn, Loading, Segments, Sheet, T, useToast } from "@/src/ui";

function DeletionRequests() {
  const q = useApi<any[]>("/deletion-requests");
  const review = useMutate<any>("PATCH", (b) => `/dev/deletion-requests/${b.id}`, "تمت معالجة الطلب");
  if (q.isLoading) return <Loading />;
  if (!q.data?.length) return <Empty icon="trash-outline" text="لا توجد طلبات حذف" />;
  return (
    <>
      {q.data.map((r) => (
        <Card key={r.id} testID={`deletion-request-${r.id}`} style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <T v="label" style={{ flex: 1 }}>{r.org_name}</T>
            <Badge text={r.status === "PENDING" ? "قيد المراجعة" : r.status === "APPROVED" ? "تم الحذف" : "مرفوض"} tone={r.status === "PENDING" ? "warning" : r.status === "APPROVED" ? "error" : "success"} />
          </View>
          <T v="caption">{r.owner_email} · {fmtDate(r.created_at)}</T>
          {!!r.reason && <T>{r.reason}</T>}
          {r.status === "PENDING" && (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Btn testID={`approve-deletion-${r.id}`} small variant="danger" style={{ flex: 1 }} title="حذف نهائي" icon="trash" onPress={() => review.mutate({ id: r.id, action: "approve" })} />
              <Btn testID={`reject-deletion-${r.id}`} small variant="secondary" style={{ flex: 1 }} title="رفض" onPress={() => review.mutate({ id: r.id, action: "reject" })} />
            </View>
          )}
        </Card>
      ))}
    </>
  );
}

function Versions() {
  const toast = useToast();
  const q = useApi<any[]>("/dev/versions");
  const [form, setForm] = useState<any>(null);
  const create = useMutate("POST", "/dev/versions", "تم نشر الإصدار", () => setForm(null));
  const del = useMutate<any>("DELETE", (b) => `/dev/versions/${b.id}`, "تم حذف الإصدار");
  return (
    <>
      <Btn testID="add-version-button" icon="add" title="إصدار جديد" onPress={() => setForm({ platform: "all", version: "", force_update: false, release_notes: "", store_url: "" })} />
      {!q.data?.length ? <Empty icon="git-branch-outline" text="لا توجد إصدارات منشورة" /> : q.data.map((v) => (
        <Card key={v.id} testID={`version-row-${v.id}`} style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <T v="h2" style={{ flex: 1 }}>{v.version}</T>
            <Badge text={v.platform === "all" ? "الكل" : v.platform} />
            {v.force_update && <Badge text="إلزامي" tone="error" />}
            <IconBtn testID={`delete-version-${v.id}`} icon="trash-outline" onPress={() => del.mutate(v)} />
          </View>
          {!!v.release_notes && <T v="caption">{v.release_notes}</T>}
          <T v="caption">{fmtDate(v.created_at)}</T>
        </Card>
      ))}
      <Sheet testID="version-form-sheet" visible={!!form} onClose={() => setForm(null)} title="نشر إصدار" footer={<Btn testID="save-version-button" title="نشر" icon="cloud-upload-outline" loading={create.isPending} onPress={() => (/^\d+(\.\d+)*$/.test(form.version) ? create.mutate(form) : toast("رقم الإصدار غير صالح (مثال 1.2.0)", "error"))} />}>
        {form && (
          <>
            <Field testID="version-number-input" label="رقم الإصدار" placeholder="1.1.0" value={form.version} onChangeText={(v) => setForm({ ...form, version: v })} />
            <View style={{ marginHorizontal: -spacing.lg }}>
              <Segments value={form.platform} onChange={(v) => setForm({ ...form, platform: v })} options={[{ key: "all", label: "الكل" }, { key: "android", label: "Android" }, { key: "ios", label: "iOS" }]} />
            </View>
            <Field testID="version-notes-input" label="ملاحظات الإصدار" multiline value={form.release_notes} onChangeText={(v) => setForm({ ...form, release_notes: v })} />
            <Field testID="version-store-url-input" label="رابط المتجر" autoCapitalize="none" value={form.store_url} onChangeText={(v) => setForm({ ...form, store_url: v })} />
            <Btn testID="toggle-force-update" small variant="secondary" icon={form.force_update ? "lock-closed-outline" : "lock-open-outline"} title={form.force_update ? "تحديث إلزامي · إلغاء" : "تحديث اختياري · جعله إلزامياً"} onPress={() => setForm({ ...form, force_update: !form.force_update })} />
          </>
        )}
      </Sheet>
    </>
  );
}

export default function DevOrgsTab() {
  const { colors } = useTheme();
  const bottom = useBottomChrome();
  const [tab, setTab] = useState<"orgs" | "deletion" | "versions">("orgs");
  if (tab === "orgs")
    return (
      <View style={{ flex: 1 }}>
        <DevOrgs header={<Segments value={tab} onChange={setTab} options={[{ key: "orgs", label: "المؤسسات" }, { key: "deletion", label: "طلبات الحذف" }, { key: "versions", label: "الإصدارات" }]} />} />
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title={tab === "deletion" ? "طلبات حذف المؤسسات" : "إدارة الإصدارات"} />
      <Segments value={tab} onChange={setTab} options={[{ key: "orgs", label: "المؤسسات" }, { key: "deletion", label: "طلبات الحذف" }, { key: "versions", label: "الإصدارات" }]} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottom + spacing.xl }} refreshControl={<RefreshControl refreshing={false} onRefresh={() => {}} tintColor={colors.brandPrimary} />}>
        {tab === "deletion" ? <DeletionRequests /> : <Versions />}
      </ScrollView>
    </View>
  );
}
