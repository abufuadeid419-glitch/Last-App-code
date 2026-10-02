import { View } from "react-native";

// Web preview: interactive map is native-only.
export function RouteMap(_: { stops: { lat?: number | null; lng?: number | null; customer_name: string; status?: string }[] }) {
  return <View />;
}
