import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ThemeName = "light" | "dark";

export type AppTheme = {
  name: ThemeName;
  background: string;
  surface: string;
  drawerBackground: string;
  text: string;
  secondaryText: string;
  border: string;
  inputBackground: string;
  inputText: string;
  bannerBackground: string;
  bannerText: string;
  statusBackground: string;
  statusText: string;
  error: string;
  accent: string;
};

const themes: Record<ThemeName, AppTheme> = {
  light: {
    name: "light",
    background: "#f5f7fb",
    surface: "#ffffff",
    drawerBackground: "#e7ebf2",
    text: "#111827",
    secondaryText: "#4b5563",
    border: "#d1d5db",
    inputBackground: "#ffffff",
    inputText: "#111827",
    bannerBackground: "#fff7d6",
    bannerText: "#7c4a00",
    statusBackground: "#e8f4ff",
    statusText: "#0b3d91",
    error: "#c00",
    accent: "#2563eb",
  },
  dark: {
    name: "dark",
    background: "#111827",
    surface: "#1f2937",
    drawerBackground: "#0a0f1a",
    text: "#f9fafb",
    secondaryText: "#d1d5db",
    border: "#4b5563",
    inputBackground: "#374151",
    inputText: "#f9fafb",
    bannerBackground: "#4a3b00",
    bannerText: "#fef3c7",
    statusBackground: "#1e3a5f",
    statusText: "#dbeafe",
    error: "#f87171",
    accent: "#60a5fa",
  },
};

type ThemeContextValue = {
  theme: AppTheme;
  themeName: ThemeName;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    // On web, attempt to restore from localStorage, otherwise fall back to
    // system preference. Wrap in try/catch for environments without localStorage.
    if (typeof window !== "undefined" && Platform.OS === "web") {
      try {
        const stored = localStorage.getItem("themeName");
        if (stored === "dark" || stored === "light") return stored as ThemeName;
        const prefersDark =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
        return prefersDark ? "dark" : "light";
      } catch {
        return "light";
      }
    }

    return "light";
  });

  const theme = useMemo(() => themes[themeName], [themeName]);

  const toggleTheme = () => {
    setThemeName((current) => (current === "light" ? "dark" : "light"));
  };

  // Persist theme changes on web so refreshes keep the selected theme
  useEffect(() => {
    if (typeof window !== "undefined" && Platform.OS === "web") {
      try {
        localStorage.setItem("themeName", themeName);
      } catch {
        // ignore write errors
      }
    }
  }, [themeName]);

  const value = useMemo(
    () => ({ theme, themeName, toggleTheme }),
    [theme, themeName],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        animated
        style={themeName === "dark" ? "light" : "dark"}
        backgroundColor={theme.background}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}

export function ThemeToggle({ inline = false }: { inline?: boolean } = {}) {
  const { themeName, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = themeName === "dark";
  const knobOffset = useRef(new Animated.Value(isDark ? 18 : 0)).current;

  useEffect(() => {
    Animated.timing(knobOffset, {
      toValue: isDark ? 18 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isDark, knobOffset]);

  const trackColor = isDark ? "#1f2937" : "#f5f7fb";
  const thumbColor = isDark ? "#f9fafb" : "#ffffff";
  const sunColor = isDark ? "#9ca3af" : "#f59e0b";
  const moonColor = isDark ? "#fbbf24" : "#4b5563";

  return (
    <Pressable
      onPress={toggleTheme}
      style={
        inline
          ? undefined
          : [styles.switchContainer, { top: Math.max(12, insets.top + 8) }]
      }
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
    >
      <View style={styles.labelRow}>
        <Animated.View
          style={[
            styles.track,
            {
              backgroundColor: trackColor,
              borderColor: isDark ? "#60a5fa" : "#9ca3af",
            },
          ]}
        >
          <MaterialCommunityIcons
            name="weather-sunny"
            size={12}
            color={sunColor}
            style={[
              styles.trackIcon,
              styles.sunIcon,
              { opacity: isDark ? 0 : 1 },
            ]}
          />
          <MaterialCommunityIcons
            name="weather-night"
            size={12}
            color={moonColor}
            style={[
              styles.trackIcon,
              styles.moonIcon,
              { opacity: isDark ? 1 : 0 },
            ]}
          />
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: thumbColor,
                transform: [{ translateX: knobOffset }],
              },
            ]}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  switchContainer: {
    position: "absolute",
    right: 20,
    zIndex: 30,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  labelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  activeLabel: {
    color: "#2563eb",
  },
  inactiveLabel: {
    color: "#6b7280",
  },
  track: {
    width: 40,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 4,
    justifyContent: "center",
    overflow: "hidden",
  },
  trackIcon: {
    position: "absolute",
    top: 4,
    zIndex: 2,
  },
  sunIcon: {
    left: 4,
  },
  moonIcon: {
    right: 4,
  },
  thumb: {
    width: 14,
    height: 14,
    borderRadius: 999,
    position: "absolute",
    left: 3,
    zIndex: 1,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
