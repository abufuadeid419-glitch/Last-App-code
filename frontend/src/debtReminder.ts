import { api, money } from "@/src/api";
import { openWhatsApp } from "@/src/components/DocActions";
import { useApi } from "@/src/hooks";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/ui";

export const STALE_MS = 7 * 86400000;
export const isStale = (c: any) => !c.last_reminder_at || Date.now() - new Date(c.last_reminder_at).getTime() > STALE_MS;

// One-tap WhatsApp debt reminder; records the reminder time on the customer.
export function useDebtReminder() {
  const toast = useToast();
  const org = useApi<any>("/org/profile");
  return (c: any) => {
    if (!c.phone) return toast("لا يوجد رقم هاتف لهذا العميل", "error");
    const o = org.data;
    const text = [
      `السلام عليكم ${c.name}،`,
      "",
      `نود تذكيركم بأن رصيدكم المستحق لدى ${o?.name ?? ""} هو:`,
      `*${money(c.balance)} ${o?.currency ?? ""}*`,
      "",
      "نرجو التكرم بتسديد المبلغ في أقرب وقت ممكن.",
      ...(o?.phone ? [`للاستفسار: ${o.phone}`] : []),
      "",
      "شكراً لتعاملكم معنا.",
    ].join("\n");
    openWhatsApp(c.phone, text, o?.phone_country_code)
      .then(() => api(`/customers/${c.id}/reminded`, { method: "POST" }))
      .then(() => Promise.all([queryClient.invalidateQueries({ queryKey: ["/customers"] }), queryClient.invalidateQueries({ queryKey: ["/debts/stale"] })]))
      .catch(() => toast("تعذر فتح واتساب", "error"));
  };
}
