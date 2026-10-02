import { useEffect, useState } from "react";

import { money } from "@/src/api";
import { useAuth } from "@/src/auth";
import { offlineCollection } from "@/src/offlineActions";
import { Btn, Card, Field, Sheet, T, useToast } from "@/src/ui";

export function CollectSheet({ customer, onClose }: { customer: any | null; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (customer) {
      setAmount(String(customer.balance));
      setNotes("");
    }
  }, [customer]);
  const submit = async () => {
    if (!(+amount > 0)) return toast("أدخل مبلغاً صحيحاً", "error");
    if (+amount > customer.balance + 0.001) return toast("المبلغ أكبر من دين العميل", "error");
    setSaving(true);
    try {
      await offlineCollection({ customer, amount: +amount, notes, userName: user?.name });
      toast("تم تسجيل التحصيل");
      onClose();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet
      testID="collect-sheet"
      visible={!!customer}
      onClose={onClose}
      title="تحصيل دفعة"
      footer={<Btn testID="confirm-collection-button" title="تأكيد التحصيل" icon="cash-outline" onPress={submit} loading={saving} />}
    >
      {customer && (
        <>
          <Card>
            <T v="h2">{customer.name}</T>
            <T color="warning">الدين الحالي: {money(customer.balance)}</T>
          </Card>
          <Field testID="collection-amount-input" label="المبلغ المحصّل" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <Field testID="collection-notes-input" label="ملاحظات" value={notes} onChangeText={setNotes} />
        </>
      )}
    </Sheet>
  );
}
