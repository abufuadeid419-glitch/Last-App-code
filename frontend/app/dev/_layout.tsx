import { RoleTabs } from "@/src/RoleTabs";

export default function DevLayout() {
  return (
    <RoleTabs
      tabs={[
        { name: "index", title: "الرئيسية", icon: "speedometer-outline", sf: "gauge" },
        { name: "licenses", title: "التراخيص", icon: "key-outline", sf: "key.fill" },
        { name: "orgs", title: "المؤسسات", icon: "business-outline", sf: "building.2.fill" },
      ]}
    />
  );
}
