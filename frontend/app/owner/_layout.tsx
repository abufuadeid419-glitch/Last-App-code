import { RoleTabs } from "@/src/RoleTabs";

export default function OwnerLayout() {
  return (
    <RoleTabs
      tourKey="owner"
      tabs={[
        { name: "index", title: "الرئيسية", icon: "home-outline", sf: "house.fill", desc: "ملخص المبيعات والأرباح والتحصيلات والديون، مع التنبيهات ولوحة صدارة الموزعين الشهرية." },
        { name: "products", title: "المخزون", icon: "cube-outline", sf: "shippingbox.fill", desc: "أضف المنتجات، سجّل المشتريات ومرتجعاتها، وتابع حركة المخزون وتاريخ الأسعار." },
        { name: "customers", title: "العملاء", icon: "people-outline", sf: "person.2.fill", desc: "إدارة العملاء وفئات الأسعار، كشوف الحساب بصيغة PDF، وتسجيل التحصيلات." },
        { name: "more", title: "الإدارة", icon: "briefcase-outline", sf: "briefcase.fill", desc: "الموظفون، تسليم البضاعة، خطوط السير، تتبع الموزعين على خرائط Google، وملف المؤسسة." },
      ]}
    />
  );
}
