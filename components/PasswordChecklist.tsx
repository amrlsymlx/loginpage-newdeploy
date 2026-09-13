import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getPasswordChecks, PASSWORD_MIN_LENGTH } from "../lib/validation";

const RULES: { key: string; label: string }[] = [
  { key: "minLength", label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { key: "hasUppercase", label: "One uppercase letter" },
  { key: "hasLowercase", label: "One lowercase letter" },
  { key: "hasNumber", label: "One number" },
  { key: "hasSpecialCharacter", label: "One special character" },
];

/** Live checklist of the password policy, shown while a password is typed. */
export function PasswordChecklist({ password }: { password: string }) {
  const checks = useMemo(
    () => getPasswordChecks(password) as Record<string, boolean>,
    [password],
  );

  if (password.length === 0) {
    return null;
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Password must include:</Text>
      {RULES.map((rule) => {
        const satisfied = checks[rule.key];

        return (
          <View key={rule.key} style={styles.item}>
            <MaterialCommunityIcons
              name={satisfied ? "check-circle" : "circle-outline"}
              size={14}
              color={satisfied ? "#16a34a" : "#64748b"}
            />
            <Text style={[styles.text, satisfied && styles.textSuccess]}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e3a8a",
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  text: {
    marginLeft: 8,
    fontSize: 12,
    color: "#475569",
  },
  textSuccess: {
    color: "#166534",
  },
});
