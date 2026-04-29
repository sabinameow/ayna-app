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
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <View style={[chipStyles.chip, { backgroundColor: c.bg }]}>
      <Text style={[chipStyles.text, { color: c.text }]}>{status}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  text: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});

function TabBar({
  active,
  onChange,
  counts,
}: {
  active: TabFilter;
  onChange: (t: TabFilter) => void;
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
    <View style={tabStyles.row}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => onChange(t.key)}
          style={[tabStyles.tab, active === t.key && tabStyles.tabActive]}
        >
          <Text style={[tabStyles.label, active === t.key && tabStyles.labelActive]}>
            {t.label}
          </Text>
          {counts[t.key] > 0 && (
            <View style={[tabStyles.badge, active === t.key && tabStyles.badgeActive]}>
              <Text style={[tabStyles.badgeText, active === t.key && tabStyles.badgeTextActive]}>
                {counts[t.key]}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" },
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
  label: { fontSize: 13, fontWeight: "600", color: "#7F7486" },
  labelActive: { color: "#FFFFFF" },
  badge: { backgroundColor: "#D9E1FF", borderRadius: 999, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#3F6CF6" },
  badgeTextActive: { color: "#FFF" },
});

function apptTime(scheduled_at: string) {
  return new Date(scheduled_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function DoctorAppointmentsScreen() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  const load = useCallback(() => {
    if (!accessToken) return;
    void api.doctorAppointments(accessToken).then(setAppointments).catch(() => undefined);
  }, [accessToken]);
  useFocusReload(load);

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
      today: appointments.filter((a) => new Date(a.scheduled_at).toDateString() === todayStr).length,
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
        <Text style={styles.subtitle}>Clinical schedule and visit context</Text>
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} counts={counts} />

      {filtered.length ? (
        filtered.map((appt) => {
          const isToday = new Date(appt.scheduled_at).toDateString() === todayStr;
          return (
            <GlassCard
              key={appt.id}
              style={[styles.card, isToday && styles.cardToday]}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={styles.dateRow}>
                    {isToday && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayText}>Today</Text>
                      </View>
                    )}
                    <Text style={styles.dateText}>{formatDate(appt.scheduled_at)}</Text>
                  </View>
                  <Text style={styles.timeText}>{apptTime(appt.scheduled_at)}</Text>
                </View>
                <StatusChip status={appt.status} />
              </View>

              <View style={styles.divider} />

              <View style={styles.reasonRow}>
                <Feather name="file-text" size={14} color="#7F7486" />
                <Text style={styles.reasonText}>
                  {appt.reason || "General consultation"}
                </Text>
              </View>

              {appt.notes ? (
                <View style={styles.notesRow}>
                  <Feather name="message-square" size={14} color="#7F7486" />
                  <Text style={styles.notesText}>{appt.notes}</Text>
                </View>
              ) : null}
            </GlassCard>
          );
        })
      ) : (
        <GlassCard>
          <Text style={styles.empty}>
            {activeTab === "today"
              ? "No appointments today."
              : activeTab === "pending"
              ? "No pending appointments."
              : "No appointments in this category."}
          </Text>
        </GlassCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  subtitle: { fontSize: 13, color: "#7F7486", marginTop: 4 },
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
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#D9E1FF", marginVertical: 12 },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  reasonText: { color: "#231F29", fontWeight: "600", fontSize: 14, flex: 1 },
  notesRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8 },
  notesText: { color: "#7F7486", fontSize: 13, flex: 1 },
  empty: { color: "#7F7486", fontSize: 14 },
});
