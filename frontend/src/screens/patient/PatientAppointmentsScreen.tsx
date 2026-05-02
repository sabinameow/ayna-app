import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { NotificationBell } from "@/components/NotificationBell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import { useNotifications } from "@/hooks/useNotifications";
import { saveFeedbackLabel, useSaveFeedback } from "@/hooks/useSaveFeedback";
import type {
  Appointment,
  AvailableSlot,
  DoctorProfile,
  LabRecommendation,
  Symptom,
} from "@/types/api";
import { formatDate, formatTime } from "@/utils/format";

type Step = "list" | "doctors" | "detail";

function normalizeSymptomKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function dedupeSymptomsCatalog(items: Symptom[]) {
  const uniqueSymptoms: Symptom[] = [];
  const seenNames = new Set<string>();

  for (const symptom of items) {
    const key = normalizeSymptomKey(symptom.name);
    if (seenNames.has(key)) {
      continue;
    }
    seenNames.add(key);
    uniqueSymptoms.push(symptom);
  }

  return uniqueSymptoms;
}

function buildWeekStrip(base: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const next = new Date(base);
    next.setDate(base.getDate() + index);
    return {
      date: next.toISOString().slice(0, 10),
      day: String(next.getDate()),
      weekday: next.toLocaleString("en-US", { weekday: "short" }).slice(0, 3),
    };
  });
}

function doctorMetaText(doctor: DoctorProfile) {
  return doctor.specialization || "Gynecologist";
}

