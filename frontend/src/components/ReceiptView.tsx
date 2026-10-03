import { Image, Text, View } from "react-native";

import type { Op, TextCls } from "@/src/receipts";
import { fonts } from "@/src/theme";

// React Native rendering of receipt ops for Bluetooth image printing.
// 288dp wide = 72mm printable; captured at 576px (203dpi printers). Always black on white (paper).
export const RECEIPT_VIEW_WIDTH = 288;
const INK = "#000000";
const PAPER = "#FFFFFF";

const TEXT: Record<TextCls, { size: number; bold?: boolean }> = {
  h1: { size: 17, bold: true },
  sub: { size: 11 },
  title: { size: 15, bold: true },
  note: { size: 11.5 },
  foot: { size: 11.5, bold: true },
  tiny: { size: 10 },
  c: { size: 12 },
};

function Txt({ size, bold, align, children, ltr }: { size: number; bold?: boolean; align?: "center" | "left" | "right"; children: React.ReactNode; ltr?: boolean }) {
  return (
    <Text style={{ color: INK, fontSize: size, lineHeight: size * 1.5, fontFamily: bold ? fonts.bold : fonts.regular, textAlign: align, writingDirection: ltr ? "ltr" : "rtl" }}>
      {children}
    </Text>
  );
}

function Kv({ label, value, size = 12.5, ltr }: { label: string; value: string; size?: number; ltr?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <Txt size={size}>{label}</Txt>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Txt size={size} bold ltr={ltr} align="left">{value}</Txt>
      </View>
    </View>
  );
}

const Rule = ({ strong }: { strong?: boolean }) => <View style={{ borderTopWidth: strong ? 2 : 1, borderStyle: strong ? "solid" : "dashed", borderColor: INK, marginVertical: 7 }} />;

export function ReceiptView({ ops }: { ops: Op[] }) {
  return (
    <View style={{ width: RECEIPT_VIEW_WIDTH, backgroundColor: PAPER, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 18 }}>
      {ops.map((o, i) => {
        switch (o.t) {
          case "logo":
            return <Image key={i} source={{ uri: o.uri }} style={{ width: 150, height: 64, alignSelf: "center", marginBottom: 4 }} resizeMode="contain" />;
          case "text": {
            const m = TEXT[o.cls];
            const center = o.cls !== "note";
            return (
              <Txt key={i} size={m.size} bold={m.bold} align={center ? "center" : undefined}>
                {o.s}
                {o.ltr ? `\u2066${o.ltr}\u2069` : ""}
              </Txt>
            );
          }
          case "hr":
            return <Rule key={i} strong={o.strong} />;
          case "kv":
            return o.big ? (
              <View key={i} style={{ borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 4, marginVertical: 5 }}>
                <Kv label={o.label} value={o.value} size={15} ltr={o.ltr} />
              </View>
            ) : (
              <Kv key={i} label={o.label} value={o.value} size={o.sm ? 11.5 : 12.5} ltr={o.ltr} />
            );
          case "ih":
            return (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderColor: INK, paddingBottom: 3, marginBottom: 2 }}>
                <Txt size={11} bold>{o.a}</Txt>
                <Txt size={11} bold>{o.b}</Txt>
              </View>
            );
          case "item":
            return (
              <View key={i} style={{ paddingVertical: 3, borderBottomWidth: 1, borderStyle: "dotted", borderColor: INK }}>
                {!!o.title && <Txt size={12.5} bold>{o.title}</Txt>}
                {o.rows.map((r, j) => <Kv key={j} label={r.label} value={r.value} size={11.5} />)}
              </View>
            );
          case "sign":
            return <View key={i} style={{ marginTop: 16 }}><Txt size={11.5}>{o.s}: ..............................</Txt></View>;
        }
        return null;
      })}
    </View>
  );
}
