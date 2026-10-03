import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export { Ionicons };

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

// ---------------- Text ----------------
type Variant = "display" | "title" | "h2" | "body" | "label" | "caption";
const sizes: Record<Variant, { size: number; font: string; lh: number }> = {
  display: { size: 26, font: fonts.bold, lh: 40 },
  title: { size: 22, font: fonts.bold, lh: 34 },
  h2: { size: 17, font: fonts.semibold, lh: 28 },
  body: { size: 15, font: fonts.regular, lh: 24 },
  label: { size: 15, font: fonts.semibold, lh: 24 },
  caption: { size: 13, font: fonts.regular, lh: 20 },
};

export function T({
  v = "body",
  color,
  style,
  ...rest
}: TextProps & { v?: Variant; color?: keyof ThemeColors }) {
  const { colors } = useTheme();
  const s = sizes[v];
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: s.font, fontSize: s.size, lineHeight: s.lh, color: colors[color ?? (v === "caption" ? "muted" : "onSurface")] },
        style,
      ]}
    />
  );
}

// ---------------- Button ----------------
type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
export function Btn({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  testID,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: ViewStyle;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const map = {
    primary: [colors.brandPrimary, colors.onBrandPrimary],
    secondary: [colors.brandSecondary, colors.onBrandSecondary],
    danger: [colors.error, colors.onError],
    ghost: ["transparent", colors.brandPrimary],
  } as const;
  const [bg, fg] = map[variant];
  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          minHeight: small ? 40 : 52,
          paddingHorizontal: small ? spacing.md : spacing.lg,
          borderRadius: radius.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 20} color={fg} />}
          <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: small ? 14 : 16 }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, testID, tone }: { icon: IconName; onPress: () => void; testID?: string; tone?: "brand" | "plain" }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "brand" ? colors.brandPrimary : colors.surfaceSecondary,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={tone === "brand" ? colors.onBrandPrimary : colors.onSurface} />
    </Pressable>
  );
}

// ---------------- Card ----------------
export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  };
  if (!onPress) return <View testID={testID} style={[base, style]}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [base, style, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

// ---------------- Field ----------------
export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <T v="label" color="onSurfaceSecondary">{label}</T>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(e) => {
          setFocus(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          props.onBlur?.(e);
        }}
        style={{
          minHeight: 50,
          borderRadius: radius.md,
          borderWidth: focus ? 1.5 : 1,
          borderColor: error ? colors.error : focus ? colors.brandPrimary : colors.border,
          backgroundColor: colors.surfaceSecondary,
          paddingHorizontal: spacing.md,
          fontFamily: fonts.regular,
          fontSize: 15,
          color: colors.onSurface,
          textAlign: Platform.OS === "web" ? "right" : undefined,
        }}
      />
      {!!error && <T v="caption" color="error">{error}</T>}
    </View>
  );
}

// ---------------- Header ----------------
export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <T v="title" testID="screen-title">{title}</T>
        {!!subtitle && <T v="caption">{subtitle}</T>}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>{right}</View>
    </View>
  );
}

