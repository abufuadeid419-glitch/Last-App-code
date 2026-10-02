import { useEffect, useState } from "react";

import { money } from "@/src/api";
import { useMutate } from "@/src/hooks";
import { Btn, Card, Field, Sheet, T, useToast } from "@/src/ui";

export function CollectSheet({ customer, onClose }: { customer: any | null; onClose: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (customer) {
      setAmount(String(customer.balance));
      setNotes("");
    }
  }, [customer]);
  const m = useMutate("POST", "/collections", "تم تسجيل التحصيل", onClose);
  const submit = () => {
    if (!(+amount > 0)) return toast("أدخل مبلغاً صحيحاً", "error");
    m.mutate({ customer_id: customer.id, amount: +amount, notes });
  };
  return (
    <Sheet
      testID="collect-sheet"
      visible={!!customer}
      onClose={onClose}
      title="تحصيل دفعة"
      footer={<Btn testID="confirm-collection-button" title="تأكيد التحصيل" icon="cash-outline" onPress={submit} loading={m.isPending} />}
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
