import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { Appointment, AppointmentStatus, DoctorProfile } from "@/types/api";
import { formatDate } from "@/utils/format";

const STATUS_OPTIONS: { key: "all" | AppointmentStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed", label: "Completed" },
];

const STATUS_STYLES: Record<AppointmentStatus, { bg: string; text: string }> = {
  pending: { bg: "#FFF3D9", text: "#A06A14" },
  confirmed: { bg: "#E9F7D3", text: "#64861B" },
  cancelled: { bg: "#FCE5E5", text: "#B54A4A" },
  completed: { bg: "#E8EEF8", text: "#4A678D" },
};

function formatAppointmentTime(appointment: Appointment) {
  const date = appointment.slot_date || appointment.scheduled_at.slice(0, 10);
  const time = appointment.slot_start_time || appointment.scheduled_at.slice(11, 16);
  return `${formatDate(date)} · ${time}`;
}

function getManagerNote(appointment: Appointment) {
  return (appointment as Appointment & { manager_note?: string | null }).manager_note || "";
}

export function ManagerAppointmentsScreen() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");
  const [doctorFilter, setDoctorFilter] = useState("all");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [nextAppointments, nextDoctors] = await Promise.all([
        api.managerAppointments(accessToken),
        api.listDoctors(),
      ]);
      setAppointments(nextAppointments);
      setDoctors(nextDoctors);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);
  useFocusReload(load);

  const filteredAppointments = useMemo(() => {
    return [...appointments]
      .filter((appointment) => {
        if (statusFilter !== "all" && appointment.status !== statusFilter) {
          return false;
        }
        if (doctorFilter !== "all" && appointment.doctor_id !== doctorFilter) {
          return false;
        }
        if (dateFilter.trim()) {
          const appointmentDate = appointment.slot_date || appointment.scheduled_at.slice(0, 10);
          if (appointmentDate !== dateFilter.trim()) {
            return false;
          }
        }
        if (search.trim()) {
          const patientName = (appointment.patient_name || "").toLowerCase();
          if (!patientName.includes(search.trim().toLowerCase())) {
            return false;
          }
        }
        return true;
      })
      .sort((left, right) => {
        return new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime();
      });
  }, [appointments, dateFilter, doctorFilter, search, statusFilter]);

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>APPOINTMENTS</Text>
          <Text style={styles.title}>Operations board</Text>
          <Text style={styles.subtitle}>Filter, review, and open any booking</Text>
        </View>
        <NotificationBell
          color="#7EA320"
          backgroundColor="#EDF8D6"
          style={styles.bell}
        />
      </View>

      <GlassCard style={styles.filterCard}>
        <Text style={styles.filterLabel}>Search by patient</Text>
        <AppInput
          value={search}
          onChangeText={setSearch}
          placeholder="Patient name"
        />

        <Text style={styles.filterLabel}>Filter by date</Text>
        <AppInput
          value={dateFilter}
          onChangeText={setDateFilter}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />

        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.chipWrap}>
          {STATUS_OPTIONS.map((option) => {
            const active = statusFilter === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setStatusFilter(option.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.filterLabel}>Doctor</Text>
        <View style={styles.chipWrap}>
          <Pressable
            onPress={() => setDoctorFilter("all")}
            style={[styles.filterChip, doctorFilter === "all" && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                doctorFilter === "all" && styles.filterChipTextActive,
              ]}
            >
              All doctors
            </Text>
          </Pressable>
          {doctors.map((doctor) => {
            const active = doctorFilter === doctor.id;
            return (
              <Pressable
                key={doctor.id}
                onPress={() => setDoctorFilter(doctor.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {doctor.full_name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>All appointments</Text>
        <Text style={styles.sectionMeta}>
          {loading ? "Loading..." : `${filteredAppointments.length} items`}
        </Text>
      </View>

      {filteredAppointments.length ? (
        filteredAppointments.map((appointment) => {
          const managerNote = getManagerNote(appointment);
          const statusStyle = STATUS_STYLES[appointment.status];
          return (
            <GlassCard key={appointment.id} style={styles.appointmentCard}>
              <View style={styles.cardTop}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarText}>
                    {(appointment.patient_name || "P").charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>
                    {appointment.patient_name || "Patient"}
                  </Text>
                  <Text style={styles.doctorName}>
                    {appointment.doctor_name || "Doctor"}
                  </Text>
                  <Text style={styles.dateTime}>{formatAppointmentTime(appointment)}</Text>
                </View>

                <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.statusText, { color: statusStyle.text }]}>
                    {STATUS_OPTIONS.find((option) => option.key === appointment.status)?.label ||
                      appointment.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.reasonText}>
                {appointment.reason || "General consultation"}
              </Text>

              <View style={styles.noteRow}>
                <View style={styles.notePill}>
                  <Feather name="clipboard" size={13} color="#7EA320" />
                  <Text style={styles.notePillText}>
                    {managerNote || "No manager note"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#6E7E5E" />
              </View>
            </GlassCard>
          );
        })
      ) : (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyText}>No appointments match these filters.</Text>
        </GlassCard>
      )}
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
    color: "#6B8A20",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1E2A10",
  },
  subtitle: {
    marginTop: 8,
    color: "#5D6D53",
    fontSize: 15,
  },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  filterCard: {
    backgroundColor: "#F5FCD8",
    borderWidth: 1,
    borderColor: "#EAF4C8",
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4E611E",
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8C6",
  },
  filterChipActive: {
    backgroundColor: "#8AAF2B",
    borderColor: "#8AAF2B",
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#637053",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E2A10",
  },
  sectionMeta: {
    fontSize: 14,
    color: "#6E7E5E",
  },
  appointmentCard: {
    gap: 16,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#EDF8D6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "900",
    color: "#6B8A20",
  },
  patientName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E2A10",
  },
  doctorName: {
    marginTop: 4,
    fontSize: 14,
    color: "#6E7E5E",
  },
  dateTime: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
    color: "#404A35",
  },
  statusChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  reasonText: {
    fontSize: 15,
    color: "#404A35",
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F4F8E5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  notePillText: {
    color: "#5F7530",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  emptyText: {
    fontSize: 15,
    color: "#6E7E5E",
  },
});
