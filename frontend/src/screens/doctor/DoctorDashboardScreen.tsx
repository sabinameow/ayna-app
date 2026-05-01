import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { Appointment, DoctorProfile, PatientProfile } from "@/types/api";
import { formatDate } from "@/utils/format";

function apptTime(scheduled_at: string) {
  return new Date(scheduled_at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    confirmed: { bg: "#E8F7EE", text: "#2C8C5A" },
    cancelled: { bg: "#FBE7E7", text: "#B44747" },
    completed: { bg: "#EAF0FF", text: "#3356C4" },
    pending: { bg: "#FFF4E8", text: "#9B5E11" },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <View style={[chipStyles.chip, { backgroundColor: c.bg }]}>
      <Text style={[chipStyles.text, { color: c.text }]}>{status}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  text: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});

export function DoctorDashboardScreen() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const load = useCallback(() => {
    if (!accessToken) return;
    void Promise.all([
      api.doctorProfile(accessToken),
      api.doctorPatients(accessToken),
      api.doctorAppointments(accessToken),
    ])
      .then(([p, pts, apts]) => {
        setProfile(p);
        setPatients(pts);
        setAppointments(apts);
      })
      .catch(() => undefined);
  }, [accessToken]);
  useFocusReload(load);

  const todayStr = new Date().toDateString();

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => new Date(a.scheduled_at).toDateString() === todayStr)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [appointments, todayStr]
  );

  const flaggedPatients = useMemo(
    () => patients.filter((p) => Math.abs(p.average_cycle_length - 28) > 5),
    [patients]
  );

  const pendingCount = useMemo(
    () => appointments.filter((a) => a.status === "pending").length,
    [appointments]
  );

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppScreen>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.doctorName}>
            {profile ? `Dr. ${profile.full_name}` : "Loading..."}
          </Text>
          <Text style={styles.dateText}>{currentDate}</Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell color="#3F6CF6" backgroundColor="#EAF0FF" />
          <View
            style={[
              styles.availBadge,
              { borderColor: profile?.is_available ? "#B2DFC7" : "#F5C0C0" },
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: profile?.is_available ? "#38A169" : "#E25555" },
              ]}
            />
            <Text style={styles.availText}>
              {profile?.is_available ? "Available" : "Unavailable"}
            </Text>
          </View>
        </View>
      </View>

      {/* KPI grid */}
      <View style={styles.kpiRow}>
        <GlassCard style={[styles.kpi, { backgroundColor: "#EAF0FF" }]}>
          <Text style={[styles.kpiValue, { color: "#3F6CF6" }]}>{todayAppointments.length}</Text>
          <Text style={styles.kpiLabel}>Today</Text>
        </GlassCard>
        <GlassCard style={styles.kpi}>
          <Text style={[styles.kpiValue, { color: "#3F6CF6" }]}>{patients.length}</Text>
          <Text style={styles.kpiLabel}>Patients</Text>
        </GlassCard>
        <GlassCard
          style={[styles.kpi, flaggedPatients.length > 0 && { backgroundColor: "#FFF4E8" }]}
        >
          <Text
            style={[
              styles.kpiValue,
              { color: flaggedPatients.length > 0 ? "#DD8A29" : "#231F29" },
            ]}
          >
            {flaggedPatients.length}
          </Text>
          <Text style={styles.kpiLabel}>Flagged</Text>
        </GlassCard>
        <GlassCard
          style={[styles.kpi, pendingCount > 0 && { backgroundColor: "#FBE7E7" }]}
        >
          <Text
            style={[styles.kpiValue, { color: pendingCount > 0 ? "#E25555" : "#231F29" }]}
          >
            {pendingCount}
          </Text>
          <Text style={styles.kpiLabel}>Follow-ups</Text>
        </GlassCard>
      </View>

      {/* Flagged patients */}
      {flaggedPatients.length > 0 && (
        <GlassCard style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <Feather name="alert-circle" size={15} color="#DD8A29" />
            <Text style={styles.alertTitle}>Patients needing attention</Text>
          </View>
          {flaggedPatients.slice(0, 3).map((p) => (
            <View key={p.id} style={styles.alertRow}>
              <Text style={styles.alertName}>{p.full_name}</Text>
              <Text style={styles.alertMeta}>{p.average_cycle_length}-day avg cycle</Text>
            </View>
          ))}
          {flaggedPatients.length > 3 && (
            <Text style={styles.alertMore}>+{flaggedPatients.length - 3} more patients</Text>
          )}
        </GlassCard>
      )}

      {/* Today's appointments timeline */}
      <GlassCard>
        <Text style={styles.cardTitle}>Today's appointments</Text>
        {todayAppointments.length ? (
          todayAppointments.map((appt) => (
            <View key={appt.id} style={styles.apptRow}>
              <View style={styles.timeCol}>
                <Text style={styles.apptTime}>{apptTime(appt.scheduled_at)}</Text>
              </View>
              <View style={styles.apptInfo}>
                <Text style={styles.apptReason}>{appt.reason || "General consultation"}</Text>
                <StatusChip status={appt.status} />
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No appointments scheduled for today.</Text>
        )}
      </GlassCard>

      {/* Upcoming (non-today) */}
      {appointments.filter((a) => new Date(a.scheduled_at).toDateString() !== todayStr).length >
        0 && (
        <GlassCard>
          <Text style={styles.cardTitle}>Upcoming appointments</Text>
          {appointments
            .filter((a) => new Date(a.scheduled_at) > new Date())
            .filter((a) => new Date(a.scheduled_at).toDateString() !== todayStr)
            .slice(0, 3)
            .map((appt) => (
              <View key={appt.id} style={styles.upcomingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upcomingDate}>{formatDate(appt.scheduled_at)}</Text>
                  <Text style={styles.upcomingReason}>
                    {appt.reason || "General consultation"}
                  </Text>
                </View>
                <StatusChip status={appt.status} />
              </View>
            ))}
        </GlassCard>
      )}

      {/* Shortcuts */}
      <View style={styles.shortcuts}>
        <View style={styles.shortcut}>
          <View style={[styles.shortcutIcon, { backgroundColor: "#EAF0FF" }]}>
            <Feather name="users" size={22} color="#3F6CF6" />
          </View>
          <Text style={styles.shortcutLabel}>Patient files</Text>
        </View>
        <View style={styles.shortcut}>
          <View style={[styles.shortcutIcon, { backgroundColor: "#E8F7EE" }]}>
            <Feather name="calendar" size={22} color="#38A169" />
          </View>
          <Text style={styles.shortcutLabel}>Update schedule</Text>
        </View>
        <View style={styles.shortcut}>
          <View style={[styles.shortcutIcon, { backgroundColor: "#FFF4E8" }]}>
            <Feather name="file-text" size={22} color="#DD8A29" />
          </View>
          <Text style={styles.shortcutLabel}>Add note</Text>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 10,
  },
  greeting: { fontSize: 13, color: "#7F7486", marginBottom: 2 },
  doctorName: { fontSize: 22, fontWeight: "800", color: "#231F29" },
  dateText: { fontSize: 12, color: "#7F7486", marginTop: 4 },
  availBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#FAFAFA",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  availText: { fontSize: 11, fontWeight: "700", color: "#231F29" },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, alignItems: "center", paddingVertical: 16 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: "#231F29" },
  kpiLabel: { fontSize: 10, color: "#7F7486", marginTop: 4, textAlign: "center" },
  alertCard: { backgroundColor: "#FFFBF2", borderWidth: 1, borderColor: "#F5D5A8" },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  alertTitle: { fontSize: 14, fontWeight: "700", color: "#9B5E11" },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F5D5A8",
  },
  alertName: { color: "#231F29", fontWeight: "600", fontSize: 14 },
  alertMeta: { color: "#9B5E11", fontSize: 12 },
  alertMore: { color: "#9B5E11", fontSize: 12, marginTop: 8, fontStyle: "italic" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#231F29", marginBottom: 14 },
  apptRow: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D9E1FF",
    alignItems: "flex-start",
  },
  timeCol: { width: 56 },
  apptTime: { fontSize: 13, fontWeight: "800", color: "#3F6CF6" },
  apptInfo: { flex: 1, gap: 6 },
  apptReason: { color: "#231F29", fontWeight: "600", fontSize: 14 },
  empty: { color: "#7F7486", fontSize: 14 },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D9E1FF",
    gap: 10,
  },
  upcomingDate: { color: "#7F7486", fontSize: 12, marginBottom: 2 },
  upcomingReason: { color: "#231F29", fontWeight: "600", fontSize: 14 },
  shortcuts: { flexDirection: "row", gap: 12 },
  shortcut: { flex: 1, alignItems: "center", gap: 10 },
  shortcutIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: { fontSize: 11, color: "#7F7486", textAlign: "center", fontWeight: "600" },
});
