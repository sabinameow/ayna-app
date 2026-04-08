import enum


class UserRole(str, enum.Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    MANAGER = "manager"

class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class FlowIntensity(str, enum.Enum):
    NONE = "none"
    LIGHT = "light"
    MEDIUM = "medium"
    HEAVY = "heavy"


class MoodLevel(str, enum.Enum):
    GREAT = "great"
    GOOD = "good"
    OKAY = "okay"
    BAD = "bad"
    TERRIBLE = "terrible"


class ChatSessionStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"