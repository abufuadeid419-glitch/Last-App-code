let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setToken = (t: string | null) => {
  token = t;
};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api${path}`, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("تعذر الاتصال بالخادم، تحقق من الإنترنت");
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token) onUnauthorized?.();
  if (!res.ok) {
    const d = data?.detail;
    throw new Error(typeof d === "string" ? d : "حدث خطأ غير متوقع");
  }
  return data as T;
}

export const money = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const roleLabel = (u: any) => {
  if (!u?.role) return "غير مفعل";
  if (u.role === "DEVELOPER") return "المطور";
  if (u.role === "OWNER") return "مالك المؤسسة";
  return u.employee_type === "ACCOUNTANT" ? "محاسب" : "موزع ميداني";
};