function statusLabel(status: string) {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

export function PatientAppointmentsScreen() {
  const navigation = useNavigation<any>();
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const { refreshUnread } = useNotifications();
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [step, setStep] = useState<Step>("list");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [labRecommendations, setLabRecommendations] = useState<LabRecommendation[]>([]);
  const [labDisclaimer, setLabDisclaimer] = useState("");
  const [labWarning, setLabWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [booking, setBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const bookingFeedback = useSaveFeedback();

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const [nextDoctors, nextAppointments, nextSymptoms] = await Promise.all([
        api.patientDoctors(accessToken),
        api.patientAppointments(accessToken),
        api.listSymptomsCatalog(accessToken),
      ]);
      setDoctors(nextDoctors);
      setAppointments(nextAppointments);
      setSymptoms(dedupeSymptomsCatalog(nextSymptoms));
    } catch {
      setError("Could not load appointments.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);
  useFocusReload(load);

  const loadSlots = useCallback(
    async (doctorId: string, dateValue: string) => {
      if (!accessToken) return;
      setLoadingSlots(true);
      setError("");
      try {
        const slots = await api.availableSlots(accessToken, doctorId, dateValue);
        setAvailableSlots(slots);
      } catch {
        setAvailableSlots([]);
        setError("Could not load available slots.");
      } finally {
        setLoadingSlots(false);
      }
    },
    [accessToken]
  );

  async function selectDoctor(doctor: DoctorProfile) {
    setSelectedDoctor(doctor);
    setSelectedSlotId(null);
    setSelectedSymptoms([]);
    setReason("");
    setLabRecommendations([]);
    setLabDisclaimer("");
    setLabWarning("");
    setStep("detail");
    await loadSlots(doctor.id, selectedDate);
  }

  async function changeDate(dateValue: string) {
    if (!selectedDoctor) return;
    setSelectedDate(dateValue);
    setSelectedSlotId(null);
    await loadSlots(selectedDoctor.id, dateValue);
  }

  async function book() {
    if (!accessToken || !selectedDoctor || !selectedSlotId || booking) return;
    setBooking(true);
    bookingFeedback.markSaving();
    setError("");
    try {
      await api.createAppointment(accessToken, {
        slot_id: selectedSlotId,
        reason: reason || undefined,
        selected_symptom_ids: selectedSymptoms.length ? selectedSymptoms : undefined,
      });
      bookingFeedback.markSaved();
      await Promise.all([load(), loadSlots(selectedDoctor.id, selectedDate), refreshUnread()]);
      setReason("");
      setSelectedSymptoms([]);
      setSelectedSlotId(null);
      setLabRecommendations([]);
      setLabDisclaimer("");
      setLabWarning("");
      setSelectedDoctor(null);
      setStep("list");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to book appointment";
      setError(message);
      bookingFeedback.markError();
      if (err instanceof api.error && err.status === 409) {
        showToast("This slot is already booked", "error");
      } else {
        showToast("Failed to book appointment", "error");
      }
    } finally {
      setBooking(false);
    }
  }

  async function cancelAppointment(id: string) {
    if (!accessToken || cancellingId) return;
    setCancellingId(id);
    setError("");
    try {
      await api.cancelAppointment(accessToken, id);
      showToast("Appointment cancelled", "success");
      await Promise.all([load(), refreshUnread()]);
    } catch {
      setError("Could not cancel appointment.");
      showToast("Could not cancel appointment", "error");
    } finally {
      setCancellingId(null);
    }
  }

  const symptomSet = useMemo(() => new Set(selectedSymptoms), [selectedSymptoms]);
  const symptomNameById = useMemo(
    () => new Map(symptoms.map((symptom) => [symptom.id, symptom.name])),
    [symptoms]
  );
  const selectedSymptomNames = useMemo(
    () =>
      Array.from(
        new Set(
          selectedSymptoms
            .map((symptomId) => symptomNameById.get(symptomId))
            .filter((value): value is string => Boolean(value))
        )
      ),
    [selectedSymptoms, symptomNameById]
  );
  const weekStrip = useMemo(() => buildWeekStrip(new Date()), []);

  useEffect(() => {
    if (!accessToken || !selectedSymptoms.length) {
      setLabRecommendations([]);
      setLabDisclaimer("");
      setLabWarning("");
      setLoadingRecommendations(false);
      return;
    }

    if (!selectedSymptomNames.length) {
      return;
    }

    let cancelled = false;
    setLoadingRecommendations(true);
    setLabWarning("");
    setLabRecommendations([]);
    setLabDisclaimer("");

    void api
      .appointmentLabRecommendations(accessToken, { symptoms: selectedSymptomNames })
      .then((response) => {
        if (cancelled) return;
        setLabRecommendations(response.recommendations);
        setLabDisclaimer(response.disclaimer);
      })
      .catch(() => {
        if (cancelled) return;
        setLabRecommendations([]);
        setLabDisclaimer("");
        setLabWarning("Could not load lab recommendations. You can still continue booking.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRecommendations(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedSymptomNames, selectedSymptoms.length]);

  if (step === "list") {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Appointments</Text>
          <View style={styles.headerActions}>
            <NotificationBell />
            <Pressable style={styles.addPill} onPress={() => setStep("doctors")}>
              <Feather name="plus" size={18} color="#E53F8F" />
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => setStep("doctors")}>
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Feather name="calendar" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Book an appointment</Text>
              <Text style={styles.heroMeta}>Choose a doctor and pick an open slot</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#E53F8F" />
          </GlassCard>
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>My appointments</Text>
          {loading ? <Text style={styles.helper}>Loading...</Text> : null}
        </View>

        {appointments.length ? (
          appointments.map((appointment) => (
            <Pressable
              key={appointment.id}
              onPress={() => navigation.navigate("AppointmentDetail", { appointmentId: appointment.id })}
            >
              <GlassCard style={styles.appointmentCard}>
                <View style={styles.appointmentTop}>
                  <View style={styles.appointmentAvatar}>
                    <Text style={styles.appointmentAvatarText}>
                      {(appointment.doctor_name || "D").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.appointmentName}>
                      {appointment.doctor_name || "Doctor"}
                    </Text>
                    <Text style={styles.appointmentSub}>{appointment.reason || "General consultation"}</Text>
                    <Text style={styles.appointmentTime}>
                      {formatDate(appointment.scheduled_at)} · {formatTime(appointment.scheduled_at.slice(11, 16))}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusBg(appointment.status) }]}>
                    <Text style={[styles.statusText, { color: statusColor(appointment.status) }]}>
                      {statusLabel(appointment.status)}
                    </Text>
                  </View>
                </View>

                {(appointment.status === "pending" || appointment.status === "confirmed") ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      void cancelAppointment(appointment.id);
                    }}
                    disabled={cancellingId === appointment.id}
                    style={styles.inlineAction}
                  >
                    <Text style={styles.inlineActionText}>
                      {cancellingId === appointment.id ? "Cancelling..." : "Cancel appointment"}
                    </Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            </Pressable>
          ))
        ) : (
          <GlassCard>
            <Text style={styles.empty}>
              {loading ? "Loading appointments..." : "No appointments yet."}
            </Text>
          </GlassCard>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </AppScreen>
    );
  }

  if (step === "doctors") {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => setStep("list")}>
            <Feather name="chevron-left" size={22} color="#231F29" />
          </Pressable>
          <Text style={styles.title}>Choose doctor</Text>
          <View style={{ width: 40 }} />
        </View>

        {doctors.length ? (
          doctors.map((doctor) => (
            <Pressable key={doctor.id} onPress={() => void selectDoctor(doctor)}>
              <GlassCard style={styles.doctorListCard}>
                <View style={styles.doctorAvatarSquare}>
                  <Text style={styles.doctorAvatarText}>
                    {doctor.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.doctorName}>{doctor.full_name}</Text>
                  <Text style={styles.doctorRole}>{doctorMetaText(doctor)}</Text>
                  <View style={styles.doctorMetaRow}>
                    <Feather name="star" size={13} color="#E53F8F" />
                    <Text style={styles.doctorMetaText}>4.7</Text>
                    <Feather name="map-pin" size={13} color="#8A7E94" />
                    <Text style={styles.doctorMetaText}>800m away</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          ))
        ) : (
          <GlassCard>
            <Text style={styles.empty}>
              {loading ? "Loading doctors..." : "No doctors available."}
            </Text>
          </GlassCard>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </AppScreen>
    );
  }

  if (!selectedDoctor) {
    return null;
  }

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => setStep("doctors")}>
          <Feather name="chevron-left" size={22} color="#231F29" />
        </Pressable>
        <Text style={styles.title}>Book appointment</Text>
        <View style={{ width: 40 }} />
      </View>

      <GlassCard style={styles.detailDoctorCard}>
        <View style={styles.doctorAvatarSquare}>
          <Text style={styles.doctorAvatarText}>
            {selectedDoctor.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doctorName}>{selectedDoctor.full_name}</Text>
          <Text style={styles.doctorRole}>{doctorMetaText(selectedDoctor)}</Text>
          <View style={styles.doctorMetaRow}>
            <Feather name="star" size={13} color="#E53F8F" />
            <Text style={styles.doctorMetaText}>4.7</Text>
            <Feather name="map-pin" size={13} color="#8A7E94" />
            <Text style={styles.doctorMetaText}>800m away</Text>
          </View>
        </View>
      </GlassCard>

      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.aboutText}>
        {selectedDoctor.bio ||
          "10 years of experience. Specialization in reproductive health."}
      </Text>

      <View style={styles.dateRow}>
        {weekStrip.map((day) => {
          const active = day.date === selectedDate;
          return (
            <Pressable
              key={day.date}
              onPress={() => void changeDate(day.date)}
              style={[styles.dateCard, active && styles.dateCardActive]}
            >
              <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>
                {day.weekday}
              </Text>
              <Text style={[styles.dateDay, active && styles.dateTextActive]}>{day.day}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.slotGrid}>
        {availableSlots.length ? (
          availableSlots.map((slot) => {
            const active = selectedSlotId === slot.id;
            return (
              <Pressable
                key={slot.id}
                onPress={() => !booking && setSelectedSlotId(slot.id)}
                disabled={booking}
                style={[styles.slotPill, active && styles.slotPillActive, booking && styles.slotPillDisabled]}
              >
                <Text style={[styles.slotText, active && styles.slotTextActive]}>
                  {formatTime(slot.start_time)}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <GlassCard style={styles.emptySlotsCard}>
            <Text style={styles.empty}>
              {loadingSlots ? "Loading available slots..." : "No available slots"}
            </Text>
          </GlassCard>
        )}
      </View>

      <Text style={styles.sectionTitle}>Symptoms (optional)</Text>
      <View style={styles.symptomWrap}>
        {symptoms.map((symptom) => {
          const active = symptomSet.has(symptom.id);
          return (
            <Pressable
              key={symptom.id}
              onPress={() =>
                setSelectedSymptoms((current) =>
                  active
                    ? current.filter((symptomId) => symptomId !== symptom.id)
                    : [...current, symptom.id]
                )
              }
              style={[styles.symptomChip, active && styles.symptomChipActive]}
            >
              <Text style={[styles.symptomText, active && styles.symptomTextActive]}>
                {symptom.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <AppInput
        label="Reason"
        value={reason}
        onChangeText={setReason}
        placeholder="Add a short note for the doctor"
      />

      {selectedSymptoms.length ? (
        <GlassCard style={styles.recommendationCard}>
          <Text style={styles.recommendationTitle}>Take these tests before your visit</Text>
          <Text style={styles.recommendationSubtitle}>
            Based on the symptoms you selected, these tests may be helpful before your visit.
          </Text>

          {loadingRecommendations ? (
            <Text style={styles.recommendationHelper}>Loading suggestions...</Text>
          ) : labWarning ? (
            <Text style={styles.recommendationWarning}>{labWarning}</Text>
          ) : labRecommendations.length ? (
            <View style={styles.recommendationList}>
              {labRecommendations.map((recommendation) => (
                <View key={recommendation.name} style={styles.recommendationItem}>
                  <Text style={styles.recommendationName}>{recommendation.name}</Text>
                  <Text style={styles.recommendationReason}>{recommendation.reason}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.recommendationHelper}>
              No specific pre-visit tests suggested based on selected symptoms.
            </Text>
          )}

          {!loadingRecommendations && !labWarning && labDisclaimer ? (
            <Text style={styles.recommendationDisclaimer}>{labDisclaimer}</Text>
          ) : null}
        </GlassCard>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label={saveFeedbackLabel(bookingFeedback.status, "Book Appointment", "Booked")}
        onPress={book}
        disabled={!selectedSlotId || booking}
        feedbackStatus={bookingFeedback.status}
      />
    </AppScreen>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "confirmed":
      return "#8AAF2B";
    case "pending":
      return "#E5A33F";
    case "cancelled":
      return "#E25555";
    case "completed":
      return "#3F6CF6";
    default:
      return "#E53F8F";
  }
}

function statusBg(status: string) {
  switch (status) {
    case "confirmed":
      return "#EEF7D8";
    case "pending":
      return "#FFF1D6";
    case "cancelled":
      return "#FCE0E0";
    case "completed":
      return "#E0E9FF";
    default:
      return "#FCE4EF";
  }
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#231F29",
  },
  helper: {
    fontSize: 12,
    color: "#8A7E94",
  },
  addPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53F8F",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#231F29",
  },
  heroMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#8A7E94",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#231F29",
  },
  appointmentCard: {
    gap: 14,
  },
  appointmentTop: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  appointmentAvatar: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  appointmentAvatarText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#E53F8F",
  },
  appointmentName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#231F29",
  },
  appointmentSub: {
    marginTop: 3,
    fontSize: 13,
    color: "#8A7E94",
  },
  appointmentTime: {
    marginTop: 6,
    fontSize: 12,
    color: "#5E5564",
    fontWeight: "600",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  inlineAction: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FBE7E7",
  },
  inlineActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B44747",
  },
  doctorListCard: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  detailDoctorCard: {
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
  },
  doctorAvatarSquare: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#FAD9E6",
    alignItems: "center",
    justifyContent: "center",
  },
  doctorAvatarText: {
    fontSize: 44,
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
  doctorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  doctorMetaText: {
    fontSize: 13,
    color: "#6F6475",
    fontWeight: "600",
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6F6475",
  },
  dateRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dateCardActive: {
    backgroundColor: "#E53F8F",
  },
  dateWeekday: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7B7082",
  },
  dateDay: {
    fontSize: 30,
    fontWeight: "800",
    color: "#231F29",
  },
  dateTextActive: {
    color: "#FFFFFF",
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  slotPill: {
    width: "30.5%",
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  slotPillActive: {
    backgroundColor: "#E53F8F",
  },
  slotPillDisabled: {
    opacity: 0.65,
  },
  slotText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#231F29",
  },
  slotTextActive: {
    color: "#FFFFFF",
  },
  emptySlotsCard: {
    width: "100%",
  },
  symptomWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  symptomChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#FFF8FB",
    borderWidth: 1,
    borderColor: "#ECD6E2",
  },
  symptomChipActive: {
    backgroundColor: "#E53F8F",
    borderColor: "#E53F8F",
  },
  symptomText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7B7082",
  },
  symptomTextActive: {
    color: "#FFFFFF",
  },
  recommendationCard: {
    gap: 12,
  },
  recommendationTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#231F29",
  },
  recommendationSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6F6475",
  },
  recommendationList: {
    gap: 10,
  },
  recommendationItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#FFF8FB",
    borderWidth: 1,
    borderColor: "#F2D8E4",
  },
  recommendationName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#231F29",
  },
  recommendationReason: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#6F6475",
  },
  recommendationHelper: {
    fontSize: 13,
    lineHeight: 20,
    color: "#6F6475",
  },
  recommendationWarning: {
    fontSize: 13,
    lineHeight: 20,
    color: "#C56A1A",
    fontWeight: "600",
  },
  recommendationDisclaimer: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8A7E94",
  },
  empty: {
    fontSize: 14,
    color: "#8A7E94",
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E25555",
  },
});
