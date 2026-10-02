import { RoleTabs } from "@/src/RoleTabs";

export default function OwnerLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "الرئيسية", icon: "home-outline", sf: "house.fill" },
        { name: "products", title: "المخزون", icon: "cube-outline", sf: "shippingbox.fill" },
        { name: "customers", title: "العملاء", icon: "people-outline", sf: "person.2.fill" },
        { name: "more", title: "الإدارة", icon: "briefcase-outline", sf: "briefcase.fill" },
      ]}
    />
  );
}
