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

type TabFilter = "today" | "upcoming" | "pending" | "cancelled" | "all";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  confirmed: { bg: "#E8F7EE", text: "#2C8C5A", border: "#B2DFC7" },
  cancelled: { bg: "#FBE7E7", text: "#B44747", border: "#F5C0C0" },
  completed: { bg: "#EAF0FF", text: "#3356C4", border: "#C4D3FF" },
  pending: { bg: "#FFF4E8", text: "#9B5E11", border: "#F5D5A8" },
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

function apptTime(scheduled_at: string) {
  return new Date(scheduled_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function ManagerAppointmentsScreen() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>("today");

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    const list = await api.managerAppointments(accessToken).catch(() => [] as Appointment[]);
    setAppointments(list);
  }, [accessToken]);
  useFocusReload(refresh);

  async function setStatus(id: string, status: string) {
    if (!accessToken) return;
    await api.updateManagerAppointment(accessToken, id, { status });
    await refresh();
  }

  async function remove(id: string) {
    if (!accessToken) return;
    await api.deleteManagerAppointment(accessToken, id);
    await refresh();
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
            new Date(a.scheduled_at).toDateString() !== todayStr &&
            a.status !== "cancelled"
        );
      case "pending":
        return sorted.filter((a) => a.status === "pending");
      case "cancelled":
        return sorted.filter((a) => a.status === "cancelled");
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
          new Date(a.scheduled_at).toDateString() !== todayStr &&
          a.status !== "cancelled"
      ).length,
      pending: appointments.filter((a) => a.status === "pending").length,
      cancelled: appointments.filter((a) => a.status === "cancelled").length,
    }),
    [appointments, todayStr]
  );

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "pending", label: "Pending" },
    { key: "cancelled", label: "Cancelled" },
    { key: "all", label: "All" },
  ];

  return (
    <AppScreen>
      <View style={styles.header}>
        <Text style={styles.title}>Appointment board</Text>
        <Text style={styles.subtitle}>Confirm, reschedule, or cancel bookings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {counts[tab.key] > 0 && (
              <View style={[styles.badge, activeTab === tab.key && styles.badgeActive]}>
                <Text style={[styles.badgeText, activeTab === tab.key && styles.badgeTextActive]}>
                  {counts[tab.key]}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {filtered.length ? (
        filtered.map((appt) => {
          const isToday = new Date(appt.scheduled_at).toDateString() === todayStr;
          const sc = STATUS_COLORS[appt.status] ?? STATUS_COLORS.pending;
          return (
            <GlassCard
              key={appt.id}
              style={[styles.card, { borderLeftWidth: 4, borderLeftColor: sc.border }]}
            >
              {/* Card top */}
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

              {/* Reason */}
              <View style={styles.infoRow}>
                <Feather name="file-text" size={13} color="#7F7486" />
                <Text style={styles.infoText}>{appt.reason || "General consultation"}</Text>
              </View>

              {appt.notes ? (
                <View style={styles.infoRow}>
                  <Feather name="message-square" size={13} color="#7F7486" />
                  <Text style={styles.infoText}>{appt.notes}</Text>
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.actions}>
                {appt.status !== "confirmed" && appt.status !== "completed" && (
                  <Pressable
                    onPress={() => setStatus(appt.id, "confirmed")}
                    style={styles.actionConfirm}
                  >
                    <Feather name="check" size={13} color="#2C8C5A" />
                    <Text style={styles.actionConfirmText}>Confirm</Text>
                  </Pressable>
                )}
                {appt.status !== "cancelled" && appt.status !== "completed" && (
                  <Pressable
                    onPress={() => setStatus(appt.id, "cancelled")}
                    style={styles.actionCancel}
                  >
                    <Feather name="x" size={13} color="#B44747" />
                    <Text style={styles.actionCancelText}>Cancel</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => remove(appt.id)} style={styles.actionDelete}>
                  <Feather name="trash-2" size={13} color="#7F7486" />
                  <Text style={styles.actionDeleteText}>Delete</Text>
                </Pressable>
              </View>
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
              : activeTab === "cancelled"
              ? "No cancelled appointments."
              : "No appointments in this category."}
          </Text>
        </GlassCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  subtitle: { fontSize: 13, color: "#7F7486", marginTop: 4 },
  tabRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2F4F8",
  },
  tabActive: { backgroundColor: "#8AAF2B" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#7F7486" },
  tabTextActive: { color: "#FFF" },
  badge: { backgroundColor: "#DDE8C7", borderRadius: 999, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.3)" },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#557417" },
  badgeTextActive: { color: "#FFF" },
  card: { marginBottom: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  todayBadge: { backgroundColor: "#8AAF2B", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  todayText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  dateText: { color: "#7F7486", fontSize: 12 },
  timeText: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#DDE8C7", marginVertical: 12 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  infoText: { color: "#231F29", fontSize: 13, flex: 1 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  actionConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#E8F7EE",
    borderRadius: 999,
  },
  actionConfirmText: { color: "#2C8C5A", fontWeight: "700", fontSize: 12 },
  actionCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#FBE7E7",
    borderRadius: 999,
  },
  actionCancelText: { color: "#B44747", fontWeight: "700", fontSize: 12 },
  actionDelete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#F2F4F8",
    borderRadius: 999,
  },
  actionDeleteText: { color: "#7F7486", fontWeight: "700", fontSize: 12 },
  empty: { color: "#7F7486", fontSize: 14 },
});
