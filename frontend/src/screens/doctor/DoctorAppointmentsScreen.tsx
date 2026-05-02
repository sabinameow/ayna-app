import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { Appointment, AppointmentStatus } from "@/types/api";
import { formatDate } from "@/utils/format";

type TabFilter = "all" | "today" | "upcoming" | "pending" | "completed";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: "#E8F7EE", text: "#2C8C5A" },
  cancelled: { bg: "#FBE7E7", text: "#B44747" },
  completed: { bg: "#EAF0FF", text: "#3356C4" },
  pending: { bg: "#FFF4E8", text: "#9B5E11" },
};

function StatusChip({ status }: { status: AppointmentStatus }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <View style={[chipStyles.chip, { backgroundColor: colors.bg }]}>
      <Text style={[chipStyles.text, { color: colors.text }]}>{status}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});

function apptTime(scheduledAt: string) {
  return new Date(scheduledAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function DoctorAppointmentsScreen() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const nextAppointments = await api.doctorAppointments(accessToken);
      setAppointments(nextAppointments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);
  useFocusReload(load);

  async function updateStatus(appointmentId: string, status: AppointmentStatus) {
    if (!accessToken || updatingId) return;
    setUpdatingId(appointmentId);
    setError("");
    try {
      await api.updateDoctorAppointmentStatus(accessToken, appointmentId, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update appointment");
    } finally {
      setUpdatingId(null);
    }
  }

  const todayStr = new Date().toDateString();

  const filtered = useMemo(() => {
    const sorted = [...appointments].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
    switch (activeTab) {
      case "today":
        return sorted.filter((a) => new Date(a.scheduled_at).toDateString() === todayStr);
      case "upcoming":
        return sorted.filter(
          (a) =>
            new Date(a.scheduled_at) > new Date() &&
            new Date(a.scheduled_at).toDateString() !== todayStr
        );
      case "pending":
        return sorted.filter((a) => a.status === "pending");
      case "completed":
        return sorted.filter((a) => a.status === "completed");
      default:
        return sorted;
    }
  }, [appointments, activeTab, todayStr]);

  const counts: Record<TabFilter, number> = useMemo(
    () => ({
      all: appointments.length,
      today: appointments.filter((a) => new Date(a.scheduled_at).toDateString() === todayStr)
        .length,
      upcoming: appointments.filter(
        (a) =>
          new Date(a.scheduled_at) > new Date() &&
          new Date(a.scheduled_at).toDateString() !== todayStr
      ).length,
      pending: appointments.filter((a) => a.status === "pending").length,
      completed: appointments.filter((a) => a.status === "completed").length,
    }),
    [appointments, todayStr]
  );

  return (
    <AppScreen>
      <View style={styles.header}>
        <Text style={styles.title}>My appointments</Text>
        <Text style={styles.subtitle}>Clinical schedule and patient bookings</Text>
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} counts={counts} />

      {filtered.length ? (
        filtered.map((appointment) => {
          const isToday = new Date(appointment.scheduled_at).toDateString() === todayStr;
          const isUpdating = updatingId === appointment.id;
          const symptomNames = appointment.symptom_names ?? [];
          const suggestedLabs = appointment.lab_recommendations ?? appointment.required_tests ?? [];
          return (
            <GlassCard key={appointment.id} style={[styles.card, isToday && styles.cardToday]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.dateRow}>
                    {isToday ? (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayText}>Today</Text>
                      </View>
                    ) : null}
                    <Text style={styles.dateText}>{formatDate(appointment.scheduled_at)}</Text>
                  </View>
                  <Text style={styles.timeText}>{apptTime(appointment.scheduled_at)}</Text>
                  <Text style={styles.patientText}>
                    {appointment.patient_name || "Patient"}
                  </Text>
                </View>
                <StatusChip status={appointment.status} />
              </View>

              <View style={styles.divider} />

              <View style={styles.reasonRow}>
                <Feather name="file-text" size={14} color="#7F7486" />
                <Text style={styles.reasonText}>
                  {appointment.reason || "General consultation"}
                </Text>
              </View>

              {appointment.notes ? (
                <View style={styles.notesRow}>
                  <Feather name="message-square" size={14} color="#7F7486" />
                  <Text style={styles.notesText}>{appointment.notes}</Text>
                </View>
              ) : null}

              {symptomNames.length ? (
                <View style={styles.infoSection}>
                  <Text style={styles.infoTitle}>Patient symptoms</Text>
                  <View style={styles.tagWrap}>
                    {symptomNames.map((symptomName) => (
                      <View key={symptomName} style={styles.infoTag}>
                        <Text style={styles.infoTagText}>{symptomName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {suggestedLabs.length ? (
                <View style={styles.infoSection}>
                  <Text style={styles.infoTitle}>Suggested pre-visit tests</Text>
                  <View style={styles.labList}>
                    {suggestedLabs.map((lab) => (
                      <View key={lab.name} style={styles.labItem}>
                        <Text style={styles.labName}>{lab.name}</Text>
                        <Text style={styles.labReason}>{lab.reason}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                {appointment.status === "pending" ? (
                  <ActionButton
                    label={isUpdating ? "Saving..." : "Confirm"}
                    tone="success"
                    disabled={isUpdating}
                    onPress={() => void updateStatus(appointment.id, "confirmed")}
                  />
                ) : null}
                {(appointment.status === "pending" || appointment.status === "confirmed") ? (
                  <ActionButton
                    label={isUpdating ? "Saving..." : "Cancel"}
                    tone="danger"
                    disabled={isUpdating}
                    onPress={() => void updateStatus(appointment.id, "cancelled")}
                  />
                ) : null}
                {appointment.status === "confirmed" ? (
                  <ActionButton
                    label={isUpdating ? "Saving..." : "Complete"}
                    tone="primary"
                    disabled={isUpdating}
                    onPress={() => void updateStatus(appointment.id, "completed")}
                  />
                ) : null}
              </View>
            </GlassCard>
          );
        })
      ) : (
        <GlassCard>
          <Text style={styles.empty}>
            {loading
              ? "Loading appointments..."
              : activeTab === "today"
              ? "No appointments today."
              : activeTab === "pending"
              ? "No pending appointments."
              : "No appointments in this category."}
          </Text>
        </GlassCard>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

function ActionButton({
  label,
  onPress,
  tone,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone: "primary" | "success" | "danger";
  disabled?: boolean;
}) {
  const toneStyle =
    tone === "success"
      ? actionStyles.success
      : tone === "danger"
      ? actionStyles.danger
      : actionStyles.primary;
  const textStyle =
    tone === "success"
      ? actionStyles.successText
      : tone === "danger"
      ? actionStyles.dangerText
      : actionStyles.primaryText;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[actionStyles.base, toneStyle, disabled && actionStyles.disabled]}
    >
      <Text style={[actionStyles.label, textStyle]}>{label}</Text>
    </Pressable>
  );
}

const actionStyles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primary: { backgroundColor: "#EAF0FF" },
  success: { backgroundColor: "#F0ECFF" },
  danger: { backgroundColor: "#FBE7E7" },
  label: { fontSize: 12, fontWeight: "700" },
  primaryText: { color: "#3356C4" },
  successText: { color: "#6D5BD0" },
  dangerText: { color: "#B44747" },
  disabled: { opacity: 0.6 },
});

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: TabFilter;
  onChange: (tab: TabFilter) => void;
  counts: Record<TabFilter, number>;
}) {
  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "pending", label: "Pending" },
    { key: "completed", label: "Done" },
  ];

  return (
    <View style={styles.tabRow}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tab, active === tab.key && styles.tabActive]}
        >
          <Text style={[styles.tabText, active === tab.key && styles.tabTextActive]}>
            {tab.label}
          </Text>
          {counts[tab.key] > 0 ? (
            <View style={[styles.badge, active === tab.key && styles.badgeActive]}>
              <Text style={[styles.badgeText, active === tab.key && styles.badgeTextActive]}>
                {counts[tab.key]}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  subtitle: { fontSize: 13, color: "#7F7486", marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2F4F8",
  },
  tabActive: { backgroundColor: "#3F6CF6" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#7F7486" },
  tabTextActive: { color: "#FFFFFF" },
  badge: {
    backgroundColor: "#D9E1FF",
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#3F6CF6" },
  badgeTextActive: { color: "#FFF" },
  card: { marginBottom: 12 },
  cardToday: { backgroundColor: "#EAF0FF", borderWidth: 1, borderColor: "#C4D3FF" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  todayBadge: {
    backgroundColor: "#3F6CF6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  dateText: { color: "#7F7486", fontSize: 13 },
  timeText: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  patientText: { marginTop: 6, fontSize: 13, fontWeight: "700", color: "#231F29" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#D9E1FF", marginVertical: 12 },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  reasonText: { color: "#231F29", fontWeight: "600", fontSize: 14, flex: 1 },
  notesRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  notesText: { color: "#7F7486", fontSize: 13, flex: 1 },
  infoSection: { marginTop: 12, gap: 8 },
  infoTitle: { fontSize: 13, fontWeight: "800", color: "#231F29" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFF8FB",
    borderWidth: 1,
    borderColor: "#ECD6E2",
  },
  infoTagText: { fontSize: 12, fontWeight: "600", color: "#7F7486" },
  labList: { gap: 8 },
  labItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#D9E1FF",
  },
  labName: { fontSize: 13, fontWeight: "800", color: "#231F29" },
  labReason: { marginTop: 4, fontSize: 12, lineHeight: 18, color: "#7F7486" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  empty: { color: "#7F7486", fontSize: 14 },
  error: { color: "#E25555", fontSize: 13 },
});
