import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { PatientProfile, ProgressSummary } from "@/types/api";

type MenuRoute = "PatientCycle" | "PatientAppointments" | "PatientChat" | null;

const MENU_ITEMS: { icon: keyof typeof Feather.glyphMap; label: string; route: MenuRoute }[] = [
  { icon: "file-text", label: "Reports", route: "PatientCycle" },
  { icon: "calendar", label: "Appointments", route: "PatientAppointments" },
  { icon: "message-circle", label: "Chat support", route: "PatientChat" },
  { icon: "shield", label: "Privacy & Data", route: null },
];

export function PatientProfileScreen() {
  const { accessToken, logout } = useAuth();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cycleLength, setCycleLength] = useState("28");
  const [periodLength, setPeriodLength] = useState("5");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [nextProfile, nextProgress] = await Promise.all([
        api.patientProfile(accessToken),
        api.patientProgress(accessToken).catch(() => null),
      ]);
      setProfile(nextProfile);
      setProgress(nextProgress);
      setFullName(nextProfile.full_name);
      setCycleLength(String(nextProfile.average_cycle_length));
      setPeriodLength(String(nextProfile.average_period_length));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    }
  }, [accessToken]);
  useFocusReload(load);

  async function save() {
    if (!accessToken) return;
    await api.updatePatientProfile(accessToken, {
      full_name: fullName,
      average_cycle_length: Number(cycleLength),
      average_period_length: Number(periodLength),
    });
    setEditing(false);
    await load();
  }

  return (
    <AppScreen>
      {/* Avatar header */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0).toUpperCase() ?? "P"}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? "Patient"}</Text>
      </View>

      {/* Stat triple */}
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Feather name="heart" size={20} color="#E53F8F" />
          <Text style={styles.statValue}>
            {progress?.total_symptoms_logged ?? 0}
          </Text>
          <Text style={styles.statLabel}>symptoms</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Feather name="droplet" size={20} color="#E53F8F" />
          <Text style={styles.statValue}>
            {profile?.average_cycle_length ?? "--"}
          </Text>
          <Text style={styles.statLabel}>cycle days</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Feather name="check-circle" size={20} color="#E53F8F" />
          <Text style={styles.statValue}>
            {progress?.completed_appointments ?? 0}
          </Text>
          <Text style={styles.statLabel}>visits</Text>
        </View>
      </View>

      {/* Menu */}
      <GlassCard style={styles.menuCard}>
        {MENU_ITEMS.map((item, idx) => (
          <View key={item.label}>
            <Pressable
              style={styles.menuRow}
              onPress={() => item.route && navigation.navigate(item.route)}
            >
              <View style={styles.menuIcon}>
                <Feather name={item.icon} size={16} color="#E53F8F" />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={18} color="#B0A8B9" />
            </Pressable>
            {idx < MENU_ITEMS.length - 1 && <View style={styles.menuDivider} />}
          </View>
        ))}

        <View style={styles.menuDivider} />
        <Pressable style={styles.menuRow} onPress={() => setEditing((v) => !v)}>
          <View style={styles.menuIcon}>
            <Feather name="edit-2" size={16} color="#E53F8F" />
          </View>
          <Text style={styles.menuLabel}>Edit profile</Text>
          <Feather name={editing ? "chevron-up" : "chevron-right"} size={18} color="#B0A8B9" />
        </Pressable>
      </GlassCard>

      {editing && (
        <GlassCard>
          <AppInput label="Full name" value={fullName} onChangeText={setFullName} />
          <AppInput
            label="Average cycle length"
            value={cycleLength}
            onChangeText={setCycleLength}
            keyboardType="number-pad"
          />
          <AppInput
            label="Average period length"
            value={periodLength}
            onChangeText={setPeriodLength}
            keyboardType="number-pad"
          />
          <PrimaryButton label="Save changes" onPress={save} />
        </GlassCard>
      )}

      <Pressable style={styles.logoutRow} onPress={logout}>
        <View style={styles.menuIcon}>
          <Feather name="log-out" size={16} color="#E53F8F" />
        </View>
        <Text style={styles.menuLabel}>Logout</Text>
        <Feather name="chevron-right" size={18} color="#B0A8B9" />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: "center", gap: 8 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  avatarText: { fontSize: 38, fontWeight: "800", color: "#E53F8F" },
  name: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  statRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#E53F8F" },
  statLabel: { fontSize: 11, color: "#7F7486" },
  statDivider: { width: 1, height: 32, backgroundColor: "#F0DCE7" },
  menuCard: { paddingVertical: 4 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#231F29" },
  menuDivider: { height: 1, backgroundColor: "#F5E5EE" },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 18,
  },
  error: { color: "#E25555" },
});
