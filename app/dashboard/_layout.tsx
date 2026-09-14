import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AVATAR_IMAGE_SIZE,
  AVATAR_LEFT,
  AVATAR_SIZE,
  AVATAR_TOP_OFFSET,
} from "../../components/dashboard/avatarGeometry";
import { DashboardDrawerContext } from "../../components/dashboard/DrawerContext";
import { DashboardProfileContext } from "../../components/dashboard/ProfileContext";
import { getAvatarSource } from "../../lib/avatarLibrary";
import { loadProfile, Profile } from "../../lib/profile";
import { clearAuthSession } from "../../lib/storage";
import { supabase } from "../../lib/supabase";
import { ThemeToggle, useTheme } from "../../lib/theme";

const DRAWER_PORTION = 0.7;
const DRAWER_RADIUS = 30;
// drawerSurface's own paddingTop beyond the safe-area inset (see its inline
// style below) — factored out so the content gap math stays correct if that
// padding ever changes.
const DRAWER_HEADER_TOP_PADDING = 10;
const CONTENT_GAP_BELOW_AVATAR = 20;
/** Horizontal travel before a drag counts as a swipe rather than a tap. */
const SWIPE_ACTIVATION_DISTANCE = 24;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function DashboardTabsLayout() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;
  const currentProgress = useRef(0);
  const gestureStartProgress = useRef(0);

  // The drawer occupies a fixed portion of the viewport at any size, and the
  // page slides right by exactly that much.
  const openTranslateX = Math.max(1, width * DRAWER_PORTION);
  // Sits directly below the avatar (see avatarGeometry.ts), independent of
  // the header row above it, which is positioned absolutely.
  const drawerContentTop =
    AVATAR_TOP_OFFSET -
    DRAWER_HEADER_TOP_PADDING +
    AVATAR_SIZE +
    CONTENT_GAP_BELOW_AVATAR;

  const libraryAvatarSource = useMemo(
    () => getAvatarSource(profile?.avatarLibraryKey, profile?.email),
    [profile?.avatarLibraryKey, profile?.email],
  );

  const pageTranslateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, openTranslateX],
      }),
    [openTranslateX, progress],
  );

  const pageCornerRadius = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, DRAWER_RADIUS],
      }),
    [progress],
  );

  const animateTo = (target: 0 | 1) => {
    Animated.spring(progress, {
      toValue: target,
      useNativeDriver: Platform.OS !== "web",
      friction: 9,
      tension: 85,
    }).start();
    currentProgress.current = target;
    setIsDrawerOpen(target > 0.01);
  };

  const openDrawer = () => {
    animateTo(1);
  };

  const closeDrawer = () => {
    animateTo(0);
  };

  const toggleDrawer = () => {
    animateTo(currentProgress.current > 0.5 ? 0 : 1);
  };

  const panResponder = useMemo(() => {
    if (Platform.OS === "web") {
      return null;
    }

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);
        // These handlers sit on drawerSurface, which wraps every drawer button.
        // Claiming the gesture cancels the Pressable underneath, so the
        // threshold has to be higher than a finger's drift during an ordinary
        // tap — at the old 6px a normal tap on Settings was swallowed and
        // onPress never fired.
        return horizontal > SWIPE_ACTIVATION_DISTANCE && horizontal > vertical * 1.1;
      },
      onPanResponderGrant: () => {
        gestureStartProgress.current = currentProgress.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextProgress = clamp(
          gestureStartProgress.current + gestureState.dx / openTranslateX,
          0,
          1,
        );
        currentProgress.current = nextProgress;
        progress.setValue(nextProgress);
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_, gestureState) => {
        const thresholdOpen = currentProgress.current > 0.5;
        const flingRight = gestureState.vx > 0.2;
        const flingLeft = gestureState.vx < -0.2;
        const target = flingRight ? 1 : flingLeft ? 0 : thresholdOpen ? 1 : 0;
        animateTo(target);
      },
    });
  }, [openTranslateX, progress]);

  const mountedRef = useRef(true);
  const hasCheckedSession = useRef(false);

  const refreshProfile = useCallback(
    async (redirectWhenSignedOut = false) => {
      const nextProfile = await loadProfile();

      if (nextProfile) {
        if (mountedRef.current) {
          setProfile(nextProfile);
        }
        return;
      }

      // Only the very first check is allowed to bounce to sign-in. Later
      // refreshes keep whatever profile we already have, because a failure
      // there is far more likely to be a transient read than a real sign-out —
      // and redirecting on it is what dropped users at the login screen every
      // time they used the drawer's Home or Settings button. A genuine sign-out
      // still redirects, via the onAuthStateChange subscription below.
      if (redirectWhenSignedOut) {
        console.warn("[auth] Initial session check found no profile.");
        router.replace("/");
      }
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      void refreshProfile(!hasCheckedSession.current);
      hasCheckedSession.current = true;

      return () => {
        mountedRef.current = false;
      };
    }, [refreshProfile]),
  );

  // The authoritative sign-out signal. Covers token expiry and sign-outs
  // triggered from anywhere, without every screen focus having to re-prove the
  // session over the network.
  useEffect(() => {
    if (!supabase) {
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        console.warn("[auth] Supabase reported SIGNED_OUT; leaving dashboard.");
        router.replace("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  /**
   * `navigate`, not `replace` or `push`. `replace` swaps the whole `dashboard`
   * entry on the root stack and `push` adds a second one — both remount this
   * layout, resetting `profile` and re-running the session guard. `navigate`
   * switches to the sibling route inside the tab navigator that is already
   * mounted. No "are we already there?" check: settings is reachable from every
   * tab, and a stale pathname comparison could only ever silently do nothing.
   */
  const openSettings = () => {
    closeDrawer();
    router.navigate("/dashboard/settings");
  };

  const drawerContextValue = useMemo(
    () => ({
      progress,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      toggleDrawer,
    }),
    [progress, isDrawerOpen],
  );

  const profileContextValue = useMemo(
    () => ({ profile, refresh: refreshProfile }),
    [profile, refreshProfile],
  );

  return (
    <DashboardProfileContext.Provider value={profileContextValue}>
    <DashboardDrawerContext.Provider value={drawerContextValue}>
      <View style={[styles.root, { backgroundColor: theme.drawerBackground }]}>
        <View
          pointerEvents={isDrawerOpen ? "auto" : "none"}
          style={[styles.drawerLayer, { backgroundColor: theme.drawerBackground }]}
        >
          {/* Transparent swipe strip. box-none so it never intercepts a tap
              meant for a drawer button — drawerSurface carries the same pan
              handlers, so swipes over the drawer itself still work. */}
          {panResponder ? (
            <Animated.View
              {...panResponder.panHandlers}
              pointerEvents="box-none"
              style={styles.swipeZone}
            />
          ) : null}
          <Animated.View
            {...(panResponder?.panHandlers ?? {})}
            style={[
              styles.drawerSurface,
              { width: openTranslateX, paddingTop: insets.top + 10 },
            ]}
          >
            <View
              style={[
                styles.drawerHeaderActions,
                { top: insets.top + DRAWER_HEADER_TOP_PADDING },
              ]}
            >
              <ThemeToggle inline />
              <Pressable
                onPress={closeDrawer}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: theme.inputBackground },
                  pressed && styles.drawerItemPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={theme.secondaryText}
                />
              </Pressable>
            </View>

            {/* Positioned to exactly match the home screen's avatar (see
                avatarGeometry.ts), so opening the drawer reads as that avatar
                being revealed in place rather than a new one appearing. */}
            <View
              style={[
                styles.drawerAvatarWrap,
                {
                  top: insets.top + AVATAR_TOP_OFFSET,
                  backgroundColor: theme.drawerBackground,
                },
              ]}
            >
              <Image
                source={
                  profile?.avatarUri
                    ? { uri: profile.avatarUri }
                    : libraryAvatarSource
                }
                style={styles.avatarImage}
              />
            </View>

            <View
              style={[styles.drawerProfile, { marginTop: drawerContentTop }]}
            >
              <Text
                style={[styles.drawerName, { color: theme.text }]}
                numberOfLines={1}
              >
                {profile?.name || "Welcome"}
              </Text>
              <Text
                style={[styles.drawerEmail, { color: theme.secondaryText }]}
                numberOfLines={1}
              >
                {profile?.email || ""}
              </Text>
            </View>

            <View style={styles.drawerMenu}>
              <Pressable
                onPress={openSettings}
                style={({ pressed }) => [
                  styles.drawerItem,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                  pressed && styles.drawerItemPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="cog-outline"
                  size={20}
                  color={theme.accent}
                />
                <Text style={[styles.drawerItemLabel, { color: theme.text }]}>
                  Settings
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={async () => {
                closeDrawer();
                await supabase?.auth.signOut();
                await clearAuthSession();
                router.replace("/");
              }}
              style={({ pressed }) => [
                styles.signOutItem,
                { paddingBottom: insets.bottom + 16 },
                pressed && styles.drawerItemPressed,
              ]}
            >
              <MaterialCommunityIcons name="logout" size={20} color="#ef4444" />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </Animated.View>
        </View>

        <Animated.View
          {...(panResponder?.panHandlers ?? {})}
          pointerEvents={isDrawerOpen ? "none" : "auto"}
          style={[
            styles.pageShell,
            {
              backgroundColor: theme.background,
              transform: [{ translateX: pageTranslateX }],
              borderTopLeftRadius: pageCornerRadius,
              borderBottomLeftRadius: pageCornerRadius,
            },
          ]}
        >
          <Tabs
            initialRouteName="index"
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: theme.background },
              tabBarActiveTintColor: theme.accent,
              tabBarInactiveTintColor: theme.secondaryText,
              tabBarStyle: {
                backgroundColor: theme.surface,
                borderTopColor: theme.border,
                height: Platform.OS === "ios" ? 78 : 64,
                paddingTop: 6,
                paddingBottom: Platform.OS === "ios" ? 16 : 6,
              },
              tabBarShowLabel: false,
              tabBarLabelStyle: {
                display: "none",
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: "Home",
                tabBarIcon: ({ focused, color, size }) => (
                  <MaterialCommunityIcons
                    name={focused ? "home" : "home-outline"}
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tabs.Screen
              name="create"
              options={{
                title: "Create",
                tabBarIcon: ({ focused, color, size }) => (
                  <MaterialCommunityIcons
                    name={focused ? "plus-circle" : "plus-circle-outline"}
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                href: null,
              }}
            />
            <Tabs.Screen
              name="edit-profile"
              options={{
                href: null,
              }}
            />
          </Tabs>
        </Animated.View>

        {/* Outside dismiss: tap or swipe-left closes drawer */}
        {isDrawerOpen ? (
          panResponder ? (
            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.outsideOverlay, { left: openTranslateX }]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={closeDrawer}
              />
            </Animated.View>
          ) : (
            <Pressable
              onPress={closeDrawer}
              style={[styles.outsideOverlay, { left: openTranslateX }]}
            />
          )
        ) : null}
      </View>
    </DashboardDrawerContext.Provider>
    </DashboardProfileContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  drawerLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-start",
    zIndex: 1,
  },
  drawerSurface: {
    flex: 1,
    paddingTop: 14,
    paddingHorizontal: 14,
    // Must outrank swipeZone. iOS orders overlapping siblings by zIndex, and
    // with this left unset the transparent full-bleed swipe catcher could land
    // on top and silently eat every tap on the buttons below.
    zIndex: 1,
  },
  swipeZone: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 0,
  },
  drawerHeaderActions: {
    position: "absolute",
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    zIndex: 5,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerProfile: {
    alignItems: "flex-start",
    marginTop: 12,
    marginBottom: 16,
  },
  drawerAvatarWrap: {
    position: "absolute",
    left: AVATAR_LEFT,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  avatarImage: {
    width: AVATAR_IMAGE_SIZE,
    height: AVATAR_IMAGE_SIZE,
    resizeMode: "contain",
  },
  drawerName: {
    fontSize: 22,
    fontWeight: "800",
  },
  drawerEmail: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
  },
  drawerMenu: {
    gap: 8,
    width: "100%",
  },
  // `gap` is deliberately not used on these two rows: it mislays out on native
  // here and collapsed the labels away entirely. An explicit margin on the
  // label is equivalent and reliable.
  signOutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    width: "100%",
    marginTop: "auto",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ef4444",
    marginLeft: 10,
    // 0, not 1: if something upstream over-constrains this row, the label
    // should overflow where it can be seen rather than collapse to nothing.
    flexShrink: 0,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  drawerItemPressed: {
    opacity: 0.88,
  },
  drawerItemLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 10,
    // 0, not 1: if something upstream over-constrains this row, the label
    // should overflow where it can be seen rather than collapse to nothing.
    flexShrink: 0,
  },
  pageShell: {
    flex: 1,
    overflow: "hidden",
    zIndex: 2,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  outsideOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
});
