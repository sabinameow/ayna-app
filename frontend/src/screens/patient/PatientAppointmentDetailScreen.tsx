import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import { useNotifications } from "@/hooks/useNotifications";
import type { Appointment, AppointmentStatus, LabRecommendation } from "@/types/api";

function formatAppointmentDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatAppointmentTimeRange(appointment: Appointment) {
  if (appointment.slot_start_time && appointment.slot_end_time) {
    return `${appointment.slot_start_time.slice(0, 5)} - ${appointment.slot_end_time.slice(0, 5)}`;
  }

  if (appointment.scheduled_at) {
    return new Date(appointment.scheduled_at).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return "Not set";
}

function statusMeta(status: AppointmentStatus) {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", bg: "#EEF7D8", text: "#8AAF2B" };
    case "pending":
      return { label: "Pending", bg: "#FFF1D6", text: "#E5A33F" };
    case "cancelled":
      return { label: "Cancelled", bg: "#FCE0E0", text: "#E25555" };
    case "completed":
      return { label: "Completed", bg: "#E0E9FF", text: "#3F6CF6" };
    default:
      return { label: status, bg: "#FCE4EF", text: "#E53F8F" };
  }
}

function canCancelAppointment(appointment: Appointment | null) {
  if (!appointment) return false;
  if (!(appointment.status === "pending" || appointment.status === "confirmed")) return false;
  return new Date(appointment.scheduled_at).getTime() > Date.now();
}

export function PatientAppointmentDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const { refreshUnread } = useNotifications();
  const appointmentId = route.params?.appointmentId as string | undefined;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !appointmentId) {
      setError("Could not load consultation details.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const nextAppointment = await api.patientAppointment(accessToken, appointmentId);
      setAppointment(nextAppointment);
    } catch {
      setError("Could not load consultation details.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, appointmentId]);

  useFocusReload(load);

  const recommendationDisclaimer =
    "These are general suggestions and do not replace medical advice. Your doctor will confirm what is needed.";
  const status = appointment ? statusMeta(appointment.status) : null;
  const symptoms = appointment?.symptom_names ?? [];
  const labRecommendations: LabRecommendation[] =
    appointment?.lab_recommendations ?? appointment?.required_tests ?? [];
  const showCancelButton = canCancelAppointment(appointment);
  const doctorSpecialization = appointment?.doctor_specialization || "Gynecologist";
  const appointmentDate = useMemo(
    () => formatAppointmentDate(appointment?.slot_date || appointment?.scheduled_at),
    [appointment]
  );
  const appointmentTime = useMemo(
    () => (appointment ? formatAppointmentTimeRange(appointment) : "Not set"),
    [appointment]
  );

  async function cancelAppointment() {
    if (!accessToken || !appointment || cancelling) return;

    setCancelling(true);
    try {
      await api.cancelAppointment(accessToken, appointment.id);
      showToast("Appointment cancelled", "success");
      await refreshUnread();
      navigation.goBack();
    } catch {
      showToast("Could not cancel appointment", "error");
    } finally {
      setCancelling(false);
    }
  }

  if (loading && !appointment) {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={22} color="#231F29" />
          </Pressable>
          <Text style={styles.title}>Consultation details</Text>
          <View style={{ width: 40 }} />
        </View>

        <GlassCard style={styles.centerCard}>
          <ActivityIndicator size="small" color="#E53F8F" />
          <Text style={styles.helper}>Loading consultation details...</Text>
        </GlassCard>
      </AppScreen>
    );
  }

  if (error || !appointment) {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="chevron-left" size={22} color="#231F29" />
          </Pressable>
          <Text style={styles.title}>Consultation details</Text>
          <View style={{ width: 40 }} />
        </View>

        <GlassCard style={styles.centerCard}>
          <Text style={styles.errorText}>Could not load consultation details.</Text>
          <PrimaryButton label="Try again" onPress={load} />
        </GlassCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={22} color="#231F29" />
        </Pressable>
        <Text style={styles.title}>Consultation details</Text>
        <View style={{ width: 40 }} />
      </View>

      <GlassCard style={styles.doctorCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(appointment.doctor_name || "D").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doctorName}>{appointment.doctor_name || "Doctor"}</Text>
          <Text style={styles.doctorRole}>{doctorSpecialization}</Text>
        </View>
        {status ? (
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <InfoRow label="Date" value={appointmentDate} />
        <InfoRow label="Time" value={appointmentTime} />
        <InfoRow label="Status" value={status?.label ?? "Not set"} />
        <InfoRow label="Reason" value={appointment.reason || "Not set"} />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Selected symptoms</Text>
        {symptoms.length ? (
          <View style={styles.tagWrap}>
            {symptoms.map((symptom) => (
              <View key={symptom} style={styles.tag}>
                <Text style={styles.tagText}>{symptom}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helper}>No symptoms were selected.</Text>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Suggested lab tests before the visit</Text>
        <Text style={styles.sectionSubtitle}>
          Based on the symptoms you selected, these tests may be helpful before your visit.
        </Text>

        {labRecommendations.length ? (
          <View style={styles.labList}>
            {labRecommendations.map((recommendation) => (
              <View key={recommendation.name} style={styles.labItem}>
                <Text style={styles.labName}>{recommendation.name}</Text>
                <Text style={styles.labReason}>{recommendation.reason}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helper}>
            No specific pre-visit tests suggested based on selected symptoms.
          </Text>
        )}

        {labRecommendations.length ? (
          <Text style={styles.disclaimer}>{recommendationDisclaimer}</Text>
        ) : null}
      </GlassCard>

      {appointment.notes ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{appointment.notes}</Text>
        </GlassCard>
      ) : null}

      {showCancelButton ? (
        <PrimaryButton
          label="Cancel appointment"
          onPress={cancelAppointment}
          disabled={cancelling}
          loading={cancelling}
        />
      ) : null}
    </AppScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#231F29",
  },
  centerCard: {
    alignItems: "center",
    gap: 12,
  },
  helper: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6F6475",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#E25555",
    textAlign: "center",
    fontWeight: "600",
  },
  doctorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FAD9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 30,
    fontWeight: "800",
    color: "#E53F8F",
  },
  doctorName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#231F29",
  },
  doctorRole: {
    marginTop: 4,
    fontSize: 14,
    color: "#6F6475",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  infoCard: {
    gap: 14,
  },
  infoRow: {
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A7E94",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#231F29",
  },
  sectionCard: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#231F29",
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6F6475",
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFF8FB",
    borderWidth: 1,
    borderColor: "#ECD6E2",
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7B7082",
  },
  labList: {
    gap: 10,
  },
  labItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#FFF8FB",
    borderWidth: 1,
    borderColor: "#F2D8E4",
  },
  labName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#231F29",
  },
  labReason: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#6F6475",
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8A7E94",
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6F6475",
  },
});
