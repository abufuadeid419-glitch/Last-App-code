import { RoleTabs } from "@/src/RoleTabs";

export default function AccountantLayout() {
  return (
    <RoleTabs
      tourKey="acct"
      tabs={[
        { name: "index", title: "الرئيسية", icon: "home-outline", sf: "house.fill", desc: "نظرة مالية شاملة مع تنبيهات المخاطر، التقارير، ولوحة صدارة الموزعين." },
        { name: "sales", title: "الفواتير", icon: "receipt-outline", sf: "doc.text.fill", desc: "المبيعات والمرتجعات والمشتريات ومرتجعاتها، مع البحث والتصفية بالتاريخ." },
        { name: "collections", title: "التحصيلات", icon: "wallet-outline", sf: "banknote.fill", desc: "جميع سندات القبض مع الإجمالي وعدد العمليات." },
        { name: "debts", title: "الديون", icon: "alert-circle-outline", sf: "exclamationmark.circle.fill", desc: "العملاء المدينون وتسجيل التحصيل منهم مباشرة." },
        { name: "customers", title: "العملاء", icon: "people-outline", sf: "person.2.fill", desc: "كشوف حساب العملاء ومشاركتها PDF أو عبر واتساب." },
      ]}
    />
  );
}
