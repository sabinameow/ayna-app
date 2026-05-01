import { API_BASE_URL, WS_BASE_URL } from "@/constants/config";
import type {
  Appointment,
  Article,
  AvailableSlot,
  ChatMessage,
  ChatSession,
  Cycle,
  CycleDay,
  CyclePrediction,
  DoctorProfile,
  ManagerProfile,
  Medication,
  MedicationLog,
  MoodEntry,
  MoodStats,
  NotificationItem,
  PatientProfile,
  PatientSymptom,
  ProgressSummary,
  Recommendation,
  Schedule,
  Symptom,
  TokenResponse,
  UnreadCount,
  User,
} from "@/types/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  token?: string | null;
  body?: unknown;
};

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function formatErrorDetail(detail: unknown) {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as { msg?: string; loc?: unknown[] };
          const field = Array.isArray(record.loc) ? String(record.loc.at(-1) ?? "") : "";
          return field ? `${field}: ${record.msg ?? "Invalid value"}` : record.msg ?? "Invalid value";
        }
        return "Invalid value";
      })
      .join("\n");
  }

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  return null;
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const { method = "GET", body, token } = options;
  const endpoint = `${API_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message.trim() : "";
    const isConnectivityError =
      !rawMessage ||
      /network request failed|request failed|load failed|failed to fetch/i.test(rawMessage);

    const message = isConnectivityError
      ? `Could not reach the API at ${API_BASE_URL}. Make sure the backend is running and your phone can open ${API_BASE_URL}/health on the same Wi-Fi.`
      : `${rawMessage} (${endpoint})`;
    throw new ApiError(0, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      formatErrorDetail(data?.detail) ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, detail);
  }

  return data as T;
}

export const api = {
  error: ApiError,
  login: (email: string, password: string) =>
    request<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  register: (payload: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirm: string;
  }) =>
    request<User>("/api/v1/auth/register", {
      method: "POST",
      body: payload,
    }),
  me: (token: string) => request<User>("/api/v1/auth/me", { token }),
  patientProfile: (token: string) =>
    request<PatientProfile>("/api/v1/patient/profile", { token }),
  updatePatientProfile: (token: string, payload: Partial<PatientProfile>) =>
    request<PatientProfile>("/api/v1/patient/profile", {
      method: "PUT",
      token,
      body: payload,
    }),
  listDoctors: () => request<DoctorProfile[]>("/api/v1/doctors"),
  cyclePrediction: (token: string) =>
    request<CyclePrediction>("/api/v1/patient/cycles/predictions", { token }),
  listCycles: (token: string) => request<Cycle[]>("/api/v1/patient/cycles", { token }),
  createCycleDay: (
    token: string,
    payload: { date: string; flow_intensity: string; temperature?: string; notes?: string }
  ) =>
    request<CycleDay>("/api/v1/patient/cycle-days", {
      method: "POST",
      token,
      body: payload,
    }),
  listCycleDays: (token: string, month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.set("month", String(month));
    if (year) params.set("year", String(year));
    return request<CycleDay[]>(
      `/api/v1/patient/cycle-days${params.toString() ? `?${params}` : ""}`,
      { token }
    );
  },
  logPeriod: (token: string, startDate: string, duration: number) =>
    request<CycleDay[]>("/api/v1/patient/period", {
      method: "POST",
      token,
      body: { start_date: startDate, duration },
    }),
  deleteCycleDaysRange: (token: string, startDate: string, endDate: string) =>
    request<void>(`/api/v1/patient/cycle-days?start_date=${startDate}&end_date=${endDate}`, {
      method: "DELETE",
      token,
    }),
  listSymptomsCatalog: (token: string) =>
    request<Symptom[]>("/api/v1/symptoms/symptoms", { token }),
  listPatientSymptoms: (token: string) =>
    request<PatientSymptom[]>("/api/v1/symptoms/patient/symptoms", { token }),
  createPatientSymptom: (
    token: string,
    payload: { symptom_id: string; date: string; severity: number; notes?: string }
  ) =>
    request<PatientSymptom>("/api/v1/symptoms/patient/symptoms", {
      method: "POST",
      token,
      body: payload,
    }),
  listMoodEntries: (token: string) =>
    request<MoodEntry[]>("/api/v1/patient/mood", { token }),
  createMoodEntry: (
    token: string,
    payload: {
      date: string;
      mood: string;
      energy_level: number;
      stress_level: number;
      sleep_quality: number;
      notes?: string;
    }
  ) =>
    request<MoodEntry>("/api/v1/patient/mood", {
      method: "POST",
      token,
      body: payload,
    }),
  moodStats: (token: string) => request<MoodStats>("/api/v1/patient/mood/stats", { token }),
  patientMedications: (token: string) =>
    request<Medication[]>("/api/v1/patient/medications", { token }),
  medicationLogs: (token: string, medicationId: string) =>
    request<MedicationLog[]>(`/api/v1/patient/medications/${medicationId}/logs`, { token }),
  logMedication: (
    token: string,
    medicationId: string,
    payload: { skipped?: boolean; notes?: string }
  ) =>
    request<MedicationLog>(`/api/v1/patient/medications/${medicationId}/log`, {
      method: "POST",
      token,
      body: payload,
    }),
  patientRecommendations: (token: string) =>
    request<Recommendation[]>("/api/v1/patient/recommendations", { token }),
  patientProgress: (token: string) =>
    request<ProgressSummary>("/api/v1/patient/progress", { token }),
  patientAppointments: (token: string) =>
    request<Appointment[]>("/api/v1/patient/appointments", { token }),
  createAppointment: (
    token: string,
    payload: {
      doctor_id: string;
      scheduled_at: string;
      reason?: string;
      notes?: string;
      selected_symptom_ids?: string[];
    }
  ) =>
    request<Appointment>("/api/v1/patient/appointments", {
      method: "POST",
      token,
      body: payload,
    }),
  cancelAppointment: (token: string, appointmentId: string) =>
    request<void>(`/api/v1/patient/appointments/${appointmentId}`, {
      method: "DELETE",
      token,
    }),
  availableSlots: (token: string, doctorId: string, date: string) =>
    request<AvailableSlot[]>(`/api/v1/doctors/${doctorId}/available-slots?date=${date}`, {
      token,
    }),
  notifications: (token: string) =>
    request<NotificationItem[]>("/api/v1/notifications", { token }),
  unreadNotifications: (token: string) =>
    request<UnreadCount>("/api/v1/notifications/unread-count", { token }),
  markNotificationRead: (token: string, notificationId: string) =>
    request<NotificationItem>(`/api/v1/notifications/${notificationId}/read`, {
      method: "PUT",
      token,
    }),
  markAllNotificationsRead: (token: string) =>
    request<{ updated: number }>("/api/v1/notifications/read-all", {
      method: "PUT",
      token,
    }),
  updateDeviceToken: (token: string, deviceToken: string | null) =>
    request<{ device_token: string | null }>("/api/v1/notifications/device-token", {
      method: "PUT",
      token,
      body: { device_token: deviceToken },
    }),
  patientSessions: (token: string) =>
    request<ChatSession[]>("/api/v1/patient/chat/sessions", { token }),
  patientMessages: (token: string, sessionId: string) =>
    request<ChatMessage[]>(`/api/v1/patient/chat/sessions/${sessionId}/messages`, { token }),
  doctorProfile: (token: string) =>
    request<DoctorProfile>("/api/v1/doctor/profile", { token }),
  doctorPatients: (token: string) =>
    request<PatientProfile[]>("/api/v1/doctor/patients", { token }),
  doctorPatientCycles: (token: string, patientId: string) =>
    request<Cycle[]>(`/api/v1/doctor/patients/${patientId}/cycles`, { token }),
  doctorPatientSymptoms: (token: string, patientId: string) =>
    request<PatientSymptom[]>(`/api/v1/doctor/patients/${patientId}/symptoms`, { token }),
  doctorPatientMood: (token: string, patientId: string) =>
    request<MoodEntry[]>(`/api/v1/doctor/patients/${patientId}/mood`, { token }),
  doctorPatientMedications: (token: string, patientId: string) =>
    request<Medication[]>(`/api/v1/doctor/patients/${patientId}/medications`, { token }),
  doctorPatientRecommendations: (token: string, patientId: string) =>
    request<Recommendation[]>(`/api/v1/doctor/patients/${patientId}/recommendations`, { token }),
  doctorPatientProgress: (token: string, patientId: string) =>
    request<ProgressSummary>(`/api/v1/doctor/patients/${patientId}/progress`, { token }),
  createDoctorRecommendation: (token: string, patientId: string, content: string) =>
    request<Recommendation>(`/api/v1/doctor/patients/${patientId}/recommendations`, {
      method: "POST",
      token,
      body: { content },
    }),
  prescribeMedication: (
    token: string,
    patientId: string,
    payload: {
      patient_id: string;
      name: string;
      dosage: string;
      frequency: string;
      start_date: string;
      end_date?: string;
      instructions?: string;
    }
  ) =>
    request<Medication>(`/api/v1/doctor/patients/${patientId}/medications`, {
      method: "POST",
      token,
      body: payload,
    }),
  doctorAppointments: (token: string) =>
    request<Appointment[]>("/api/v1/doctor/appointments", { token }),
  doctorSchedule: (token: string) =>
    request<Schedule[]>("/api/v1/doctor/schedule", { token }),
  updateDoctorSchedule: (
    token: string,
    slots: { weekday: number; start_time: string; end_time: string; slot_duration_minutes: number }[]
  ) =>
    request<Schedule[]>("/api/v1/doctor/schedule", {
      method: "PUT",
      token,
      body: { slots },
    }),
  managerProfile: (token: string) =>
    request<ManagerProfile>("/api/v1/manager/profile", { token }),
  managerSessions: (token: string) =>
    request<ChatSession[]>("/api/v1/manager/chat/sessions", { token }),
  managerMessages: (token: string, sessionId: string) =>
    request<ChatMessage[]>(`/api/v1/manager/chat/sessions/${sessionId}/messages`, { token }),
  closeManagerSession: (token: string, sessionId: string) =>
    request<ChatSession>(`/api/v1/manager/chat/sessions/${sessionId}/close`, {
      method: "PUT",
      token,
    }),
  managerAppointments: (token: string) =>
    request<Appointment[]>("/api/v1/manager/appointments", { token }),
  updateManagerAppointment: (
    token: string,
    appointmentId: string,
    payload: { status?: string; notes?: string }
  ) =>
    request<Appointment>(`/api/v1/manager/appointments/${appointmentId}`, {
      method: "PUT",
      token,
      body: payload,
    }),
  deleteManagerAppointment: (token: string, appointmentId: string) =>
    request<void>(`/api/v1/manager/appointments/${appointmentId}`, {
      method: "DELETE",
      token,
    }),
  managerSchedules: (token: string) =>
    request<Schedule[]>("/api/v1/manager/schedules", { token }),
  articles: (token: string) => request<Article[]>("/api/v1/articles", { token }),
  makePatientChatSocket: (token: string) =>
    `${WS_BASE_URL}/api/v1/ws/chat?token=${encodeURIComponent(token)}`,
  makeManagerChatSocket: (token: string, sessionId: string) =>
    `${WS_BASE_URL}/api/v1/ws/chat?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(
      sessionId
    )}`,
};
