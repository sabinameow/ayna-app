export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required";
  if (!EMAIL_REGEX.test(trimmed)) return "Use format name@example.com";
  return null;
}

// Phone helpers — format: +7 XXX XXX XX XX (Kazakhstan / Russia)
export function formatPhone(input: string): string {
  // Keep only digits; force leading 7
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11); // 7 + 10 national digits

  const rest = digits.slice(1);
  let out = "+7";
  if (rest.length > 0) out += " " + rest.slice(0, 3);
  if (rest.length > 3) out += " " + rest.slice(3, 6);
  if (rest.length > 6) out += " " + rest.slice(6, 8);
  if (rest.length > 8) out += " " + rest.slice(8, 10);
  return out;
}

export function validatePhone(value: string, required = false): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return required ? "Phone is required" : null;
  if (!digits.startsWith("7")) return "Phone must start with +7";
  if (digits.length !== 11) return "Use format +7 XXX XXX XX XX";
  return null;
}

export function validateName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Name is required";
  if (trimmed.length < 2) return "Name is too short";
  if (trimmed.length > 60) return "Name is too long";
  // Letters, spaces, hyphens, apostrophes — no digits
  if (!/^[\p{L}][\p{L}\s'\-]*$/u.test(trimmed)) {
    return "Name cannot contain numbers or symbols";
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Password is required";
  if (value.length < 8) return "Use at least 8 characters";
  if (!/[A-Z]/.test(value)) return "Include one uppercase letter";
  if (!/[a-z]/.test(value)) return "Include one lowercase letter";
  if (!/\d/.test(value)) return "Include one number";
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "Confirm your password";
  if (password !== confirm) return "Passwords do not match";
  return null;
}
