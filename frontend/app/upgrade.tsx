import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fmtDate, money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useApi, useMutate } from "@/src/hooks";
import { spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, Field, Header, IconBtn, Ionicons, Loading, Section, Segments, Sheet, T, useToast } from "@/src/ui";

const statusMap: Record<string, { t: string; tone: "warning" | "success" | "error" }> = {
  PENDING: { t: "قيد المراجعة", tone: "warning" },
  APPROVED: { t: "تمت الموافقة", tone: "success" },
  REJECTED: { t: "مرفوض", tone: "error" },
};

export default function Upgrade() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const plans = useApi<any[]>("/plans");
  const pay = useApi<any>("/settings/payment");
  const reqs = useApi<any[]>("/upgrade-requests");
  const [sel, setSel] = useState<any>(null);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const hasYearly = plans.data?.some((p) => p.yearly_price);
  const priceOf = (p: any) => (billing === "yearly" && p?.yearly_price ? p.yearly_price : p?.price);
  const savePct = (p: any) => (p.yearly_price && p.price ? Math.round((1 - p.yearly_price / (p.price * (365 / p.days))) * 100) : 0);
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const submit = useMutate("POST", "/upgrade-requests", "تم إرسال طلب الترقية، سيتم مراجعته قريباً", () => {
    setSel(null);
    setRef("");
    setNotes("");
  });
  const org = user?.org;
  const hasPending = reqs.data?.some((r) => r.status === "PENDING");

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="upgrade-screen">
      <Header title="ترقية الخطة" subtitle={org?.name} right={<IconBtn testID="upgrade-back-button" icon="arrow-forward" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={plans.isRefetching} onRefresh={() => { plans.refetch(); reqs.refetch(); refresh(); }} tintColor={colors.brandPrimary} />}
      >
        <Card testID="current-plan-card" style={{ gap: spacing.xs, backgroundColor: colors.brandTertiary, borderColor: colors.brandSecondary }}>
          <T v="caption">خطتك الحالية</T>
          <T v="h2">{org?.plan === "TRIAL" ? "تجربة مجانية" : org?.plan_name ?? "ترخيص"}</T>
          <T v="caption">حتى {org?.max_employees} موظفين · ينتهي {org ? fmtDate(org.expires_at) : ""}</T>
        </Card>

        <Section title="الخطط المتاحة">
          {hasYearly && (
            <View style={{ marginHorizontal: -spacing.lg }}>
              <Segments value={billing} onChange={setBilling} options={[{ key: "monthly", label: "شهري" }, { key: "yearly", label: "سنوي · وفّر أكثر" }]} />
            </View>
          )}
          {plans.isLoading ? (
            <Loading />
          ) : !plans.data?.length ? (
            <Empty icon="pricetags-outline" text="لا توجد خطط متاحة حالياً" />
          ) : (
            plans.data.map((p) => (
              <Card key={p.id} testID={`plan-card-${p.id}`} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <T v="h2" style={{ flex: 1 }}>{p.name}</T>
                  <T v="title" color="brandPrimary">{money(billing === "yearly" && p.yearly_price ? p.yearly_price : p.price)} <T v="caption">{p.currency}{billing === "yearly" && p.yearly_price ? " / سنة" : ""}</T></T>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  {billing === "yearly" && !p.yearly_price && <Badge text="شهري فقط" tone="warning" />}
                  {savePct(p) > 0 && <Badge testID={`save-badge-${p.id}`} text={`وفّر ${savePct(p)}% بالدفع السنوي`} tone="success" />}
                </View>
                <T v="caption">{p.days} يوماً · حتى {p.max_employees} موظفين</T>
                {p.features?.map((f: string, i: number) => (
                  <View key={i} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                    <T>{f}</T>
                  </View>
                ))}
                <Btn testID={`choose-plan-${p.id}`} title="اختيار هذه الخطة" disabled={hasPending || (billing === "yearly" && !p.yearly_price)} onPress={() => setSel(p)} />
              </Card>
            ))
          )}
          {hasPending && <T v="caption" color="warning" style={{ textAlign: "center" }}>لديك طلب قيد المراجعة</T>}
        </Section>

        <Section title="طلباتي">
          {!reqs.data?.length ? (
            <Empty icon="document-outline" text="لا توجد طلبات" />
          ) : (
            reqs.data.map((r) => (
              <Card key={r.id} testID={`my-request-${r.id}`} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <T v="label" style={{ flex: 1 }}>{r.plan_name} · {money(r.price)} {r.currency}</T>
                  <Badge text={statusMap[r.status].t} tone={statusMap[r.status].tone} />
                </View>
                <T v="caption">مرجع الدفع: {r.payment_ref} · {fmtDate(r.created_at)}</T>
                {!!r.review_note && <T v="caption">{r.review_note}</T>}
              </Card>
            ))
          )}
        </Section>
      </ScrollView>

      <Sheet
        testID="upgrade-request-sheet"
        visible={!!sel}
        onClose={() => setSel(null)}
        title={`الدفع · ${sel?.name ?? ""}`}
        footer={<Btn testID="submit-upgrade-button" title="إرسال طلب الترقية" icon="send-outline" loading={submit.isPending} onPress={() => (ref.trim() ? submit.mutate({ plan_id: sel.id, payment_ref: ref, notes, billing: billing === "yearly" && sel.yearly_price ? "yearly" : "monthly" }) : toast("أدخل مرجع عملية الدفع", "error"))} />}
      >
        <Card style={{ gap: spacing.sm }}>
          <T v="label" testID="upgrade-amount">المبلغ المطلوب: {money(priceOf(sel))} {sel?.currency} {billing === "yearly" && sel?.yearly_price ? "(اشتراك سنوي)" : ""}</T>
          {!!pay.data?.instructions && <T>{pay.data.instructions}</T>}
          {!!pay.data?.payment_address && (
            <View style={{ gap: 2 }}>
              <T v="caption">عنوان الدفع</T>
              <T v="label" selectable testID="payment-address-text">{pay.data.payment_address}</T>
            </View>
          )}
          {!!pay.data?.whatsapp && (
            <Btn testID="contact-whatsapp-button" small variant="secondary" icon="logo-whatsapp" title="تواصل عبر واتساب" onPress={() => Linking.openURL(`https://wa.me/${pay.data.whatsapp.replace(/[^\d]/g, "")}?text=${encodeURIComponent(`طلب ترقية ${sel?.name} - ${org?.name}`)}`)} />
          )}
        </Card>
        <Field testID="payment-ref-input" label="رقم / مرجع عملية الدفع" value={ref} onChangeText={setRef} />
        <Field testID="upgrade-notes-input" label="ملاحظات (اختياري)" value={notes} onChangeText={setNotes} />
      </Sheet>
    </View>
  );
}
