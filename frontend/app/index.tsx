import { View, ActivityIndicator } from "react-native";

import { useTheme } from "@/src/theme";

// The root gate redirects to the right area for the signed-in user.
export default function Index() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}
