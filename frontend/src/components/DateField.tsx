import { useState } from "react";
import { Pressable, View } from "react-native";

import { radius, spacing, useTheme } from "@/src/theme";
import { Btn, IconBtn, Ionicons, Sheet, T } from "@/src/ui";

export const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const DAYS = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"]; // week starts Saturday
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const fmtDay = (s: string) => {
  const d = parse(s);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
};

// Tap-to-pick calendar. value / min / max are "YYYY-MM-DD" ("" = empty).
export function DateField({ label, value, onChange, testID, min, max }: { label: string; value: string; onChange: (v: string) => void; testID?: string; min?: string; max?: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(value) ?? new Date());
  const y = view.getFullYear();
  const m = view.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 1) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const today = ymd(new Date());

  const show = () => {
    setView(parse(value) ?? new Date());
    setOpen(true);
  };
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        testID={testID}
        onPress={show}
        style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md }}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.brandPrimary} />
        <View style={{ flex: 1 }}>
          <T v="caption">{label}</T>
          <T v="label" color={value ? "onSurface" : "muted"} numberOfLines={1}>{value ? fmtDay(value) : "اختر التاريخ"}</T>
        </View>
      </Pressable>
      <Sheet
        testID={testID ? `${testID}-sheet` : undefined}
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Btn testID="date-clear-button" style={{ flex: 1 }} variant="ghost" title="مسح" icon="close-circle-outline" onPress={() => pick("")} />
            <Btn testID="date-today-button" style={{ flex: 1 }} variant="secondary" title="اليوم" icon="today-outline" onPress={() => pick(today)} />
          </View>
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconBtn testID="calendar-prev-month" icon="chevron-forward" onPress={() => setView(new Date(y, m - 1, 1))} />
          <T v="h2" style={{ flex: 1, textAlign: "center" }} testID="calendar-month-label">{MONTHS[m]} {y}</T>
          <IconBtn testID="calendar-next-month" icon="chevron-back" onPress={() => setView(new Date(y, m + 1, 1))} />
        </View>
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row" }}>
            {DAYS.map((d) => (
              <T key={d} v="caption" style={{ flex: 1, textAlign: "center" }} numberOfLines={1} adjustsFontSizeToFit>{d}</T>
            ))}
          </View>
          {weeks.map((w, wi) => (
            <View key={wi} style={{ flexDirection: "row" }}>
              {w.map((d, di) => {
                if (!d) return <View key={di} style={{ flex: 1, height: 48 }} />;
                const v = `${y}-${pad(m + 1)}-${pad(d)}`;
                const sel = v === value;
                const disabled = (!!min && v < min) || (!!max && v > max);
                return (
                  <Pressable
                    key={di}
                    testID={`calendar-day-${v}`}
                    disabled={disabled}
                    onPress={() => pick(v)}
                    style={{ flex: 1, height: 48, alignItems: "center", justifyContent: "center" }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: sel ? colors.brandPrimary : "transparent",
                        borderWidth: v === today && !sel ? 1 : 0,
                        borderColor: colors.brandPrimary,
                      }}
                    >
                      <T v="label" color={sel ? "onBrandPrimary" : disabled ? "muted" : "onSurface"}>{d}</T>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );
}
