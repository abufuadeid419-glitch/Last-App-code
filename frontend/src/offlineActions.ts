// Write actions that work offline: applied to the local cache immediately,
// then queued and synced to the server (idempotent by client-generated id).
import { getLastCoords } from "@/src/location";
import { enqueue, uid, updateCached } from "@/src/offline";

const r2 = (n: number) => Math.round(n * 100) / 100;
const tempNo = (prefix: string, id: string) => `${prefix}-مؤقت-${id.slice(-4).toUpperCase()}`;

const geo = () => {
  const c = getLastCoords();
  return { lat: c?.lat ?? null, lng: c?.lng ?? null, client_created_at: new Date().toISOString() };
};

type Line = { product_id: string; product_name: string; quantity: number; price: number };

export async function offlineSale(p: { customer: any; lines: Line[]; paid: number | null; notes: string; userName?: string }) {
  const id = uid();
  const items = p.lines.map((l) => ({ ...l, total: r2(l.quantity * l.price) }));
  const total = r2(items.reduce((s, i) => s + i.total, 0));
  const paid = Math.min(p.paid ?? total, total);
  const remaining = r2(total - paid);
  const body = { id, customer_id: p.customer.id, items: items.map(({ product_id, quantity, price }) => ({ product_id, quantity, price })), paid_amount: paid, notes: p.notes, ...geo() };
  const doc = {
    id, pending: true, invoice_no: tempNo("INV", id), customer_id: p.customer.id, customer_name: p.customer.name,
    distributor_name: p.userName, items, total, paid_amount: paid, remaining,
    payment_type: paid >= total ? "CASH" : "CREDIT", notes: p.notes, created_at: new Date().toISOString(),
  };
  await updateCached<any[]>("/my/inventory", (inv) =>
    inv.map((i) => {
      const l = p.lines.find((x) => x.product_id === i.product_id);
      return l ? { ...i, quantity: r2(i.quantity - l.quantity) } : i;
    }),
  );
  await updateCached<any[]>("/customers", (cs) => cs.map((c) => (c.id === p.customer.id ? { ...c, balance: r2(c.balance + remaining) } : c)));
  await updateCached<any[]>("/sales", (s) => [doc, ...s]);
  await enqueue({ id, path: "/sales", body, label: `فاتورة · ${p.customer.name} · ${total}` });
  return doc;
}

export async function offlineCollection(p: { customer: any; amount: number; notes: string; userName?: string }) {
  const id = uid();
  const body = { id, customer_id: p.customer.id, amount: p.amount, notes: p.notes, ...geo() };
  const doc = { id, pending: true, receipt_no: tempNo("RCV", id), customer_id: p.customer.id, customer_name: p.customer.name, amount: p.amount, notes: p.notes, collector_name: p.userName, created_at: new Date().toISOString() };
  await updateCached<any[]>("/customers", (cs) => cs.map((c) => (c.id === p.customer.id ? { ...c, balance: r2(c.balance - p.amount) } : c)));
  await updateCached<any[]>("/collections", (s) => [doc, ...s]);
  await enqueue({ id, path: "/collections", body, label: `تحصيل · ${p.customer.name} · ${p.amount}` });
  return doc;
}

export async function offlineReturn(p: { customer: any; line: Line; reason: string; userName?: string }) {
  const id = uid();
  const total = r2(p.line.quantity * p.line.price);
  const body = { id, customer_id: p.customer.id, items: [{ product_id: p.line.product_id, quantity: p.line.quantity, price: p.line.price }], reason: p.reason, ...geo() };
  const doc = { id, pending: true, return_no: tempNo("RET", id), customer_id: p.customer.id, customer_name: p.customer.name, distributor_name: p.userName, items: [{ ...p.line, total }], total, reason: p.reason, created_at: new Date().toISOString() };
  await updateCached<any[]>("/my/inventory", (inv) => {
    const found = inv.find((i) => i.product_id === p.line.product_id);
    if (found) return inv.map((i) => (i.product_id === p.line.product_id ? { ...i, quantity: r2(i.quantity + p.line.quantity) } : i));
    return [...inv, { product_id: p.line.product_id, product_name: p.line.product_name, quantity: p.line.quantity, sale_price: p.line.price }];
  });
  await updateCached<any[]>("/customers", (cs) => cs.map((c) => (c.id === p.customer.id ? { ...c, balance: r2(c.balance - total) } : c)));
  await updateCached<any[]>("/sales-returns", (s) => [doc, ...s]);
  await enqueue({ id, path: "/sales-returns", body, label: `مرتجع · ${p.customer.name} · ${total}` });
  return doc;
}

export async function offlineCustomer(p: { name: string; phone: string; address: string; type_id?: string | null; lat?: number | null; lng?: number | null }) {
  const id = uid();
  const doc = { id, pending: true, ...p, location: "", balance: 0, created_at: new Date().toISOString() };
  await updateCached<any[]>("/customers", (cs) => [...cs, doc]);
  await enqueue({ id, path: "/customers", body: { id, ...p }, label: `عميل جديد · ${p.name}` });
  return doc;
}

export async function offlineStopStatus(route: any, stop: any, status: "VISITED" | "SKIPPED" | "PENDING") {
  const id = uid();
  await updateCached<any>("/routes/mine", (r) =>
    r && r.id === route.id ? { ...r, stops: r.stops.map((s: any) => (s.customer_id === stop.customer_id ? { ...s, status, at: new Date().toISOString() } : s)) } : r,
  );
  await enqueue({ id, path: `/routes/${route.id}/stops/${stop.customer_id}/status`, body: { status }, label: `خط السير · ${stop.customer_name}` });
}

export async function offlineStockRequest(items: { product_id: string; product_name: string; quantity: number }[], note = "") {
  const id = uid();
  const doc = { id, pending: true, items, note, status: "PENDING", created_at: new Date().toISOString() };
  await updateCached<any[]>("/stock-requests", (l) => [doc, ...l]);
  await enqueue({ id, path: "/stock-requests", body: { id, items: items.map(({ product_id, quantity }) => ({ product_id, quantity })), note }, label: `طلب تعبئة · ${items.length} صنف` });
  return doc;
}
