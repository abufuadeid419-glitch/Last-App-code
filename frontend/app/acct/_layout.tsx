import { RoleTabs } from "@/src/RoleTabs";

export default function AccountantLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "الرئيسية", icon: "home-outline", sf: "house.fill" },
        { name: "sales", title: "الفواتير", icon: "receipt-outline", sf: "doc.text.fill" },
        { name: "collections", title: "التحصيلات", icon: "wallet-outline", sf: "banknote.fill" },
        { name: "debts", title: "الديون", icon: "alert-circle-outline", sf: "exclamationmark.circle.fill" },
        { name: "customers", title: "العملاء", icon: "people-outline", sf: "person.2.fill" },
      ]}
    />
  );
}
