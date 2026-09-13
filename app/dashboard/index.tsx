import React, { useMemo } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AVATAR_IMAGE_SIZE,
  AVATAR_SIZE,
} from "../../components/dashboard/avatarGeometry";
import { useDashboardDrawer } from "../../components/dashboard/DrawerContext";
import { useDashboardProfile } from "../../components/dashboard/ProfileContext";
import { getAvatarSource } from "../../lib/avatarLibrary";
import { useTheme } from "../../lib/theme";

// Animating the Pressable directly, rather than wrapping it in an
// Animated.View, matters on web: react-native-web drops click events through
// an Animated.View wrapper, so a wrapped avatar stopped responding to taps.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function DashboardHomeTab() {
  const insets = useSafeAreaInsets();
  const { progress: drawerProgress, isDrawerOpen, openDrawer } =
    useDashboardDrawer();
  const { profile } = useDashboardProfile();
  const { theme } = useTheme();

  const libraryAvatarSource = useMemo(
    () => getAvatarSource(profile?.avatarLibraryKey, profile?.email),
    [profile?.avatarLibraryKey, profile?.email],
  );

  const avatarOpacity = useMemo(
    () =>
      drawerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    [drawerProgress],
  );

  // The layout redirects to sign-in when there is no session.
  if (!profile) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <AnimatedPressable
        onPress={openDrawer}
        disabled={isDrawerOpen}
        style={[
          styles.avatarTrigger,
          {
            borderColor: theme.border,
            backgroundColor: theme.surface,
            top: 16 + insets.top,
            opacity: avatarOpacity,
          },
        ]}
        hitSlop={8}
      >
        <View style={[styles.avatarWrap, { backgroundColor: theme.surface }]}>
          <Image
            source={
              profile.avatarUri ? { uri: profile.avatarUri } : libraryAvatarSource
            }
            style={styles.avatarImage}
          />
        </View>
      </AnimatedPressable>

      <View style={styles.contentArea}>
        <Text style={[styles.title, { color: theme.text }]}>
          {profile.name ? `Welcome ${profile.name}` : "Welcome"}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          {profile.email ? `Your email is ${profile.email}` : "You are signed in."}
        </Text>
        <Text style={[styles.message, { color: theme.secondaryText }]}>
          Tap the avatar or swipe right anywhere to open the drawer.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  avatarTrigger: {
    position: "absolute",
    left: 10,
    zIndex: 20,
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: AVATAR_IMAGE_SIZE,
    height: AVATAR_IMAGE_SIZE,
    resizeMode: "contain",
  },
  contentArea: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 130,
    paddingRight: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "left",
  },
  message: {
    fontSize: 16,
    textAlign: "left",
    marginBottom: 16,
  },
});
