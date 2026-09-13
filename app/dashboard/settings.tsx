import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDashboardProfile } from "../../components/dashboard/ProfileContext";
import { clearAuthSession } from "../../lib/storage";
import { supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

export default function SettingsTab() {
  const router = useRouter();
  const { theme } = useTheme();
  const { profile } = useDashboardProfile();

  const handleSignOut = async () => {
    try {
      // Ends the Supabase session too, not just the local one.
      await supabase?.auth.signOut();
      await clearAuthSession();
    } catch (error) {
      console.warn("Failed to sign out cleanly", error);
    } finally {
      router.replace("/");
    }
  };

  const handleEditProfile = () => {
    router.push("/dashboard/edit-profile");
  };

  // The layout redirects to sign-in when there is no session.
  if (!profile) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
          onPress={handleEditProfile}
          hitSlop={10}
        >
          <Text style={styles.secondaryButtonText}>Edit Profile</Text>
        </Pressable>
      </View>

      <View style={styles.signOutRow}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={handleSignOut}
          hitSlop={10}
        >
          <Text style={styles.primaryButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 24,
    paddingTop: 60,
    position: "relative",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
  },
  actionsRow: {
    marginTop: 24,
    width: "100%",
    alignItems: "flex-start",
  },
  signOutRow: {
    marginTop: 12,
    width: "100%",
    alignItems: "flex-start",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#e5edff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  secondaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  secondaryButtonText: {
    color: "#1e3a8a",
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#1d4ed8",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
