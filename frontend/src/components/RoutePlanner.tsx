import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";

import { api } from "@/src/api";
import { directionsUrl, stopBadge } from "@/src/components/MyRoute";
import { RouteMap } from "@/src/components/RouteMap";
import { useApi } from "@/src/hooks";
import { queryClient } from "@/src/query-client";
import { radius, spacing, useTheme } from "@/src/theme";
import { Badge, Btn, Card, Empty, IconBtn, Segments, Select, T, useToast } from "@/src/ui";

const AR_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Owner: plan a distributor's customer visits for a date, order by hand or by nearest.
export function RoutePlanner({ agents }: { agents: any[] }) {
  const { colors } = useTheme();
  const toast = useToast();
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return { key: iso(d), label: i === 0 ? "اليوم" : i === 1 ? "غداً" : `${AR_DAYS[d.getDay()]} ${d.getDate()}` };
      }),
    [],
  );
  const [date, setDate] = useState(days[0].key);
  const [agent, setAgent] = useState<any>(agents[0] ?? null);
  const customers = useApi<any[]>("/customers");
  const path = `/routes?date=${date}&distributor_id=${agent?.user_id ?? ""}`;
  const routes = useApi<any[]>(path, !!agent);
  const route = routes.data?.[0];
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<"save" | "opt" | "del" | null>(null);

  useEffect(() => {
    setIds(route ? route.stops.map((s: any) => s.customer_id) : []);
  }, [route]);

  const byId = useMemo(() => Object.fromEntries((customers.data ?? []).map((c) => [c.id, c])), [customers.data]);
  const statusOf = (cid: string) => route?.stops.find((s: any) => s.customer_id === cid)?.status ?? "PENDING";
  const stops = ids.filter((id) => byId[id]).map((id) => ({ ...byId[id], customer_id: id, customer_name: byId[id].name, status: statusOf(id) }));

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const n = [...ids];
    [n[i], n[j]] = [n[j], n[i]];
    setIds(n);
  };

  const save = async () => {
    const r = await api("/routes", { method: "POST", body: { distributor_id: agent.user_id, date, customer_ids: ids } });
    queryClient.setQueryData([path], [r]);
    return r;
  };
  const run = async (kind: "save" | "opt" | "del") => {
    if (kind !== "del" && !ids.length) return toast("أضف عملاء للمسار أولاً", "error");
    setBusy(kind);
    try {
      if (kind === "save") {
        await save();
        toast("تم حفظ خط السير");
      } else if (kind === "opt") {
        const r = await save();
        const o = await api(`/routes/${r.id}/optimize`, { method: "POST", body: {} });
        queryClient.setQueryData([path], [o]);
        toast(o.unlocated ? `تم الترتيب · ${o.unlocated} عميل بلا موقع وُضع في النهاية` : "تم ترتيب المسار حسب الأقرب");
      } else if (route) {
        await api(`/routes/${route.id}`, { method: "DELETE" });
        queryClient.setQueryData([path], []);
        toast("تم حذف خط السير");
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (!agents.length) return <Empty icon="car-outline" text="أضف موزعاً ميدانياً أولاً" />;

  return (
    <View style={{ gap: spacing.lg }} testID="route-planner">
      <Select testID="route-agent-select" label="الموزع" placeholder="اختر الموزع" value={agent?.name ?? agent?.email ?? null} options={agents} getLabel={(a: any) => a.name ?? a.email} onSelect={setAgent} />
      <View style={{ marginHorizontal: -spacing.lg }}>
        <Segments value={date} onChange={setDate} options={days} />
      </View>
      <RouteMap stops={stops} />
      {stops.length === 0 ? (
        <Empty icon="map-outline" text="لا توجد زيارات مخططة لهذا اليوم" />
      ) : (
        stops.map((s, i) => (
          <Card key={s.customer_id} testID={`plan-stop-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}>
            <View style={{ width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }}>
              <T v="caption" color="onBrandPrimary">{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="label" numberOfLines={1}>{s.customer_name}</T>
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                <Badge text={stopBadge[s.status].t} tone={stopBadge[s.status].tone} />
                {s.lat == null && <Badge text="بلا موقع" tone="warning" />}
              </View>
            </View>
            <IconBtn testID={`plan-stop-up-${i}`} icon="chevron-up" onPress={() => move(i, -1)} />
            <IconBtn testID={`plan-stop-down-${i}`} icon="chevron-down" onPress={() => move(i, 1)} />
            <IconBtn testID={`plan-stop-remove-${i}`} icon="trash-outline" onPress={() => setIds(ids.filter((x) => x !== s.customer_id))} />
            {s.lat != null && <IconBtn testID={`plan-stop-map-${i}`} icon="navigate-outline" onPress={() => Linking.openURL(directionsUrl(s))} />}
          </Card>
        ))
      )}
      <Select
        testID="route-add-customer-select"
        label="إضافة زيارة"
        placeholder="+ اختر عميلاً"
        value={null}
        options={(customers.data ?? []).filter((c) => !ids.includes(c.id) && !c.pending)}
        getLabel={(c: any) => c.name}
        getSub={(c: any) => [c.address, c.lat != null ? "له موقع محفوظ" : "بلا موقع"].filter(Boolean).join(" · ")}
        onSelect={(c: any) => setIds([...ids, c.id])}
      />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Btn testID="save-route-button" style={{ flex: 1 }} title="حفظ خط السير" icon="checkmark" loading={busy === "save"} onPress={() => run("save")} />
        <Btn testID="optimize-route-button" style={{ flex: 1 }} variant="secondary" title="ترتيب حسب الأقرب" icon="git-network-outline" loading={busy === "opt"} onPress={() => run("opt")} />
      </View>
      {route && <Btn testID="delete-route-button" variant="ghost" title="حذف خط السير" loading={busy === "del"} onPress={() => run("del")} />}
    </View>
  );
}
