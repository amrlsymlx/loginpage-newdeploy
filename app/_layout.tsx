import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Analytics } from "../lib/analytics";
import { ThemeProvider, ThemeToggle, useTheme } from "../lib/theme";

export default function RootLayout() {
  const [fontsLoaded] = useFonts(MaterialCommunityIcons.font);

  // Analytics sits outside the font gate so a first visit is still counted
  // while the icon font is in flight — it renders nothing either way.
  return (
    <>
      <Analytics />
      {fontsLoaded ? (
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      ) : null}
    </>
  );
}

/**
 * Split out so it can read the theme: everything behind the screens has to be
 * themed too. Without an explicit `contentStyle`, React Navigation paints its
 * own default background (a light grey, regardless of our dark mode) in any
 * area a screen does not cover — including the strip behind the status bar
 * under Android's edge-to-edge layout.
 */
function RootNavigator() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const showThemeToggle =
    pathname === "/" ||
    pathname === "/sign-up" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: "card",
          contentStyle: { backgroundColor: theme.background },
        }}
      />
      {showThemeToggle ? <ThemeToggle /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
