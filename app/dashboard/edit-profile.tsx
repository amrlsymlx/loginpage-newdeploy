import { MaterialCommunityIcons } from "@expo/vector-icons";
import { decode as decodeBase64 } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useDashboardProfile } from "../../components/dashboard/ProfileContext";
import {
  AVATAR_LIBRARY_OPTIONS,
  getAvatarOptionByKey,
  getAvatarSource,
  normalizeAvatarLibraryKey,
} from "../../lib/avatarLibrary";
import { loadProfile } from "../../lib/profile";
import { getAuthSession, updateAuthSession } from "../../lib/storage";
import { SUPABASE_CONFIGURED, supabase } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

type PendingAvatarAction = "gallery" | "camera" | null;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const promptOpenSettings = (permissionName: "Camera" | "Photo Library") => {
  Alert.alert(
    `${permissionName} permission is off`,
    `Enable ${permissionName.toLowerCase()} access in iOS Settings to continue.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Open Settings",
        onPress: () => {
          Linking.openSettings();
        },
      },
    ],
  );
};

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { refresh: refreshDashboardProfile } = useDashboardProfile();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [initialFullName, setInitialFullName] = useState("");
  const [draftFullName, setDraftFullName] = useState("");
  const [isEditingFullName, setIsEditingFullName] = useState(false);
  const [savingFullName, setSavingFullName] = useState(false);
  const [initialPhoneNumber, setInitialPhoneNumber] = useState("");
  const [draftPhoneNumber, setDraftPhoneNumber] = useState("");
  const [isEditingPhoneNumber, setIsEditingPhoneNumber] = useState(false);
  const [savingPhoneNumber, setSavingPhoneNumber] = useState(false);
  const [initialAddress, setInitialAddress] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarLibraryKey, setAvatarLibraryKey] = useState<string | null>(null);
  const [updatingAvatar, setUpdatingAvatar] = useState(false);
  const [launchingAvatarAction, setLaunchingAvatarAction] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showAvatarLibraryPicker, setShowAvatarLibraryPicker] = useState(false);
  const [pendingAvatarAction, setPendingAvatarAction] =
    useState<PendingAvatarAction>(null);
  const [pendingLibraryKey, setPendingLibraryKey] = useState<string | null>(
    null,
  );

  const handleBackToSettings = () => {
    router.replace("/dashboard/settings");
  };

  const normalizedAvatarLibraryKey = useMemo(
    () => normalizeAvatarLibraryKey(avatarLibraryKey),
    [avatarLibraryKey],
  );

  const currentLibraryAvatarSource = useMemo(
    () => getAvatarSource(normalizedAvatarLibraryKey, email),
    [normalizedAvatarLibraryKey, email],
  );

  const saveAvatarUri = async (nextUri: string) => {
    setUpdatingAvatar(true);
    try {
      if (!SUPABASE_CONFIGURED || !supabase) {
        setAvatarUri(nextUri);
        setAvatarLibraryKey(null);
        await updateAuthSession({
          avatarUri: nextUri,
          avatarPath: null,
          avatarLibraryKey: null,
        });
        return;
      }

      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user?.id;
      if (!userId) {
        throw new Error("No authenticated user found.");
      }
      const previousAvatarPathFromAuth =
        session.data.session?.user?.user_metadata?.avatarPath;
      const cachedSession = await getAuthSession();
      const previousAvatarPath =
        (typeof previousAvatarPathFromAuth === "string" &&
        previousAvatarPathFromAuth.trim().length > 0
          ? previousAvatarPathFromAuth
          : typeof cachedSession?.avatarPath === "string" &&
              cachedSession.avatarPath.trim().length > 0
            ? cachedSession.avatarPath
            : null) || null;

      const fileName = `${userId}/avatar-${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(nextUri, {
        encoding: "base64",
      });
      const fileBytes = new Uint8Array(decodeBase64(base64));

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, fileBytes, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          `Unable to upload avatar to Supabase Storage. Make sure the avatars bucket exists and RLS policies are configured. ${uploadError.message}`,
        );
      }

      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage.from("avatars").createSignedUrl(fileName, 3600);
      if (signedUrlError) {
        console.warn(
          "Unable to generate signed URL for avatar",
          signedUrlError,
        );
      }

      const remoteAvatarUrl = signedUrlData?.signedUrl || nextUri;

      setAvatarUri(remoteAvatarUrl);
      setAvatarLibraryKey(null);
      await updateAuthSession({
        avatarUri: remoteAvatarUrl,
        avatarPath: fileName,
        avatarLibraryKey: null,
      });

      // Store only the file path in metadata â€” fresh signed URLs are generated on sign-in
      const { error: updateUserError } = await supabase.auth.updateUser({
        data: {
          avatarPath: fileName,
          avatarLibraryKey: null,
        },
      } as any);
      if (updateUserError) {
        throw new Error(updateUserError.message);
      }

      if (previousAvatarPath && previousAvatarPath !== fileName) {
        const { error: removePreviousAvatarError } = await supabase.storage
          .from("avatars")
          .remove([previousAvatarPath]);
        if (removePreviousAvatarError) {
          Alert.alert(
            "Avatar updated with warning",
            `Your new avatar was saved, but we could not delete the previous avatar file: ${removePreviousAvatarError.message}`,
          );
        }
      }
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message || "Try again.");
    } finally {
      setUpdatingAvatar(false);
      void refreshDashboardProfile();
    }
  };

  const handleSelectLibraryAvatar = async (nextLibraryKey: string) => {
    setUpdatingAvatar(true);
    try {
      setAvatarUri(null);
      setAvatarLibraryKey(nextLibraryKey);
      await updateAuthSession({
        avatarUri: null,
        avatarPath: null,
        avatarLibraryKey: nextLibraryKey,
      });

      if (SUPABASE_CONFIGURED && supabase) {
        const { error: updateUserError } = await supabase.auth.updateUser({
          data: {
            avatarPath: null,
            avatarLibraryKey: nextLibraryKey,
          },
        } as any);
        if (updateUserError) {
          throw new Error(updateUserError.message);
        }
      }
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message || "Try again.");
    } finally {
      setUpdatingAvatar(false);
      setPendingLibraryKey(null);
      setShowAvatarLibraryPicker(false);
      setShowAvatarMenu(false);
      void refreshDashboardProfile();
    }
  };

  const handleSaveFullName = async () => {
    const trimmedName = draftFullName.trim();
    const originalName = initialFullName.trim();

    if (!trimmedName) {
      Alert.alert("Name required", "Please enter your full name.");
      return;
    }

    if (trimmedName === originalName) {
      return;
    }

    setSavingFullName(true);
    try {
      await updateAuthSession({ name: trimmedName });

      if (SUPABASE_CONFIGURED && supabase) {
        const { error: updateUserError } = await supabase.auth.updateUser({
          data: {
            name: trimmedName,
            full_name: trimmedName,
          },
        } as any);

        if (updateUserError) {
          throw new Error(updateUserError.message);
        }
      }

      setFullName(trimmedName);
      setDraftFullName(trimmedName);
      setInitialFullName(trimmedName);
      setIsEditingFullName(false);
      void refreshDashboardProfile();
      Alert.alert("Saved", "Full Name updated.");
    } catch (error: any) {
      Alert.alert("Update failed", error?.message || "Try again.");
    } finally {
      setSavingFullName(false);
    }
  };

  const handleSavePhoneNumber = async () => {
    const trimmedPhoneNumber = draftPhoneNumber.trim();
    const originalPhoneNumber = initialPhoneNumber.trim();

    if (trimmedPhoneNumber === originalPhoneNumber) {
      setIsEditingPhoneNumber(false);
      return;
    }

    setSavingPhoneNumber(true);
    try {
      await updateAuthSession({ phoneNumber: trimmedPhoneNumber || null });

      if (SUPABASE_CONFIGURED && supabase) {
        const { error: updateUserError } = await supabase.auth.updateUser({
          data: {
            phoneNumber: trimmedPhoneNumber || null,
            phone_number: trimmedPhoneNumber || null,
          },
        } as any);

        if (updateUserError) {
          throw new Error(updateUserError.message);
        }
      }

      const nextPhoneNumber = trimmedPhoneNumber || "N/A";
      setPhoneNumber(nextPhoneNumber);
      setDraftPhoneNumber(nextPhoneNumber);
      setInitialPhoneNumber(nextPhoneNumber);
      setIsEditingPhoneNumber(false);
      Alert.alert("Saved", "Phone Number updated.");
    } catch (error: any) {
      Alert.alert("Update failed", error?.message || "Try again.");
    } finally {
      setSavingPhoneNumber(false);
    }
  };

  const handleSaveAddress = async () => {
    const trimmedAddress = draftAddress.trim();
    const originalAddress = initialAddress.trim();

    if (trimmedAddress === originalAddress) {
      setIsEditingAddress(false);
      return;
    }

    setSavingAddress(true);
    try {
      await updateAuthSession({ address: trimmedAddress || null });

      if (SUPABASE_CONFIGURED && supabase) {
        const { error: updateUserError } = await supabase.auth.updateUser({
          data: {
            address: trimmedAddress || null,
          },
        } as any);

        if (updateUserError) {
          throw new Error(updateUserError.message);
        }
      }

      const nextAddress = trimmedAddress || "N/A";
      setAddress(nextAddress);
      setDraftAddress(nextAddress);
      setInitialAddress(nextAddress);
      setIsEditingAddress(false);
      Alert.alert("Saved", "Address updated.");
    } catch (error: any) {
      Alert.alert("Update failed", error?.message || "Try again.");
    } finally {
      setSavingAddress(false);
    }
  };

  const ensureMediaLibraryPermission = async () => {
    const currentPermission =
      await ImagePicker.getMediaLibraryPermissionsAsync();
    if (currentPermission.granted) {
      return true;
    }

    if (!currentPermission.canAskAgain) {
      promptOpenSettings("Photo Library");
      return false;
    }

    const requestedPermission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!requestedPermission.granted) {
      if (!requestedPermission.canAskAgain) {
        promptOpenSettings("Photo Library");
        return false;
      }
      Alert.alert(
        "Permission required",
        "Please allow photo library access to choose an avatar.",
      );
      return false;
    }

    return true;
  };

  const ensureCameraPermission = async () => {
    const currentPermission = await ImagePicker.getCameraPermissionsAsync();
    if (currentPermission.granted) {
      return true;
    }

    if (!currentPermission.canAskAgain) {
      promptOpenSettings("Camera");
      return false;
    }

    const requestedPermission =
      await ImagePicker.requestCameraPermissionsAsync();
    if (!requestedPermission.granted) {
      if (!requestedPermission.canAskAgain) {
        promptOpenSettings("Camera");
        return false;
      }
      Alert.alert(
        "Permission required",
        "Please allow camera access to take an avatar photo.",
      );
      return false;
    }

    return true;
  };

  const runAvatarAction = async (
    action: Exclude<PendingAvatarAction, null>,
  ) => {
    if (launchingAvatarAction) {
      return;
    }

    setLaunchingAvatarAction(true);
    try {
      if (Platform.OS === "ios") {
        await wait(120);
      }

      if (action === "gallery") {
        await launchGalleryPicker();
        return;
      }

      await launchCameraPicker();
    } finally {
      setLaunchingAvatarAction(false);
    }
  };

  const launchNativeAvatarAction = (action: "gallery" | "camera") => {
    if (updatingAvatar || launchingAvatarAction) {
      return;
    }

    setPendingAvatarAction(action);
    setShowAvatarMenu(false);
    setShowAvatarLibraryPicker(false);
  };

  const flushPendingAvatarAction = async () => {
    if (!pendingAvatarAction || launchingAvatarAction || updatingAvatar) {
      return;
    }

    const action = pendingAvatarAction;
    setPendingAvatarAction(null);
    await runAvatarAction(action);
  };

  const launchGalleryPicker = async () => {
    try {
      const hasPermission = await ensureMediaLibraryPermission();
      if (!hasPermission) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      const nextUri = result.assets?.[0]?.uri;
      if (!result.canceled && nextUri) {
        await saveAvatarUri(nextUri);
      }
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message || "Try again.");
    }
  };

  const launchCameraPicker = async () => {
    try {
      const hasPermission = await ensureCameraPermission();
      if (!hasPermission) {
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.front,
      });

      const nextUri = result.assets?.[0]?.uri;
      if (!result.canceled && nextUri) {
        await saveAvatarUri(nextUri);
      }
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message || "Try again.");
    }
  };

  useEffect(() => {
    // Warm permission checks on iOS so first picker launch feels less delayed.
    if (Platform.OS !== "ios") {
      return;
    }
    ImagePicker.getMediaLibraryPermissionsAsync().catch(() => {});
    ImagePicker.getCameraPermissionsAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const profile = await loadProfile();
      if (!profile) {
        router.replace("/");
        return;
      }

      setEmail(profile.email || "-");
      setFullName(profile.name);
      setDraftFullName(profile.name);
      setInitialFullName(profile.name);
      setPhoneNumber(profile.phoneNumber);
      setDraftPhoneNumber(profile.phoneNumber);
      setInitialPhoneNumber(profile.phoneNumber);
      setAddress(profile.address);
      setDraftAddress(profile.address);
      setInitialAddress(profile.address);
      setUsername(profile.username);
      setRole(profile.role);
      setAvatarLibraryKey(profile.avatarLibraryKey);
      setAvatarUri(profile.avatarUri);

      setReady(true);
    };

    checkSession();
  }, [router]);

  if (!ready) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets
      >
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: theme.name === "dark" ? "#1f2937" : "#e5edff",
              borderColor: theme.name === "dark" ? "#374151" : "#bfdbfe",
            },
            pressed && styles.backButtonPressed,
          ]}
          onPress={handleBackToSettings}
          hitSlop={10}
        >
          <Text
            style={[
              styles.backButtonText,
              { color: theme.name === "dark" ? "#f9fafb" : "#1e3a8a" },
            ]}
          >
            Back to Settings
          </Text>
        </Pressable>

        <Text style={[styles.title, { color: theme.text }]}>Edit Profile</Text>
        {/* <Text style={[styles.message, { color: theme.secondaryText }]}>
          Edit profile page is ready.
        </Text> */}

        <Modal
          visible={showAvatarMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAvatarMenu(false)}
          onDismiss={() => {
            if (pendingAvatarAction) {
              void flushPendingAvatarAction();
            }
          }}
        >
          <View style={styles.avatarMenuOverlay}>
            <Pressable
              style={styles.avatarMenuBackdrop}
              onPress={() => setShowAvatarMenu(false)}
            />
            <View
              style={[
                styles.avatarMenu,
                {
                  backgroundColor:
                    theme.name === "dark" ? "#111827" : "#ffffff",
                  borderColor: theme.border,
                },
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.avatarMenuItem,
                  pressed && styles.avatarMenuItemPressed,
                ]}
                onPress={() => {
                  launchNativeAvatarAction("gallery");
                }}
                disabled={updatingAvatar || launchingAvatarAction}
              >
                <Text
                  style={[styles.avatarMenuItemText, { color: theme.text }]}
                >
                  Upload avatar
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.avatarMenuItem,
                  pressed && styles.avatarMenuItemPressed,
                ]}
                onPress={() => {
                  launchNativeAvatarAction("camera");
                }}
                disabled={updatingAvatar || launchingAvatarAction}
              >
                <Text
                  style={[styles.avatarMenuItemText, { color: theme.text }]}
                >
                  Take picture
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.avatarMenuItem,
                  pressed && styles.avatarMenuItemPressed,
                ]}
                onPress={() => {
                  setPendingLibraryKey(avatarLibraryKey);
                  setShowAvatarMenu(false);
                  setShowAvatarLibraryPicker(true);
                }}
                disabled={updatingAvatar}
              >
                <Text
                  style={[styles.avatarMenuItemText, { color: theme.text }]}
                >
                  Choose avatar
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.avatarMenuItem,
                  pressed && styles.avatarMenuItemPressed,
                ]}
                onPress={() => setShowAvatarMenu(false)}
                disabled={updatingAvatar}
              >
                <Text style={[styles.avatarMenuItemText, { color: "#dc2626" }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showAvatarLibraryPicker}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setPendingLibraryKey(null);
            setShowAvatarLibraryPicker(false);
          }}
        >
          <View style={styles.avatarMenuOverlay}>
            <Pressable
              style={styles.avatarMenuBackdrop}
              onPress={() => {
                setPendingLibraryKey(null);
                setShowAvatarLibraryPicker(false);
              }}
            />
            <View
              style={[
                styles.avatarLibraryPicker,
                {
                  backgroundColor:
                    theme.name === "dark" ? "#111827" : "#ffffff",
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[styles.avatarLibraryPickerTitle, { color: theme.text }]}
              >
                Choose an avatar
              </Text>
              <View style={styles.avatarLibraryGrid}>
                {AVATAR_LIBRARY_OPTIONS.map((item) => {
                  const selected = pendingLibraryKey
                    ? pendingLibraryKey === item.key
                    : normalizedAvatarLibraryKey === item.key;
                  const option = getAvatarOptionByKey(item.key);

                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.avatarLibraryItem,
                        {
                          backgroundColor:
                            theme.name === "dark" ? "#111827" : "#f8fbff",
                          borderColor:
                            theme.name === "dark" ? "#374151" : "#bfdbfe",
                        },
                        selected && styles.avatarLibraryItemSelected,
                        selected && {
                          backgroundColor:
                            theme.name === "dark" ? "#1f2937" : "#eff6ff",
                          borderColor:
                            theme.name === "dark" ? "#60a5fa" : "#2563eb",
                        },
                      ]}
                      onPress={() => setPendingLibraryKey(item.key)}
                      disabled={updatingAvatar}
                    >
                      <View
                        style={[
                          styles.avatarLibraryPreviewFrame,
                          {
                            backgroundColor:
                              theme.name === "dark" ? "#111827" : "#f8fbff",
                          },
                        ]}
                      >
                        <Image
                          source={option?.source || currentLibraryAvatarSource}
                          style={styles.avatarImage}
                        />
                      </View>
                      <Text
                        style={[
                          styles.avatarLibraryItemText,
                          {
                            color:
                              theme.name === "dark" ? "#f9fafb" : "#1e3a8a",
                          },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.confirmButtonPressed,
                  !pendingLibraryKey && styles.confirmButtonDisabled,
                ]}
                onPress={() => {
                  if (pendingLibraryKey) {
                    handleSelectLibraryAvatar(pendingLibraryKey);
                  }
                }}
                disabled={updatingAvatar || !pendingLibraryKey}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.cancelButtonPressed,
                ]}
                onPress={() => {
                  setPendingLibraryKey(null);
                  setShowAvatarLibraryPicker(false);
                }}
                disabled={updatingAvatar}
              >
                <Text style={[styles.cancelButtonText, { color: "#dc2626" }]}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View
          style={[
            styles.infoCard,
            {
              borderColor: theme.border,
              backgroundColor: theme.name === "dark" ? "#111827" : "#ffffff",
            },
          ]}
        >
          <View style={styles.profileAvatarRow}>
            <View style={styles.avatarShell}>
              <View
                style={[styles.avatarFrame, { backgroundColor: theme.surface }]}
              >
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Image
                    source={currentLibraryAvatarSource}
                    style={styles.avatarImage}
                  />
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.editIconButton,
                  {
                    backgroundColor:
                      theme.name === "dark" ? "#1f2937" : "#ffffff",
                    borderColor: theme.name === "dark" ? "#374151" : "#cbd5e1",
                  },
                  pressed && styles.editIconButtonPressed,
                ]}
                onPress={() => setShowAvatarMenu(true)}
                hitSlop={10}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={16}
                  color={theme.name === "dark" ? "#f9fafb" : "#1e3a8a"}
                />
              </Pressable>
            </View>
          </View>

          <View style={[styles.fullNameHeaderRow, styles.fieldLabelSpacing]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>
              Full Name
            </Text>
            {!isEditingFullName ? (
              <Pressable
                style={({ pressed }) => [
                  styles.editNameButton,
                  {
                    backgroundColor:
                      theme.name === "dark" ? "#374151" : "#dbeafe",
                    borderColor: theme.name === "dark" ? "#4b5563" : "#93c5fd",
                  },
                  pressed && styles.editNameButtonPressed,
                ]}
                onPress={() => {
                  setDraftFullName(fullName);
                  setIsEditingPhoneNumber(false);
                  setIsEditingAddress(false);
                  setIsEditingFullName(true);
                }}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={14}
                  color={theme.name === "dark" ? "#f9fafb" : "#1e3a8a"}
                />
              </Pressable>
            ) : null}
          </View>

          {isEditingFullName ? (
            <>
              <TextInput
                style={[
                  styles.fieldInput,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor:
                      theme.name === "dark" ? "#0f172a" : "#f8fafc",
                  },
                ]}
                placeholder="Enter your full name"
                placeholderTextColor={theme.secondaryText}
                value={draftFullName}
                onChangeText={setDraftFullName}
                editable={!savingFullName}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSaveFullName}
              />
              <View style={styles.fullNameActionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.nameActionButton,
                    {
                      backgroundColor:
                        savingFullName || draftFullName.trim().length === 0
                          ? theme.name === "dark"
                            ? "#1f2937"
                            : "#bfdbfe"
                          : "#2563eb",
                      borderColor:
                        savingFullName || draftFullName.trim().length === 0
                          ? theme.name === "dark"
                            ? "#374151"
                            : "#93c5fd"
                          : "#2563eb",
                    },
                    pressed &&
                      !(savingFullName || draftFullName.trim().length === 0) &&
                      styles.nameActionButtonPressed,
                  ]}
                  onPress={handleSaveFullName}
                  disabled={savingFullName || draftFullName.trim().length === 0}
                >
                  <Text
                    style={[
                      styles.nameActionButtonText,
                      {
                        color:
                          savingFullName || draftFullName.trim().length === 0
                            ? theme.name === "dark"
                              ? "#9ca3af"
                              : "#475569"
                            : "#ffffff",
                      },
                    ]}
                  >
                    {savingFullName ? "Saving..." : "Confirm"}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.nameActionButton,
                    {
                      backgroundColor:
                        theme.name === "dark" ? "#1f2937" : "#e2e8f0",
                      borderColor:
                        theme.name === "dark" ? "#374151" : "#cbd5e1",
                    },
                    pressed && styles.nameActionButtonPressed,
                  ]}
                  onPress={() => {
                    setDraftFullName(fullName);
                    setIsEditingFullName(false);
                  }}
                  disabled={savingFullName}
                >
                  <Text
                    style={[
                      styles.nameActionButtonText,
                      { color: theme.name === "dark" ? "#f3f4f6" : "#0f172a" },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={[styles.fieldValue, { color: theme.text }]}>
              {fullName || "-"}
            </Text>
          )}

          <Text
            style={[
              styles.fieldLabel,
              styles.fieldLabelSpacing,
              { color: theme.secondaryText },
            ]}
          >
            Email
          </Text>
          <Text style={[styles.fieldValue, { color: theme.text }]}>
            {email}
          </Text>

          <View style={[styles.fullNameHeaderRow, styles.fieldLabelSpacing]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>
              Phone Number
            </Text>
            {!isEditingPhoneNumber ? (
              <Pressable
                style={({ pressed }) => [
                  styles.editNameButton,
                  {
                    backgroundColor:
                      theme.name === "dark" ? "#374151" : "#dbeafe",
                    borderColor: theme.name === "dark" ? "#4b5563" : "#93c5fd",
                  },
                  pressed && styles.editNameButtonPressed,
                ]}
                onPress={() => {
                  setDraftPhoneNumber(phoneNumber === "N/A" ? "" : phoneNumber);
                  setIsEditingFullName(false);
                  setIsEditingAddress(false);
                  setIsEditingPhoneNumber(true);
                }}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={14}
                  color={theme.name === "dark" ? "#f9fafb" : "#1e3a8a"}
                />
              </Pressable>
            ) : null}
          </View>

          {isEditingPhoneNumber ? (
            <>
              <TextInput
                style={[
                  styles.fieldInput,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor:
                      theme.name === "dark" ? "#0f172a" : "#f8fafc",
                  },
                ]}
                placeholder="Enter your phone number"
                placeholderTextColor={theme.secondaryText}
                value={draftPhoneNumber}
                onChangeText={setDraftPhoneNumber}
                editable={!savingPhoneNumber}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={handleSavePhoneNumber}
              />
              <View style={styles.fullNameActionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.nameActionButton,
                    {
                      backgroundColor: savingPhoneNumber
                        ? "#93c5fd"
                        : "#2563eb",
                      borderColor: savingPhoneNumber ? "#93c5fd" : "#2563eb",
                    },
                    pressed &&
                      !savingPhoneNumber &&
                      styles.nameActionButtonPressed,
                  ]}
                  onPress={handleSavePhoneNumber}
                  disabled={savingPhoneNumber}
                >
                  <Text
                    style={[
                      styles.nameActionButtonText,
                      {
                        color: savingPhoneNumber
                          ? theme.name === "dark"
                            ? "#9ca3af"
                            : "#475569"
                          : "#ffffff",
                      },
                    ]}
                  >
                    {savingPhoneNumber ? "Saving..." : "Confirm"}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.nameActionButton,
                    {
                      backgroundColor:
                        theme.name === "dark" ? "#1f2937" : "#e2e8f0",
                      borderColor:
                        theme.name === "dark" ? "#374151" : "#cbd5e1",
                    },
                    pressed && styles.nameActionButtonPressed,
                  ]}
                  onPress={() => {
                    setDraftPhoneNumber(
                      phoneNumber === "N/A" ? "" : phoneNumber,
                    );
                    setIsEditingPhoneNumber(false);
                  }}
                  disabled={savingPhoneNumber}
                >
                  <Text
                    style={[
                      styles.nameActionButtonText,
                      { color: theme.name === "dark" ? "#f3f4f6" : "#0f172a" },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={[styles.fieldValue, { color: theme.text }]}>
              {phoneNumber || "N/A"}
            </Text>
          )}

          <View style={[styles.fullNameHeaderRow, styles.fieldLabelSpacing]}>
            <Text style={[styles.fieldLabel, { color: theme.secondaryText }]}>
              Address
            </Text>
            {!isEditingAddress ? (
              <Pressable
                style={({ pressed }) => [
                  styles.editNameButton,
                  {
                    backgroundColor:
                      theme.name === "dark" ? "#374151" : "#dbeafe",
                    borderColor: theme.name === "dark" ? "#4b5563" : "#93c5fd",
                  },
                  pressed && styles.editNameButtonPressed,
                ]}
                onPress={() => {
                  setDraftAddress(address === "N/A" ? "" : address);
                  setIsEditingFullName(false);
                  setIsEditingPhoneNumber(false);
                  setIsEditingAddress(true);
                }}
              >
                <MaterialCommunityIcons
                  name="pencil"
                  size={14}
                  color={theme.name === "dark" ? "#f9fafb" : "#1e3a8a"}
                />
              </Pressable>
            ) : null}
          </View>

          {isEditingAddress ? (
            <>
              <TextInput
                style={[
                  styles.fieldInput,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor:
                      theme.name === "dark" ? "#0f172a" : "#f8fafc",
                  },
                ]}
                placeholder="Enter your address"
                placeholderTextColor={theme.secondaryText}
                value={draftAddress}
                onChangeText={setDraftAddress}
                editable={!savingAddress}
                returnKeyType="done"
                onSubmitEditing={handleSaveAddress}
              />
              <View style={styles.fullNameActionRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.nameActionButton,
                    {
                      backgroundColor: savingAddress ? "#93c5fd" : "#2563eb",
                      borderColor: savingAddress ? "#93c5fd" : "#2563eb",
                    },
                    pressed && !savingAddress && styles.nameActionButtonPressed,
                  ]}
                  onPress={handleSaveAddress}
                  disabled={savingAddress}
                >
                  <Text
                    style={[
                      styles.nameActionButtonText,
                      {
                        color: savingAddress
                          ? theme.name === "dark"
                            ? "#9ca3af"
                            : "#475569"
                          : "#ffffff",
                      },
                    ]}
                  >
                    {savingAddress ? "Saving..." : "Confirm"}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.nameActionButton,
                    {
                      backgroundColor:
                        theme.name === "dark" ? "#1f2937" : "#e2e8f0",
                      borderColor:
                        theme.name === "dark" ? "#374151" : "#cbd5e1",
                    },
                    pressed && styles.nameActionButtonPressed,
                  ]}
                  onPress={() => {
                    setDraftAddress(address === "N/A" ? "" : address);
                    setIsEditingAddress(false);
                  }}
                  disabled={savingAddress}
                >
                  <Text
                    style={[
                      styles.nameActionButtonText,
                      { color: theme.name === "dark" ? "#f3f4f6" : "#0f172a" },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={[styles.fieldValue, { color: theme.text }]}>
              {address || "N/A"}
            </Text>
          )}

          <Text
            style={[
              styles.fieldLabel,
              styles.fieldLabelSpacing,
              { color: theme.secondaryText },
            ]}
          >
            Username
          </Text>
          <Text style={[styles.fieldValue, { color: theme.text }]}>
            {username}
          </Text>

          <Text
            style={[
              styles.fieldLabel,
              styles.fieldLabelSpacing,
              { color: theme.secondaryText },
            ]}
          >
            Role
          </Text>
          <Text style={[styles.fieldValue, { color: theme.text }]}>{role}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerContent: {
    justifyContent: "flex-start",
    alignItems: "flex-start",
    padding: 24,
    paddingTop: 60,
    position: "relative",
    paddingBottom: 36,
  },
  backButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#e5edff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: 18,
  },
  backButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  backButtonText: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    marginBottom: 16,
  },
  avatarShell: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  profileAvatarRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  avatarFrame: {
    width: 120,
    height: 120,
    borderRadius: 999,
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  editIconButton: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  editIconButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  avatarMenuOverlay: {
    position: "absolute",
    inset: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  avatarMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  avatarMenu: {
    width: "84%",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    zIndex: 11,
  },
  avatarMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  avatarMenuItemPressed: {
    opacity: 0.8,
  },
  avatarMenuItemText: {
    fontSize: 14,
    fontWeight: "700",
  },
  avatarLibraryPicker: {
    width: "96%",
    maxHeight: "80%",
    minHeight: 380,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    zIndex: 11,
  },
  avatarLibraryPickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5e7eb",
  },
  cancelButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  confirmButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  confirmButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  confirmButtonDisabled: {
    backgroundColor: "#93c5fd",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  avatarImage: {
    width: 84,
    height: 84,
    resizeMode: "contain",
  },
  avatarActionsRow: {
    width: "100%",
    gap: 10,
    marginBottom: 14,
  },
  avatarActionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  avatarActionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  avatarActionButtonText: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "700",
  },
  avatarLibrarySection: {
    width: "100%",
  },
  avatarLibraryTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  avatarLibraryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  avatarLibraryItem: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    backgroundColor: "#f8fbff",
  },
  avatarLibraryItemSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  avatarLibraryPreviewFrame: {
    width: 56,
    height: 56,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLibraryItemText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  infoCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 0,
  },
  fieldLabelSpacing: {
    marginTop: 12,
  },
  fullNameHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 24,
  },
  editNameButton: {
    borderWidth: 1,
    borderRadius: 10,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    overflow: "hidden",
  },
  editNameButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  editNameButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  fieldInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: "600",
  },
  fullNameActionRow: {
    width: "100%",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  nameActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nameActionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nameActionButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: "700",
  },
});
