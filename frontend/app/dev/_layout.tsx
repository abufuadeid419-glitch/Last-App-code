import { RoleTabs } from "@/src/RoleTabs";

export default function DevLayout() {
  return (
    <RoleTabs
      tourKey="dev"
      tabs={[
        { name: "index", title: "الرئيسية", icon: "speedometer-outline", sf: "gauge", desc: "إحصاءات المنصة ومراقبة نشاط المؤسسات." },
        { name: "licenses", title: "التراخيص", icon: "key-outline", sf: "key.fill", desc: "أنشئ رموز تراخيص للمؤسسات الجديدة واحذف غير المستخدم منها." },
        { name: "orgs", title: "المؤسسات", icon: "business-outline", sf: "building.2.fill", desc: "مدّد اشتراك المؤسسات أو أوقفها أو أعد تفعيلها." },
        { name: "billing", title: "الاشتراكات", icon: "card-outline", sf: "creditcard.fill", desc: "الخطط وإعدادات الدفع وطلبات الترقية والإصدارات." },
      ]}
    />
  );
}
