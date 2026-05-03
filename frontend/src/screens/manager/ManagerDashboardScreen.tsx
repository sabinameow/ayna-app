import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { Appointment, ChatSession, ManagerProfile } from "@/types/api";
import { palette } from "@/theme";

type MetricCardProps = {
  icon: keyof typeof Feather.glyphMap;
  value: number;
  label: string;
};

function MetricCard({ icon, value, label }: MetricCardProps) {
  return (
    <GlassCard style={styles.metricCard}>
      <View style={styles.metricIconWrap}>
        <Feather name={icon} size={20} color={palette.manager} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </GlassCard>
  );
}

export function ManagerDashboardScreen() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const load = useCallback(() => {
    if (!accessToken) return;
    void Promise.all([
      api.managerProfile(accessToken),
      api.managerAppointments(accessToken),
      api.managerSessions(accessToken),
    ])
      .then(([nextProfile, nextAppointments, nextSessions]) => {
        setProfile(nextProfile);
        setAppointments(nextAppointments);
        setSessions(nextSessions);
      })
      .catch(() => undefined);
  }, [accessToken]);
  useFocusReload(load);

  const todayString = new Date().toISOString().slice(0, 10);
  const appointmentsToday = useMemo(
    () =>
      appointments.filter((appointment) =>
        (appointment.slot_date || appointment.scheduled_at.slice(0, 10)) === todayString
      ).length,
    [appointments, todayString]
  );
  const pendingCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "pending").length,
    [appointments]
  );
  const cancelledCount = useMemo(
    () => appointments.filter((appointment) => appointment.status === "cancelled").length,
    [appointments]
  );
  const openMessages = useMemo(
    () => sessions.filter((session) => session.status === "active").length,
    [sessions]
  );
  const unconfirmedCount = pendingCount;

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>MANAGER WORKSPACE</Text>
          <Text style={styles.title}>{profile?.full_name || "Manager"}</Text>
          <Text style={styles.subtitle}>
            Coordinate bookings, reminders, and follow-up
          </Text>
        </View>
        <NotificationBell
          color={palette.manager}
          backgroundColor="#EDF8D6"
          style={styles.bell}
        />
      </View>

      <GlassCard style={styles.overviewCard}>
        <View style={styles.overviewIcon}>
          <Feather name="shield" size={22} color={palette.manager} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.overviewTitle}>Operations overview</Text>
          <Text style={styles.overviewCopy}>
            Keep patient visits on track without touching medical decisions.
          </Text>
        </View>
      </GlassCard>

      <View style={styles.grid}>
        <MetricCard icon="calendar" value={appointmentsToday} label="Appointments today" />
        <MetricCard icon="clock" value={pendingCount} label="Pending confirmation" />
      </View>

      <View style={styles.grid}>
        <MetricCard icon="x-circle" value={cancelledCount} label="Cancelled" />
        <MetricCard icon="message-circle" value={openMessages} label="New messages" />
      </View>

      <View style={styles.singleRow}>
        <MetricCard icon="alert-circle" value={unconfirmedCount} label="Unconfirmed bookings" />
      </View>

      <Text style={styles.quickTitle}>Quick actions</Text>
      <View style={styles.quickGrid}>
        <Pressable style={styles.quickCard}>
          <View style={styles.quickIcon}>
            <Feather name="calendar" size={20} color={palette.manager} />
          </View>
          <Text style={styles.quickLabel}>Open appointments</Text>
        </Pressable>
        <Pressable style={styles.quickCard}>
          <View style={styles.quickIcon}>
            <Feather name="message-square" size={20} color={palette.manager} />
          </View>
          <Text style={styles.quickLabel}>Review chats</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#66861E",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#21310F",
  },
  subtitle: {
    marginTop: 8,
    color: "#617153",
    fontSize: 15,
    lineHeight: 22,
  },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  overviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#F4FBD8",
    borderWidth: 1,
    borderColor: "#ECF4C9",
  },
  overviewIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#EDF8D6",
    alignItems: "center",
    justifyContent: "center",
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#21310F",
  },
  overviewCopy: {
    marginTop: 6,
    color: "#617153",
    fontSize: 14,
    lineHeight: 21,
  },
  grid: {
    flexDirection: "row",
    gap: 14,
  },
  singleRow: {
    width: "48%",
  },
  metricCard: {
    flex: 1,
    minHeight: 168,
    backgroundColor: "#F4FBD8",
    borderWidth: 1,
    borderColor: "#ECF4C9",
    justifyContent: "space-between",
  },
  metricIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#66861E",
    marginTop: 28,
  },
  metricLabel: {
    color: "#617153",
    fontSize: 14,
    lineHeight: 20,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#21310F",
    marginTop: 4,
  },
  quickGrid: {
    flexDirection: "row",
    gap: 14,
  },
  quickCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    shadowColor: "#D5E3B0",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 4,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#EDF8D6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#314217",
  },
});
