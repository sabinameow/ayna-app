import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type {
  Appointment,
  Article,
  CyclePrediction,
  PatientProfile,
} from "@/types/api";
import { formatDate } from "@/utils/format";

type ShortcutKey = "doctors" | "meds" | "appts";

const SHORTCUTS: { key: ShortcutKey; icon: "user" | "package" | "calendar"; label: string; color: string }[] = [
  { key: "doctors", icon: "user", label: "Top Doctors", color: "#E53F8F" },
  { key: "meds", icon: "package", label: "Medications", color: "#E53F8F" },
  { key: "appts", icon: "calendar", label: "Appointments", color: "#E53F8F" },
];

export function PatientHomeScreen() {
  const { accessToken } = useAuth();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [nextProfile, nextPrediction, nextAppointments, nextArticles] = await Promise.all([
        api.patientProfile(accessToken),
        api.cyclePrediction(accessToken).catch(() => null),
        api.patientAppointments(accessToken),
        api.articles(accessToken).catch(() => []),
      ]);
      setProfile(nextProfile);
      setPrediction(nextPrediction);
      setAppointments(nextAppointments);
      setArticles(nextArticles);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }, [accessToken]);
  useFocusReload(load);

  function handleShortcut(key: ShortcutKey) {
    if (key === "doctors" || key === "appts") {
      navigation.navigate("PatientAppointments");
    } else if (key === "meds") {
      navigation.navigate("Medications");
    }
  }

  const firstName = profile?.full_name.split(" ")[0] ?? "there";
  const upcoming = appointments.find((a) => a.status !== "completed" && a.status !== "cancelled");

  return (
    <AppScreen>
      {/* Greeting header */}
      <View style={styles.greetRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>welcome !</Text>
          <Text style={styles.nameText}>{profile?.full_name ?? "Patient"}</Text>
          <Text style={styles.subText}>How is it going today ?</Text>
        </View>
        <NotificationBell />
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color="#B0A8B9" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search doctor, advice..."
          placeholderTextColor="#B0A8B9"
          style={styles.searchInput}
        />
      </View>

      {/* Shortcut row */}
      <View style={styles.shortcutRow}>
        {SHORTCUTS.map((s) => (
          <Pressable key={s.key} style={styles.shortcut} onPress={() => handleShortcut(s.key)}>
            <View style={styles.shortcutIcon}>
              <Feather name={s.icon} size={20} color={s.color} />
            </View>
            <Text style={styles.shortcutLabel}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Cycle hero */}
      <GlassCard style={styles.cycleHero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cycleEyebrow}>Next period</Text>
          <Text style={styles.cycleDate}>
            {prediction ? formatDate(prediction.predicted_start_date) : "Add cycle data"}
          </Text>
          <Text style={styles.cycleMeta}>
            Avg cycle · {prediction?.average_cycle_length ?? profile?.average_cycle_length ?? "--"} days
          </Text>
        </View>
        <View style={styles.cycleRing}>
          <View style={styles.cycleRingInner}>
            <Text style={styles.cycleRingValue}>
              {prediction?.average_cycle_length ?? "--"}
            </Text>
            <Text style={styles.cycleRingLabel}>days</Text>
          </View>
        </View>
      </GlassCard>

      {/* Next appointment */}
      {upcoming && (
        <Pressable onPress={() => navigation.navigate("PatientAppointments")}>
          <GlassCard style={styles.apptCard}>
            <View style={styles.apptIconBox}>
              <Feather name="calendar" size={18} color="#E53F8F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.apptLabel}>Next consultation</Text>
              <Text style={styles.apptDate}>{formatDate(upcoming.scheduled_at)}</Text>
              <Text style={styles.apptMeta}>{upcoming.reason || "General consultation"}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#E53F8F" />
          </GlassCard>
        </Pressable>
      )}

      {/* Health articles */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Health article</Text>
        <Text style={styles.sectionLink}>See all</Text>
      </View>

      {articles.length ? (
        articles.slice(0, 3).map((article) => (
          <Pressable
            key={article.id}
            onPress={() => navigation.navigate("Article", { article })}
            accessibilityRole="button"
            accessibilityLabel={article.title}
          >
            <GlassCard style={styles.articleCard}>
              <View style={[styles.articleImage, styles.articleImagePlaceholder]}>
                <Feather name="file-text" size={20} color="#E53F8F" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.articleTitle} numberOfLines={2}>
                  {article.title}
                </Text>
                <Text style={styles.articleMeta}>5 min read</Text>
              </View>
            </GlassCard>
          </Pressable>
        ))
      ) : (
        <GlassCard>
          <Text style={styles.empty}>Articles will appear here when available.</Text>
        </GlassCard>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#E53F8F" },
  welcomeText: { fontSize: 13, color: "#7F7486" },
  nameText: { fontSize: 22, fontWeight: "800", color: "#231F29", marginTop: 2 },
  subText: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#E53F8F",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: { flex: 1, color: "#231F29", fontSize: 14 },
  shortcutRow: { flexDirection: "row", justifyContent: "space-around" },
  shortcut: { alignItems: "center", gap: 6 },
  shortcutIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: { fontSize: 12, color: "#231F29", fontWeight: "600" },
  cycleHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FCE4EF",
  },
  cycleEyebrow: { fontSize: 12, color: "#A94D7A", fontWeight: "700" },
  cycleDate: { fontSize: 20, fontWeight: "800", color: "#231F29", marginTop: 4 },
  cycleMeta: { fontSize: 12, color: "#7F7486", marginTop: 4 },
  cycleRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 6,
    borderColor: "#E53F8F",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cycleRingInner: { alignItems: "center" },
  cycleRingValue: { fontSize: 20, fontWeight: "800", color: "#E53F8F" },
  cycleRingLabel: { fontSize: 10, color: "#7F7486" },
  apptCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  apptIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  apptLabel: { fontSize: 12, color: "#7F7486", fontWeight: "600" },
  apptDate: { fontSize: 16, fontWeight: "800", color: "#231F29", marginTop: 2 },
  apptMeta: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#231F29" },
  sectionLink: { fontSize: 13, color: "#E53F8F", fontWeight: "700" },
  articleCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  articleImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: "#FCE4EF" },
  articleImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  articleTitle: { fontSize: 13, fontWeight: "700", color: "#231F29" },
  articleMeta: { fontSize: 11, color: "#7F7486", marginTop: 4 },
  empty: { color: "#7F7486" },
  error: { color: "#E25555" },
});
