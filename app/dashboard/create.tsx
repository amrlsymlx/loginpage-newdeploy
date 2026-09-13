import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDashboardProfile } from "../../components/dashboard/ProfileContext";
import { useTheme } from "../../lib/theme";

export default function CreateTab() {
  const { theme } = useTheme();
  const { profile } = useDashboardProfile();

  // The layout redirects to sign-in when there is no session.
  if (!profile) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Create</Text>
      <Text style={[styles.message, { color: theme.secondaryText }]}>
        Create tab is ready.
      </Text>
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
  message: {
    fontSize: 16,
  },
});
