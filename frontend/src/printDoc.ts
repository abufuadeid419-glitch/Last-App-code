import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { RECEIPT_MM, ReceiptDoc } from "@/src/receipts";

// expo-print sizes are in points (1/72 inch): 80mm wide, estimated height -> one continuous strip.
const PT_PER_MM = 72 / 25.4;
const size = (d: ReceiptDoc) => ({ width: Math.round(RECEIPT_MM * PT_PER_MM), height: Math.round(d.heightMm * PT_PER_MM) });

export async function printReceipt(d: ReceiptDoc) {
  await Print.printAsync({ html: d.html, ...size(d) });
}

export async function shareReceipt(d: ReceiptDoc, title: string) {
  const { uri } = await Print.printToFileAsync({ html: d.html, ...size(d), margins: { left: 0, right: 0, top: 0, bottom: 0 } });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
}
