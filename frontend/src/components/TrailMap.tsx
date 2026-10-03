import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";

import { trailHtml, TrailPoint, TrailVisit } from "@/src/maps";
import { useTheme } from "@/src/theme";

// Native: the day's movement path drawn with Leaflet inside a WebView.
export function TrailMap({ points, visits, satellite }: { points: TrailPoint[]; visits: TrailVisit[]; satellite: boolean }) {
  const { colors } = useTheme();
  const html = trailHtml(points, visits, satellite);
  return (
    <WebView
      key={html}
      testID="trail-map"
      originWhitelist={["*"]}
      source={{ html, baseUrl: "https://localhost/" }}
      style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      startInLoadingState
      renderLoading={() => (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      )}
    />
  );
}
