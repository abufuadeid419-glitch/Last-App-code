import { RECEIPT_MM, ReceiptDoc } from "@/src/receipts";

// Web: expo-print only calls window.print() on the app page, so print the receipt from a hidden
// iframe instead. The page height is measured after layout so the 80mm strip is never cut.
export async function printReceipt(d: ReceiptDoc) {
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.setAttribute("data-testid", "receipt-print-frame");
  Object.assign(f.style, { position: "fixed", left: "-10000px", top: "0", width: `${RECEIPT_MM}mm`, height: "100px", border: "0" });
  document.body.appendChild(f);
  const w = f.contentWindow!;
  const doc = w.document;
  doc.open();
  doc.write(d.html);
  doc.close();
  await new Promise<void>((resolve) => {
    const imgs = Array.from(doc.images).filter((i) => !i.complete);
    let left = imgs.length;
    if (!left) return resolve();
    const done = () => {
      left -= 1;
      if (left <= 0) resolve();
    };
    imgs.forEach((i) => {
      i.onload = done;
      i.onerror = done;
    });
    setTimeout(resolve, 2000);
  });
  const hMm = Math.ceil((doc.documentElement.scrollHeight * 25.4) / 96) + 2;
  const st = doc.createElement("style");
  st.textContent = `@page{size:${RECEIPT_MM}mm ${hMm}mm;margin:0}`;
  doc.head.appendChild(st);
  w.focus();
  w.print();
  setTimeout(() => f.remove(), 1000);
}

// Web has no share sheet: the print dialog offers "Save as PDF" at 80mm.
export const shareReceipt = (d: ReceiptDoc, _title: string) => printReceipt(d);
