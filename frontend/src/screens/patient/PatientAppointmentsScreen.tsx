import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { Appointment, AvailableSlot, DoctorProfile, Symptom } from "@/types/api";
import { formatDate, formatTime } from "@/utils/format";

type Step = "list" | "doctors" | "detail" | "history";

function buildWeekStrip(base: Date) {
  const result: { date: string; day: number; weekday: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    result.push({
      date: d.toISOString().slice(0, 10),
      day: d.getDate(),
      weekday: d.toLocaleString("en-US", { weekday: "short" }).slice(0, 3),
    });
  }
  return result;
}

export function PatientAppointmentsScreen() {
  const { accessToken } = useAuth();
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [step, setStep] = useState<Step>("list");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [nextDoctors, nextAppointments, nextSymptoms] = await Promise.all([
        api.listDoctors(),
        api.patientAppointments(accessToken),
        api.listSymptomsCatalog(accessToken),
      ]);
      setDoctors(nextDoctors);
      setAppointments(nextAppointments);
      setSymptoms(nextSymptoms.slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load appointments");
    }
  }, [accessToken]);
  useFocusReload(load);

  async function selectDoctor(doctor: DoctorProfile) {
    if (!accessToken) return;
    setSelectedDoctor(doctor);
    setSelectedSlot(null);
    const slots = await api.availableSlots(accessToken, doctor.id, selectedDate).catch(() => []);
    setAvailableSlots(slots);
    setStep("detail");
  }

  async function changeDate(date: string) {
    if (!accessToken || !selectedDoctor) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    const slots = await api.availableSlots(accessToken, selectedDoctor.id, date).catch(() => []);
    setAvailableSlots(slots);
  }

  async function book() {
    if (!accessToken || !selectedDoctor || !selectedSlot) return;
    await api.createAppointment(accessToken, {
      doctor_id: selectedDoctor.id,
      scheduled_at: `${selectedDate}T${selectedSlot}:00`,
      reason: reason || undefined,
      selected_symptom_ids: selectedSymptoms.length ? selectedSymptoms : undefined,
    });
    setShowSuccess(true);
    setReason("");
    setSelectedSymptoms([]);
    await load();
  }

  function backToHome() {
    setShowSuccess(false);
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setStep("list");
  }

  async function cancelAppointment(id: string) {
    if (!accessToken) return;
    await api.cancelAppointment(accessToken, id).catch(() => undefined);
    await load();
  }

  const symptomSet = useMemo(() => new Set(selectedSymptoms), [selectedSymptoms]);
  const weekStrip = useMemo(() => buildWeekStrip(new Date()), []);

  // ==== LIST STEP (default) ====
  if (step === "list") {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Appointments</Text>
          <Pressable style={styles.bellPill} onPress={() => setStep("doctors")}>
            <Feather name="plus" size={18} color="#E53F8F" />
          </Pressable>
        </View>

        <Pressable onPress={() => setStep("doctors")}>
          <GlassCard style={styles.bookCta}>
            <View style={styles.ctaIcon}>
              <Feather name="plus" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>Book a new appointment</Text>
              <Text style={styles.ctaMeta}>Pick a doctor and choose a slot</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#E53F8F" />
          </GlassCard>
        </Pressable>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>My appointments</Text>
        </View>

        {appointments.length ? (
          appointments.map((a) => (
            <GlassCard key={a.id} style={styles.apptCard}>
              <View style={[styles.statusBar, { backgroundColor: statusColor(a.status) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.apptDate}>{formatDate(a.scheduled_at)}</Text>
                <Text style={styles.apptTime}>{formatTime(a.scheduled_at.slice(11, 16))}</Text>
                <Text style={styles.apptReason}>{a.reason || "General consultation"}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[styles.statusChip, { backgroundColor: statusBg(a.status) }]}>
                  <Text style={[styles.statusText, { color: statusColor(a.status) }]}>
                    {a.status}
                  </Text>
                </View>
                {(a.status === "pending" || a.status === "confirmed") && (
                  <Pressable onPress={() => cancelAppointment(a.id)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </GlassCard>
          ))
        ) : (
          <GlassCard>
            <Text style={styles.empty}>No appointments yet.</Text>
          </GlassCard>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </AppScreen>
    );
  }

  // ==== DOCTOR LIST STEP ====
  if (step === "doctors") {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => setStep("list")}>
            <Feather name="chevron-left" size={22} color="#231F29" />
          </Pressable>
          <Text style={styles.title}>Top Doctors</Text>
          <View style={{ width: 40 }} />
        </View>

        {doctors.map((doctor) => (
          <Pressable key={doctor.id} onPress={() => selectDoctor(doctor)}>
            <GlassCard style={styles.doctorCard}>
              <View style={styles.docAvatar}>
                <Text style={styles.docAvatarText}>
                  {doctor.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName}>{doctor.full_name}</Text>
                <Text style={styles.docSpec}>
                  {doctor.specialization || "Gynecologist"}
                </Text>
                <View style={styles.docMetaRow}>
                  <Feather name="star" size={12} color="#E53F8F" />
                  <Text style={styles.docMetaText}>4.7</Text>
                  <Feather name="map-pin" size={12} color="#7F7486" style={{ marginLeft: 8 }} />
                  <Text style={styles.docMetaText}>800m away</Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        ))}

        {doctors.length === 0 && (
          <GlassCard>
            <Text style={styles.empty}>No doctors available.</Text>
          </GlassCard>
        )}
      </AppScreen>
    );
  }

  // ==== DOCTOR DETAIL / SLOT PICKER ====
  if (step === "detail" && selectedDoctor) {
    return (
      <AppScreen>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => setStep("doctors")}>
            <Feather name="chevron-left" size={22} color="#231F29" />
          </Pressable>
          <Text style={styles.title}>Doctor Detail</Text>
          <View style={{ width: 40 }} />
        </View>

        <GlassCard style={styles.detailCard}>
          <View style={styles.docAvatarLarge}>
            <Text style={styles.docAvatarLargeText}>
              {selectedDoctor.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.docName}>{selectedDoctor.full_name}</Text>
            <Text style={styles.docSpec}>
              {selectedDoctor.specialization || "Gynecologist"}
            </Text>
            <View style={styles.docMetaRow}>
              <Feather name="star" size={12} color="#E53F8F" />
              <Text style={styles.docMetaText}>4.7</Text>
              <Feather name="map-pin" size={12} color="#7F7486" style={{ marginLeft: 8 }} />
              <Text style={styles.docMetaText}>800m away</Text>
            </View>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          {selectedDoctor.bio ||
            "Dedicated specialist focused on women's health and personalized care."}
        </Text>

        {/* Date strip */}
        <View style={styles.dateStrip}>
          {weekStrip.map((d) => {
            const active = d.date === selectedDate;
            return (
              <Pressable
                key={d.date}
                onPress={() => changeDate(d.date)}
                style={[styles.dateCell, active && styles.dateCellActive]}
              >
                <Text style={[styles.dateWeekday, active && styles.dateTextActive]}>
                  {d.weekday}
                </Text>
                <Text style={[styles.dateDay, active && styles.dateTextActive]}>
                  {d.day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Slots grid */}
        <View style={styles.slotGrid}>
          {availableSlots.length ? (
            availableSlots.map((slot) => {
              const active = selectedSlot === slot.start_time;
              return (
                <Pressable
                  key={slot.start_time}
                  onPress={() => setSelectedSlot(slot.start_time)}
                  style={[styles.slot, active && styles.slotActive]}
                >
                  <Text style={[styles.slotText, active && styles.slotTextActive]}>
                    {formatTime(slot.start_time)}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.empty}>No slots available for this date.</Text>
          )}
        </View>

        {/* Symptoms */}
        <Text style={styles.sectionTitle}>Symptoms (optional)</Text>
        <View style={styles.chipRow}>
          {symptoms.map((s) => {
            const active = symptomSet.has(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() =>
                  setSelectedSymptoms((c) =>
                    active ? c.filter((id) => id !== s.id) : [...c, s.id]
                  )
                }
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {s.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <AppInput label="Reason" value={reason} onChangeText={setReason} />

        <PrimaryButton label="Book Appointment" onPress={book} disabled={!selectedSlot} />

        {/* Success modal */}
        <Modal visible={showSuccess} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.successIcon}>
                <Feather name="check" size={32} color="#E53F8F" />
              </View>
              <Text style={styles.successTitle}>Booking Success</Text>
              <Text style={styles.successText}>
                Your booking has been successful, you can have a consultation session with your trusted doctor
              </Text>
              <PrimaryButton label="Back to Home" onPress={backToHome} />
            </View>
          </View>
        </Modal>
      </AppScreen>
    );
  }

  return null;
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
  title: { fontSize: 22, fontWeight: "800", color: "#231F29" },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bellPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  bookCta: { flexDirection: "row", alignItems: "center", gap: 12 },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E53F8F",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTitle: { fontSize: 14, fontWeight: "800", color: "#231F29" },
  ctaMeta: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#231F29" },
  apptCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 0 },
  statusBar: { width: 4, alignSelf: "stretch", borderRadius: 2, marginRight: 4 },
  apptDate: { fontSize: 14, fontWeight: "800", color: "#231F29" },
  apptTime: { fontSize: 12, color: "#E53F8F", marginTop: 2, fontWeight: "700" },
  apptReason: { fontSize: 12, color: "#7F7486", marginTop: 4 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  cancelText: { fontSize: 11, color: "#E25555", fontWeight: "700" },
  doctorCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  docAvatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  docAvatarText: { fontSize: 22, fontWeight: "800", color: "#E53F8F" },
  docAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  docAvatarLargeText: { fontSize: 28, fontWeight: "800", color: "#E53F8F" },
  docName: { fontSize: 15, fontWeight: "800", color: "#231F29" },
  docSpec: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  docMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  docMetaText: { fontSize: 11, color: "#7F7486", fontWeight: "600" },
  detailCard: { flexDirection: "row", gap: 12 },
  aboutText: { fontSize: 12, color: "#7F7486", lineHeight: 18 },
  dateStrip: { flexDirection: "row", gap: 6 },
  dateCell: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    gap: 4,
  },
  dateCellActive: { backgroundColor: "#E53F8F" },
  dateWeekday: { fontSize: 11, color: "#7F7486", fontWeight: "700" },
  dateDay: { fontSize: 16, color: "#231F29", fontWeight: "800" },
  dateTextActive: { color: "#FFFFFF" },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    minWidth: 90,
    alignItems: "center",
  },
  slotActive: { backgroundColor: "#E53F8F" },
  slotText: { color: "#231F29", fontWeight: "700", fontSize: 12 },
  slotTextActive: { color: "#FFFFFF" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFF6FA",
    borderWidth: 1,
    borderColor: "#F0DCE7",
  },
  chipActive: { backgroundColor: "#E53F8F", borderColor: "#E53F8F" },
  chipText: { color: "#7F7486", fontWeight: "600", fontSize: 12 },
  chipTextActive: { color: "#FFFFFF" },
  empty: { color: "#7F7486", fontSize: 13 },
  error: { color: "#E25555" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(35,31,41,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  successText: {
    fontSize: 13,
    color: "#7F7486",
    textAlign: "center",
    lineHeight: 20,
  },
});
