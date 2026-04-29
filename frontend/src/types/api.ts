export type UserRole = "patient" | "doctor" | "manager";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type MoodLevel = "great" | "good" | "okay" | "bad" | "terrible";
export type FlowIntensity = "none" | "light" | "medium" | "heavy";
export type ChatSessionStatus = "active" | "closed";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type User = {
  id: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
};

export type PatientProfile = {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth?: string | null;
  doctor_id?: string | null;
  average_cycle_length: number;
  average_period_length: number;
};

export type DoctorProfile = {
  id: string;
  user_id: string;
  full_name: string;
  specialization?: string | null;
  bio?: string | null;
  is_available: boolean;
};

export type ManagerProfile = {
  id: string;
  user_id: string;
  full_name: string;
  assigned_doctor_id?: string | null;
};

export type CyclePrediction = {
  predicted_start_date: string;
  predicted_end_date: string;
  predicted_ovulation_date: string;
  average_cycle_length: number;
};

export type Cycle = {
  id: string;
  patient_id: string;
  start_date: string;
  end_date?: string | null;
  cycle_length?: number | null;
  period_length?: number | null;
  is_predicted: boolean;
  notes?: string | null;
};

export type CycleDay = {
  id: string;
  patient_id: string;
  date: string;
  flow_intensity: FlowIntensity;
  temperature?: string | null;
  notes?: string | null;
};

export type MoodEntry = {
  id: string;
  patient_id: string;
  date: string;
  mood: MoodLevel;
  energy_level: number;
  stress_level: number;
  sleep_quality: number;
  notes?: string | null;
};

export type MoodStats = {
  total_entries: number;
  average_energy: number;
  average_stress: number;
  average_sleep: number;
  mood_distribution: Record<string, number>;
};

export type Symptom = {
  id: string;
  name: string;
  category: string;
};

export type PatientSymptom = {
  id: string;
  patient_id: string;
  symptom_id: string;
  date: string;
  severity: number;
  notes?: string | null;
};

export type Medication = {
  id: string;
  patient_id: string;
  doctor_id: string;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date?: string | null;
  instructions?: string | null;
  is_active: boolean;
};

export type MedicationLog = {
  id: string;
  medication_id: string;
  patient_id: string;
  taken_at: string;
  skipped: boolean;
  notes?: string | null;
};

export type Recommendation = {
  id: string;
  doctor_id: string;
  patient_id: string;
  content: string;
  created_at: string;
};

export type AvailableSlot = {
  start_time: string;
  end_time: string;
};

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  status: AppointmentStatus;
  reason?: string | null;
  notes?: string | null;
  selected_symptom_ids?: string[] | null;
  required_tests?: string[] | null;
};

export type NotificationItem = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type UnreadCount = {
  unread: number;
};

export type Article = {
  id: string;
  title: string;
  summary: string;
  content?: string;
  requires_subscription?: boolean;
};

export type Schedule = {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
};

export type ChatSession = {
  id: string;
  patient_id: string;
  manager_id: string;
  status: ChatSessionStatus;
  summary?: string | null;
  created_at: string;
  closed_at?: string | null;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
};

export type ProgressSummary = {
  total_cycles?: number;
  total_symptoms_logged?: number;
  total_mood_entries?: number;
  active_medications?: number;
  completed_appointments?: number;
  [key: string]: number | undefined;
};
