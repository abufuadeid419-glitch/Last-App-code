import { ActivityIndicator, Linking, View } from "react-native";
import { WebView } from "react-native-webview";

import { mapEmbedUrl, MapType } from "@/src/maps";
import { useTheme } from "@/src/theme";

// Native: the official Google Maps embed rendered in a WebView (no API key required).
export function GoogleMapEmbed({ lat, lng, type, zoom = 16 }: { lat: number; lng: number; type: MapType; zoom?: number }) {
  const { colors } = useTheme();
  const src = mapEmbedUrl(lat, lng, type, zoom);
  return (
    <WebView
      key={src}
      testID="google-map-embed"
      source={{ uri: src }}
      style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}
      startInLoadingState
      renderLoading={() => (
        <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary }}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      )}
      // Links inside the embed (e.g. "View larger map") open in the Google Maps app / browser.
      onShouldStartLoadWithRequest={(req) => {
        if (req.url === src || req.isTopFrame === false || !req.url.startsWith("http")) return true;
        Linking.openURL(req.url).catch(() => {});
        return false;
      }}
    />
  );
}