// ---------------- Stat ----------------
export function Stat({ label, value, icon, tone = "brand", testID }: { label: string; value: string; icon: IconName; tone?: "brand" | "success" | "warning" | "error" | "info"; testID?: string }) {
  const { colors } = useTheme();
  const c = tone === "brand" ? colors.brandPrimary : colors[tone];
  return (
    <View
      testID={testID}
      style={{
        flexBasis: "47%",
        flexGrow: 1,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={20} color={c} />
      </View>
      <T v="caption">{label}</T>
      <T v="h2" style={{ color: c }} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
    </View>
  );
}

// ---------------- Empty / Loading / Error ----------------
export function Empty({ icon = "file-tray-outline", text, action }: { icon?: IconName; text: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View testID="empty-state" style={{ alignItems: "center", padding: spacing.xxl, gap: spacing.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={34} color={colors.brandPrimary} />
      </View>
      <T color="muted" style={{ textAlign: "center" }}>{text}</T>
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View testID="loading-state" style={{ padding: spacing.xxl, alignItems: "center" }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Empty icon="cloud-offline-outline" text={message} action={<Btn testID="retry-button" small title="إعادة المحاولة" onPress={onRetry} icon="refresh" />} />
  );
}

// ---------------- Badge ----------------
export function Badge({ text, tone = "brand", testID }: { text: string; tone?: "brand" | "success" | "warning" | "error"; testID?: string }) {
  const { colors } = useTheme();
  const bg = tone === "brand" ? colors.brandTertiary : colors[tone];
  const fg = tone === "brand" ? colors.onBrandTertiary : colors[`on${tone[0].toUpperCase()}${tone.slice(1)}` as keyof ThemeColors];
  return (
    <View testID={testID} style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

// ---------------- Segmented / Chips ----------------
export function Segments<K extends string>({ value, onChange, options }: { value: K; onChange: (k: K) => void; options: { key: K; label: string }[] }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, height: 56 }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}>
      {options.map((o) => {
        const sel = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={`segment-${o.key}`}
            onPress={() => onChange(o.key)}
            style={{
              flexShrink: 0,
              height: 36,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.pill,
              justifyContent: "center",
              backgroundColor: sel ? colors.brandPrimary : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: sel ? colors.brandPrimary : colors.border,
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: sel ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------------- Row ----------------
export function Row({ title, subtitle, right, onPress, testID, icon }: { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; testID?: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
        minHeight: 64,
      })}
    >
      {icon && (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={20} color={colors.brandPrimary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T v="label" numberOfLines={1}>{title}</T>
        {!!subtitle && <T v="caption" numberOfLines={2}>{subtitle}</T>}
      </View>
      {right}
    </Pressable>
  );
}

// ---------------- Sheet ----------------
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testID?: string;
}) {
  const styles = useSheetStyles();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} testID="sheet-backdrop" />
        <View testID={testID} style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <T v="h2" style={{ flex: 1 }}>{title}</T>
            <IconBtn icon="close" onPress={onClose} testID="sheet-close-button" />
          </View>
          <KeyboardAwareScrollView style={{ flexGrow: 0, flexShrink: 1 }} bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            {children}
          </KeyboardAwareScrollView>
          {footer && <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

const useSheetStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.overlay },
  sheet: { maxHeight: "90%", backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, alignSelf: "center", marginTop: spacing.sm },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
}));

// ---------------- Select (picker) ----------------
export function Select<O>({
  label,
  value,
  placeholder,
  options,
  getLabel,
  getSub,
  onSelect,
  testID,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  options: O[];
  getLabel: (o: O) => string;
  getSub?: (o: O) => string;
  onSelect: (o: O) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => options.filter((o) => getLabel(o).includes(q)), [options, q, getLabel]);
  const insets = useSafeAreaInsets();
  return (
    <View style={{ gap: spacing.xs }}>
      <T v="label" color="onSurfaceSecondary">{label}</T>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={{ minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center" }}
      >
        <T style={{ flex: 1 }} color={value ? "onSurface" : "muted"} numberOfLines={1}>{value ?? placeholder}</T>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: colors.overlay }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={{ height: "75%", backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: insets.bottom }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md }}>
              <T v="h2" style={{ flex: 1 }}>{label}</T>
              <IconBtn icon="close" onPress={() => setOpen(false)} testID="select-close-button" />
            </View>
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              <TextInput
                testID="select-search-input"
                value={q}
                onChangeText={setQ}
                placeholder="بحث..."
                placeholderTextColor={colors.muted}
                style={{ minHeight: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.md, fontFamily: fonts.regular, color: colors.onSurface, textAlign: Platform.OS === "web" ? "right" : undefined }}
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={(_, i) => String(i)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Empty text="لا توجد نتائج" icon="search-outline" />}
              renderItem={({ item, index }) => (
                <Row
                  testID={`select-option-${index}`}
                  title={getLabel(item)}
                  subtitle={getSub?.(item)}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                    setQ("");
                  }}
                />
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------- Toast ----------------
type ToastT = { msg: string; tone: "success" | "error" };
const ToastCtx = createContext<(msg: string, tone?: "success" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastT | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const show = useCallback(
    (msg: string, tone: "success" | "error" = "success") => {
      setToast({ msg, tone });
      if (Platform.OS !== "web")
        Haptics.notificationAsync(tone === "success" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, 2800);
    },
    [anim],
  );
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          testID="toast-message"
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: insets.top + spacing.sm,
            left: spacing.lg,
            right: spacing.lg,
            zIndex: 999,
            elevation: 20,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            backgroundColor: toast.tone === "success" ? colors.surfaceInverse : colors.error,
            borderRadius: radius.md,
            padding: spacing.md,
            flexDirection: "row",
            gap: spacing.sm,
            alignItems: "center",
          }}
        >
          <Ionicons name={toast.tone === "success" ? "checkmark-circle" : "alert-circle"} size={20} color={colors.onSurfaceInverse} />
          <Text style={{ flex: 1, color: colors.onSurfaceInverse, fontFamily: fonts.semibold, fontSize: 14 }}>{toast.msg}</Text>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <T v="h2" style={{ flex: 1 }}>{title}</T>
        {action}
      </View>
      {children}
    </View>
  );
}
