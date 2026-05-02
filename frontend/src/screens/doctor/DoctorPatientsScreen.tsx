import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import { saveFeedbackLabel, useSaveFeedback } from "@/hooks/useSaveFeedback";
import type {
  Cycle,
  Medication,
  MoodEntry,
  PatientProfile,
  PatientSymptom,
  ProgressSummary,
  Recommendation,
} from "@/types/api";
import { formatDate } from "@/utils/format";

// ── Tab bar ──────────────────────────────────────────────────────────────────
const TABS = ["Overview", "Cycle", "Symptoms", "Mood", "Medications", "Progress"] as const;
type Tab = (typeof TABS)[number];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={tabStyles.scroll}
      contentContainerStyle={tabStyles.row}
    >
      {TABS.map((tab) => (
        <Pressable
          key={tab}
          onPress={() => onChange(tab)}
          style={[tabStyles.tab, active === tab && tabStyles.tabActive]}
        >
          <Text style={[tabStyles.label, active === tab && tabStyles.labelActive]}>{tab}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const tabStyles = StyleSheet.create({
  scroll: { marginHorizontal: -18, marginBottom: 16 },
  row: { paddingHorizontal: 18, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F2F4F8",
  },
  tabActive: { backgroundColor: "#3F6CF6" },
  label: { fontSize: 13, fontWeight: "600", color: "#7F7486" },
  labelActive: { color: "#FFFFFF" },
});

// ── Filter chips ─────────────────────────────────────────────────────────────
type Filter = "all" | "irregular" | "active_meds" | "new";

function FilterChips({
  active,
  onChange,
}: {
  active: Filter;
  onChange: (f: Filter) => void;
}) {
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All patients" },
    { key: "irregular", label: "Irregular cycle" },
    { key: "active_meds", label: "Active treatment" },
    { key: "new", label: "New patient" },
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.row}
    >
      {filters.map((f) => (
        <Pressable
          key={f.key}
          onPress={() => onChange(f.key)}
          style={[filterStyles.chip, active === f.key && filterStyles.chipActive]}
        >
          <Text style={[filterStyles.label, active === f.key && filterStyles.labelActive]}>
            {f.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const filterStyles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D9E1FF",
    backgroundColor: "#F7F9FF",
  },
  chipActive: { backgroundColor: "#EAF0FF", borderColor: "#3F6CF6" },
  label: { fontSize: 13, color: "#7F7486", fontWeight: "600" },
  labelActive: { color: "#3F6CF6" },
});

// ── Patient card ──────────────────────────────────────────────────────────────
function PatientCard({
  patient,
  selected,
  onPress,
}: {
  patient: PatientProfile;
  selected: boolean;
  onPress: () => void;
}) {
  const isIrregular = Math.abs(patient.average_cycle_length - 28) > 5;
  return (
    <Pressable
      onPress={onPress}
      style={[cardStyles.card, selected && cardStyles.cardActive]}
    >
      <View style={cardStyles.avatar}>
        <Text style={cardStyles.avatarText}>{patient.full_name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cardStyles.name}>{patient.full_name}</Text>
        <Text style={cardStyles.meta}>
          {patient.average_cycle_length}-day cycle • {patient.average_period_length}-day period
        </Text>
        {patient.date_of_birth ? (
          <Text style={cardStyles.meta}>DOB: {formatDate(patient.date_of_birth)}</Text>
        ) : null}
      </View>
      {isIrregular && (
        <View style={cardStyles.alertBadge}>
          <Feather name="alert-circle" size={14} color="#DD8A29" />
        </View>
      )}
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E1FF",
    backgroundColor: "#F7F9FF",
    marginBottom: 10,
  },
  cardActive: { backgroundColor: "#EAF0FF", borderColor: "#3F6CF6" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3F6CF6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFF", fontWeight: "800", fontSize: 18 },
  name: { fontWeight: "700", color: "#231F29", fontSize: 15 },
  meta: { color: "#6E7690", marginTop: 2, fontSize: 12 },
  alertBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF4E8",
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export function DoctorPatientsScreen() {
  const { accessToken } = useAuth();
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [selected, setSelected] = useState<PatientProfile | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  // Patient detail data
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [symptoms, setSymptoms] = useState<PatientSymptom[]>([]);
  const [mood, setMood] = useState<MoodEntry[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);

  // Form state
  const [recText, setRecText] = useState("");
  const [recPriority, setRecPriority] = useState("");
  const [medName, setMedName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [instructions, setInstructions] = useState("");
  const prescribeFeedback = useSaveFeedback();
  const recommendationFeedback = useSaveFeedback();

  const loadPatients = useCallback(() => {
    if (!accessToken) return;
    void api.doctorPatients(accessToken).then(setPatients).catch(() => undefined);
  }, [accessToken]);
  useFocusReload(loadPatients);

  useEffect(() => {
    if (!accessToken || !selected) return;
    void Promise.all([
      api.doctorPatientCycles(accessToken, selected.id),
      api.doctorPatientSymptoms(accessToken, selected.id),
      api.doctorPatientMood(accessToken, selected.id),
      api.doctorPatientMedications(accessToken, selected.id),
      api.doctorPatientRecommendations(accessToken, selected.id),
      api.doctorPatientProgress(accessToken, selected.id),
    ]).then(([c, s, m, meds, recs, prog]) => {
      setCycles(c);
      setSymptoms(s);
      setMood(m);
      setMedications(meds);
      setRecommendations(recs);
      setProgress(prog);
    });
  }, [accessToken, selected]);

  async function addRecommendation() {
    if (!accessToken || !selected || !recText.trim()) return;
    recommendationFeedback.markSaving();
    try {
      await api.createDoctorRecommendation(accessToken, selected.id, recText.trim());
      setRecText("");
      setRecPriority("");
      const next = await api.doctorPatientRecommendations(accessToken, selected.id);
      setRecommendations(next);
      recommendationFeedback.markSaved();
    } catch {
      recommendationFeedback.markError();
    }
  }

  async function prescribe() {
    if (!accessToken || !selected || !medName || !dosage || !frequency) return;
    prescribeFeedback.markSaving();
    try {
      await api.prescribeMedication(accessToken, selected.id, {
        patient_id: selected.id,
        name: medName,
        dosage,
        frequency,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: duration || undefined,
        instructions: instructions || undefined,
      });
      setMedName("");
      setDosage("");
      setFrequency("");
      setDuration("");
      setInstructions("");
      const next = await api.doctorPatientMedications(accessToken, selected.id);
      setMedications(next);
      prescribeFeedback.markSaved();
    } catch {
      prescribeFeedback.markError();
    }
  }

  const filteredPatients = useMemo(() => {
    let list = patients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.full_name.toLowerCase().includes(q));
    }
    switch (filter) {
      case "irregular":
        return list.filter((p) => Math.abs(p.average_cycle_length - 28) > 5);
      case "new":
        return list.filter((p) => !p.doctor_id);
      default:
        return list;
    }
  }, [patients, search, filter]);

  // ── Render patient detail ────────────────────────────────────────────────
  function renderDetailTab() {
    if (!selected) return null;
    switch (activeTab) {
      case "Overview":
        return (
          <>
            <GlassCard style={styles.infoCard}>
              <Text style={styles.infoLabel}>Cycle summary</Text>
              <Text style={styles.infoValue}>
                {selected.average_cycle_length}-day average cycle •{" "}
                {selected.average_period_length}-day average period
              </Text>
              {cycles[0] ? (
                <Text style={styles.infoSub}>Last cycle started {formatDate(cycles[0].start_date)}</Text>
              ) : null}
            </GlassCard>
            <GlassCard style={styles.infoCard}>
              <Text style={styles.infoLabel}>Recent symptoms</Text>
              {symptoms.slice(0, 3).map((s) => (
                <View key={s.id} style={styles.dataRow}>
                  <Text style={styles.dataText}>{formatDate(s.date)}</Text>
                  <Text style={styles.dataChip}>Severity {s.severity}/10</Text>
                </View>
              ))}
              {!symptoms.length && <Text style={styles.empty}>No symptom logs</Text>}
            </GlassCard>
            <GlassCard style={styles.infoCard}>
              <Text style={styles.infoLabel}>Mood trend</Text>
              {mood.slice(0, 3).map((m) => (
                <View key={m.id} style={styles.dataRow}>
                  <Text style={styles.dataText}>{m.mood}</Text>
                  <Text style={styles.dataChip}>{formatDate(m.date)}</Text>
                </View>
              ))}
              {!mood.length && <Text style={styles.empty}>No mood entries</Text>}
            </GlassCard>
            <GlassCard style={styles.infoCard}>
              <Text style={styles.infoLabel}>Latest recommendation</Text>
              {recommendations[0] ? (
                <Text style={styles.recText}>{recommendations[0].content}</Text>
              ) : (
                <Text style={styles.empty}>No recommendations yet</Text>
              )}
            </GlassCard>
          </>
        );

      case "Cycle":
        return (
          <GlassCard>
            <Text style={styles.tabTitle}>Cycle history</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{selected.average_cycle_length}</Text>
                <Text style={styles.statLabel}>Avg length</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{selected.average_period_length}</Text>
                <Text style={styles.statLabel}>Avg period</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{cycles.length}</Text>
                <Text style={styles.statLabel}>Cycles logged</Text>
              </View>
            </View>
            {cycles.map((c) => (
              <View key={c.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>
                    {formatDate(c.start_date)}
                    {c.end_date ? ` → ${formatDate(c.end_date)}` : " (ongoing)"}
                  </Text>
                  {c.notes ? <Text style={styles.listMeta}>{c.notes}</Text> : null}
                </View>
                {c.cycle_length ? (
                  <Text style={styles.dataChip}>{c.cycle_length}d</Text>
                ) : null}
              </View>
            ))}
            {!cycles.length && <Text style={styles.empty}>No cycle data recorded.</Text>}
          </GlassCard>
        );

      case "Symptoms":
        return (
          <GlassCard>
            <Text style={styles.tabTitle}>Symptom timeline</Text>
            {symptoms.map((s) => (
              <View key={s.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{formatDate(s.date)}</Text>
                  {s.notes ? <Text style={styles.listMeta}>{s.notes}</Text> : null}
                </View>
                <View
                  style={[
                    styles.severityBadge,
                    s.severity >= 7
                      ? { backgroundColor: "#FBE7E7" }
                      : s.severity >= 4
                      ? { backgroundColor: "#FFF4E8" }
                      : { backgroundColor: "#E8F7EE" },
                  ]}
                >
                  <Text
                    style={[
                      styles.severityText,
                      s.severity >= 7
                        ? { color: "#B44747" }
                        : s.severity >= 4
                        ? { color: "#9B5E11" }
                        : { color: "#2C8C5A" },
                    ]}
                  >
                    {s.severity}/10
                  </Text>
                </View>
              </View>
            ))}
            {!symptoms.length && <Text style={styles.empty}>No symptom logs recorded.</Text>}
          </GlassCard>
        );

      case "Mood":
        return (
          <GlassCard>
            <Text style={styles.tabTitle}>Mood history</Text>
            {mood.map((m) => (
              <View key={m.id} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>
                    {m.mood.charAt(0).toUpperCase() + m.mood.slice(1)} — {formatDate(m.date)}
                  </Text>
                  <Text style={styles.listMeta}>
                    Energy {m.energy_level}/10 · Stress {m.stress_level}/10 · Sleep{" "}
                    {m.sleep_quality}/10
                  </Text>
                </View>
              </View>
            ))}
            {!mood.length && <Text style={styles.empty}>No mood entries recorded.</Text>}
          </GlassCard>
        );

      case "Medications":
        return (
          <>
            <GlassCard>
              <Text style={styles.tabTitle}>Active medications</Text>
              {medications.filter((m) => m.is_active).map((m) => (
                <View key={m.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{m.name}</Text>
                    <Text style={styles.listMeta}>
                      {m.dosage} · {m.frequency}
                    </Text>
                    {m.instructions ? (
                      <Text style={styles.listMeta}>{m.instructions}</Text>
                    ) : null}
                  </View>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Active</Text>
                  </View>
                </View>
              ))}
              {!medications.filter((m) => m.is_active).length && (
                <Text style={styles.empty}>No active medications.</Text>
              )}
            </GlassCard>

            <GlassCard>
              <Text style={styles.tabTitle}>Prescribe medication</Text>
              <AppInput label="Medication name" value={medName} onChangeText={setMedName} />
              <AppInput label="Dosage (e.g. 500mg)" value={dosage} onChangeText={setDosage} />
              <AppInput
                label="Frequency (e.g. twice daily)"
                value={frequency}
                onChangeText={setFrequency}
              />
              <AppInput
                label="End date (optional, YYYY-MM-DD)"
                value={duration}
                onChangeText={setDuration}
              />
              <AppInput
                label="Instructions (optional)"
                value={instructions}
                onChangeText={setInstructions}
              />
              <PrimaryButton
                label={saveFeedbackLabel(prescribeFeedback.status, "Prescribe medication", "Prescribed")}
                onPress={prescribe}
                disabled={!medName || !dosage || !frequency || prescribeFeedback.status === "saving"}
                feedbackStatus={prescribeFeedback.status}
                style={{ backgroundColor: "#3F6CF6" }}
              />
            </GlassCard>
          </>
        );

      case "Progress":
        return (
          <>
            <View style={styles.progressGrid}>
              {[
                { label: "Cycles logged", value: progress?.total_cycles ?? 0 },
                { label: "Symptoms logged", value: progress?.total_symptoms_logged ?? 0 },
                { label: "Mood entries", value: progress?.total_mood_entries ?? 0 },
                { label: "Active meds", value: progress?.active_medications ?? 0 },
                { label: "Completed visits", value: progress?.completed_appointments ?? 0 },
              ].map((item) => (
                <GlassCard key={item.label} style={styles.progressCard}>
                  <Text style={styles.progressValue}>{item.value}</Text>
                  <Text style={styles.progressLabel}>{item.label}</Text>
                </GlassCard>
              ))}
            </View>

            <GlassCard>
              <Text style={styles.tabTitle}>Add recommendation</Text>
              <AppInput
                label="Clinical note or recommendation"
                value={recText}
                onChangeText={setRecText}
              />
              <AppInput
                label="Priority (optional)"
                value={recPriority}
                onChangeText={setRecPriority}
              />
              <PrimaryButton
                label={saveFeedbackLabel(recommendationFeedback.status, "Add recommendation", "Added")}
                onPress={addRecommendation}
                disabled={!recText.trim() || recommendationFeedback.status === "saving"}
                feedbackStatus={recommendationFeedback.status}
                style={{ backgroundColor: "#3F6CF6" }}
              />
            </GlassCard>

            <GlassCard>
              <Text style={styles.tabTitle}>Previous recommendations</Text>
              {recommendations.map((r) => (
                <View key={r.id} style={styles.listRow}>
                  <Text style={styles.listTitle}>{r.content}</Text>
                  <Text style={styles.listMeta}>{formatDate(r.created_at)}</Text>
                </View>
              ))}
              {!recommendations.length && (
                <Text style={styles.empty}>No recommendations yet.</Text>
              )}
            </GlassCard>
          </>
        );
    }
  }

  // ── Back to list ─────────────────────────────────────────────────────────
  if (selected) {
    const isIrregular = Math.abs(selected.average_cycle_length - 28) > 5;
    return (
      <AppScreen>
        {/* Patient detail header */}
        <View style={styles.detailHeader}>
          <Pressable onPress={() => setSelected(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={18} color="#3F6CF6" />
            <Text style={styles.backText}>Patients</Text>
          </Pressable>
        </View>

        <GlassCard style={[styles.patientBanner, isIrregular && styles.patientBannerAlert]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={styles.bigAvatar}>
              <Text style={styles.bigAvatarText}>
                {selected.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientDetailName}>{selected.full_name}</Text>
              {selected.date_of_birth ? (
                <Text style={styles.patientDetailMeta}>
                  DOB: {formatDate(selected.date_of_birth)}
                </Text>
              ) : null}
              <Text style={styles.patientDetailMeta}>
                Assigned patient
              </Text>
            </View>
            {isIrregular && (
              <View style={styles.flagChip}>
                <Feather name="alert-circle" size={12} color="#DD8A29" />
                <Text style={styles.flagText}>Irregular</Text>
              </View>
            )}
          </View>
        </GlassCard>

        <TabBar active={activeTab} onChange={setActiveTab} />

        {renderDetailTab()}
      </AppScreen>
    );
  }

  // ── Patient list ─────────────────────────────────────────────────────────
  return (
    <AppScreen>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>Patients</Text>
        <Text style={styles.screenSubtitle}>
          {patients.length} assigned patient{patients.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color="#7F7486" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search patients..."
          placeholderTextColor="#B0A8B9"
          style={styles.searchInput}
        />
      </View>

      {/* Filter chips */}
      <FilterChips active={filter} onChange={setFilter} />

      {/* Patient cards */}
      {filteredPatients.length ? (
        filteredPatients.map((p) => (
          <PatientCard
            key={p.id}
            patient={p}
            selected={false}
            onPress={() => {
              setSelected(p);
              setActiveTab("Overview");
            }}
          />
        ))
      ) : (
        <GlassCard>
          <Text style={styles.empty}>
            {search ? "No patients match your search." : "No patients assigned yet."}
          </Text>
        </GlassCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  listHeader: { marginBottom: 16 },
  screenTitle: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  screenSubtitle: { fontSize: 13, color: "#7F7486", marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F2F4F8",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: "#231F29", fontSize: 14 },
  detailHeader: { marginBottom: 14 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backText: { color: "#3F6CF6", fontWeight: "700", fontSize: 15 },
  patientBanner: { backgroundColor: "#EAF0FF", marginBottom: 16 },
  patientBannerAlert: { backgroundColor: "#FFFBF2", borderWidth: 1, borderColor: "#F5D5A8" },
  bigAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#3F6CF6",
    alignItems: "center",
    justifyContent: "center",
  },
  bigAvatarText: { color: "#FFF", fontWeight: "800", fontSize: 22 },
  patientDetailName: { fontSize: 18, fontWeight: "800", color: "#231F29" },
  patientDetailMeta: { fontSize: 12, color: "#6E7690", marginTop: 2 },
  flagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF4E8",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  flagText: { fontSize: 11, color: "#9B5E11", fontWeight: "700" },
  // Info cards (Overview tab)
  infoCard: { backgroundColor: "#F7F9FF" },
  infoLabel: { fontSize: 12, color: "#7F7486", fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { color: "#231F29", fontWeight: "600", fontSize: 14 },
  infoSub: { color: "#7F7486", fontSize: 12, marginTop: 4 },
  dataRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#D9E1FF" },
  dataText: { color: "#231F29", fontSize: 13, fontWeight: "600" },
  dataChip: { fontSize: 11, color: "#3F6CF6", backgroundColor: "#EAF0FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontWeight: "700" },
  recText: { color: "#231F29", lineHeight: 22, fontSize: 14 },
  // Tab content
  tabTitle: { fontSize: 16, fontWeight: "800", color: "#231F29", marginBottom: 14 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: "#EAF0FF", borderRadius: 14, padding: 12, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#3F6CF6" },
  statLabel: { fontSize: 11, color: "#7F7486", marginTop: 4, textAlign: "center" },
  listRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#D9E1FF", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  listTitle: { color: "#231F29", fontWeight: "600", fontSize: 14 },
  listMeta: { color: "#7F7486", fontSize: 12, marginTop: 2 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  severityText: { fontSize: 12, fontWeight: "700" },
  activePill: { backgroundColor: "#E8F7EE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  activePillText: { color: "#2C8C5A", fontSize: 11, fontWeight: "700" },
  progressGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  progressCard: { width: "47%", alignItems: "center", paddingVertical: 16, backgroundColor: "#F7F9FF" },
  progressValue: { fontSize: 28, fontWeight: "800", color: "#3F6CF6" },
  progressLabel: { fontSize: 11, color: "#7F7486", marginTop: 4, textAlign: "center" },
  empty: { color: "#7F7486", fontSize: 14 },
});
