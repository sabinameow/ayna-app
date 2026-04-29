import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { Appointment, ChatSession, DoctorProfile, ManagerProfile, Schedule } from "@/types/api";
import { formatDateTime, truncateId } from "@/utils/format";

export function ManagerDashboardScreen() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);

  const load = useCallback(() => {
    if (!accessToken) return;
    void Promise.all([
      api.managerProfile(accessToken),
      api.managerSessions(accessToken),
      api.managerAppointments(accessToken),
      api.managerSchedules(accessToken),
      api.listDoctors(),
    ])
      .then(([p, s, a, sc, d]) => {
        setProfile(p);
        setSessions(s);
        setAppointments(a);
        setSchedules(sc);
        setDoctors(d);
      })
      .catch(() => undefined);
  }, [accessToken]);
  useFocusReload(load);

  const openSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions]
  );
  const pendingAppointments = useMemo(
    () => appointments.filter((a) => a.status === "pending"),
    [appointments]
  );
  const availableDoctors = useMemo(
    () => doctors.filter((d) => d.is_available),
    [doctors]
  );
  const needsReschedule = useMemo(
    () => appointments.filter((a) => a.status === "cancelled").length,
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
          <Text style={styles.greeting}>Operations desk</Text>
          <Text style={styles.managerName}>{profile?.full_name ?? "Manager"}</Text>
          <Text style={styles.dateText}>{currentDate}</Text>
        </View>
        <View style={styles.queueBadge}>
          <Text style={[styles.queueCount, openSessions.length > 0 && styles.queueCountActive]}>
            {openSessions.length}
          </Text>
          <Text style={styles.queueLabel}>in queue</Text>
        </View>
      </View>

      {/* KPI grid */}
      <View style={styles.kpiRow}>
        <GlassCard
          style={[styles.kpi, openSessions.length > 0 && { backgroundColor: "#EEF7D8" }]}
        >
          <Text style={[styles.kpiValue, { color: "#8AAF2B" }]}>{openSessions.length}</Text>
          <Text style={styles.kpiLabel}>Open chats</Text>
        </GlassCard>
        <GlassCard
          style={[styles.kpi, pendingAppointments.length > 0 && { backgroundColor: "#FFF4E8" }]}
        >
          <Text
            style={[
              styles.kpiValue,
              { color: pendingAppointments.length > 0 ? "#DD8A29" : "#231F29" },
            ]}
          >
            {pendingAppointments.length}
          </Text>
          <Text style={styles.kpiLabel}>Pending appts</Text>
        </GlassCard>
        <GlassCard
          style={[styles.kpi, needsReschedule > 0 && { backgroundColor: "#FBE7E7" }]}
        >
          <Text
            style={[styles.kpiValue, { color: needsReschedule > 0 ? "#E25555" : "#231F29" }]}
          >
            {needsReschedule}
          </Text>
          <Text style={styles.kpiLabel}>Reschedule</Text>
        </GlassCard>
        <GlassCard style={styles.kpi}>
          <Text style={[styles.kpiValue, { color: "#38A169" }]}>{availableDoctors.length}</Text>
          <Text style={styles.kpiLabel}>Doctors avail.</Text>
        </GlassCard>
      </View>

      {/* Priority queue – open sessions */}
      {openSessions.length > 0 && (
        <GlassCard style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <Feather name="message-circle" size={15} color="#557417" />
            <Text style={styles.queueTitle}>Priority queue</Text>
            <View style={styles.queueCountChip}>
              <Text style={styles.queueCountChipText}>{openSessions.length} open</Text>
            </View>
          </View>
          {openSessions.slice(0, 4).map((s) => (
            <View key={s.id} style={styles.queueRow}>
              <View style={styles.urgentDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionId}>Session {truncateId(s.id)}</Text>
                <Text style={styles.sessionMeta}>{formatDateTime(s.created_at)}</Text>
              </View>
              <View style={styles.openChip}>
                <Text style={styles.openChipText}>Open</Text>
              </View>
            </View>
          ))}
          {openSessions.length > 4 && (
            <Text style={styles.moreText}>+{openSessions.length - 4} more sessions</Text>
          )}
        </GlassCard>
      )}

      {/* Quick actions */}
      <Text style={styles.actionsTitle}>Quick actions</Text>
      <View style={styles.actionsRow}>
        <GlassCard style={styles.action}>
          <View style={[styles.actionIcon, { backgroundColor: "#EEF7D8" }]}>
            <Feather name="message-circle" size={22} color="#557417" />
          </View>
          <Text style={styles.actionLabel}>Open chats</Text>
        </GlassCard>
        <GlassCard style={styles.action}>
          <View style={[styles.actionIcon, { backgroundColor: "#FFF4E8" }]}>
            <Feather name="calendar" size={22} color="#DD8A29" />
          </View>
          <Text style={styles.actionLabel}>Appointments</Text>
        </GlassCard>
        <GlassCard style={styles.action}>
          <View style={[styles.actionIcon, { backgroundColor: "#EAF0FF" }]}>
            <Feather name="clock" size={22} color="#3F6CF6" />
          </View>
          <Text style={styles.actionLabel}>Doctor slots</Text>
        </GlassCard>
      </View>

      {/* Doctor availability overview */}
      {doctors.length > 0 && (
        <GlassCard>
          <Text style={styles.cardTitle}>Doctor availability</Text>
          {doctors.map((doc) => {
            const docSchedules = schedules.filter((s) => s.doctor_id === doc.id);
            return (
              <View key={doc.id} style={styles.docRow}>
                <View style={styles.docAvatar}>
                  <Text style={styles.docAvatarText}>
                    {doc.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{doc.full_name}</Text>
                  <Text style={styles.docSpec}>{doc.specialization || "Doctor"}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <View
                    style={[
                      styles.availChip,
                      { backgroundColor: doc.is_available ? "#E8F7EE" : "#F2F4F8" },
                    ]}
                  >
                    <View
                      style={[
                        styles.availDot,
                        { backgroundColor: doc.is_available ? "#38A169" : "#B0A8B9" },
                      ]}
                    />
                    <Text
                      style={[
                        styles.availChipText,
                        { color: doc.is_available ? "#2C8C5A" : "#7F7486" },
                      ]}
                    >
                      {doc.is_available ? "Available" : "Unavailable"}
                    </Text>
                  </View>
                  <Text style={styles.docSlots}>
                    {docSchedules.length} schedule block{docSchedules.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            );
          })}
        </GlassCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  greeting: { fontSize: 13, color: "#7F7486", marginBottom: 2 },
  managerName: { fontSize: 22, fontWeight: "800", color: "#231F29" },
  dateText: { fontSize: 12, color: "#7F7486", marginTop: 4 },
  queueBadge: { backgroundColor: "#EEF7D8", borderRadius: 18, padding: 14, alignItems: "center", minWidth: 64 },
  queueCount: { fontSize: 24, fontWeight: "800", color: "#7F7486" },
  queueCountActive: { color: "#557417" },
  queueLabel: { fontSize: 11, color: "#6E7760", marginTop: 2 },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, alignItems: "center", paddingVertical: 16 },
  kpiValue: { fontSize: 22, fontWeight: "800", color: "#231F29" },
  kpiLabel: { fontSize: 10, color: "#7F7486", marginTop: 4, textAlign: "center" },
  queueCard: { backgroundColor: "#F7FBEE", borderWidth: 1, borderColor: "#DDE8C7" },
  queueHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  queueTitle: { fontSize: 15, fontWeight: "700", color: "#4F6715", flex: 1 },
  queueCountChip: { backgroundColor: "#DDE8C7", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  queueCountChipText: { fontSize: 11, fontWeight: "700", color: "#557417" },
  queueRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DDE8C7" },
  urgentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#8AAF2B" },
  sessionId: { color: "#231F29", fontWeight: "600", fontSize: 13 },
  sessionMeta: { color: "#6E7760", fontSize: 12, marginTop: 1 },
  openChip: { backgroundColor: "#DDE8C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  openChipText: { fontSize: 11, fontWeight: "700", color: "#557417" },
  moreText: { color: "#6E7760", fontSize: 12, marginTop: 8, fontStyle: "italic" },
  actionsTitle: { fontSize: 14, fontWeight: "700", color: "#7F7486", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  actionsRow: { flexDirection: "row", gap: 12 },
  action: { flex: 1, alignItems: "center", gap: 10, paddingVertical: 18 },
  actionIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, color: "#7F7486", fontWeight: "600", textAlign: "center" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#231F29", marginBottom: 14 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DDE8C7" },
  docAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF7D8", alignItems: "center", justifyContent: "center" },
  docAvatarText: { fontSize: 16, fontWeight: "800", color: "#557417" },
  docName: { fontWeight: "700", color: "#231F29", fontSize: 14 },
  docSpec: { color: "#7F7486", fontSize: 12, marginTop: 1 },
  availChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  availDot: { width: 6, height: 6, borderRadius: 3 },
  availChipText: { fontSize: 11, fontWeight: "700" },
  docSlots: { fontSize: 11, color: "#7F7486" },
});
