import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { ReceiptView } from "@/src/components/ReceiptView";
import type { Op } from "@/src/receipts";

type Job = { ops: Op[]; resolve: (b64: string) => void; reject: (e: any) => void };
let request: ((ops: Op[]) => Promise<string>) | null = null;

// Renders receipt ops off-screen and returns a 576px-wide PNG (base64) for Bluetooth printing.
export const captureReceipt = (ops: Op[]) => (request ? request(ops) : Promise.reject(new Error("تعذر تجهيز الإيصال للطباعة")));

export function BtPrintHost() {
  const [job, setJob] = useState<Job | null>(null);
  const ref = useRef<View>(null);

  useEffect(() => {
    request = (ops) => new Promise<string>((resolve, reject) => setJob({ ops, resolve, reject }));
    return () => {
      request = null;
    };
  }, []);

  useEffect(() => {
    if (!job) return;
    const hasLogo = job.ops.some((o) => o.t === "logo");
    const t = setTimeout(async () => {
      try {
        job.resolve(await captureRef(ref, { format: "png", result: "base64", width: 576 }));
      } catch (e) {
        job.reject(e);
      } finally {
        setJob(null);
      }
    }, hasLogo ? 700 : 300);
    return () => clearTimeout(t);
  }, [job]);

  if (!job) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: -3000 }}>
      <View ref={ref} collapsable={false}>
        <ReceiptView ops={job.ops} />
      </View>
    </View>
  );
}
