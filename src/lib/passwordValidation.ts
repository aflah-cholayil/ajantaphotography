import { z } from 'zod';

// Common weak passwords that should be rejected
// This list includes top passwords from data breaches
const COMMON_WEAK_PASSWORDS = new Set([
  // Top 100 most common passwords
  'password', 'password1', 'password123', 'password12', 'password!',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty1',
  'abc123', 'abcd1234', 'abcdefg', 'abcdef',
  'letmein', 'welcome', 'welcome1', 'welcome123',
  'admin', 'admin123', 'administrator', 'root', 'toor',
  'login', 'master', 'hello', 'hello123',
  'dragon', 'monkey', 'shadow', 'sunshine', 'princess',
  'football', 'baseball', 'soccer', 'hockey', 'batman',
  'superman', 'trustno1', 'iloveyou', 'love', 'lovely',
  'michael', 'jennifer', 'thomas', 'charlie', 'jessica',
  'andrew', 'joshua', 'ashley', 'daniel', 'amanda',
  '111111', '000000', '121212', '123123', '654321',
  '666666', '696969', '777777', '888888', '999999',
  'passw0rd', 'p@ssword', 'p@ssw0rd', 'pass1234',
  'test', 'test123', 'testing', 'guest', 'guest123',
  'mustang', 'access', 'access14', 'starwars',
  'whatever', 'thunder', 'ginger', 'hammer', 'silver',
  'killer', 'summer', 'changeme', 'computer', 'secret',
  // Keyboard patterns
  'asdfgh', 'asdfghjkl', 'zxcvbn', 'zxcvbnm',
  '1qaz2wsx', 'qazwsx', '!qaz2wsx', 'qaz123',
  // Sequential
  'aaaaaa', 'bbbbbb', 'cccccc',
  // Common phrases
  'letmein', 'iamadmin', 'god', 'jesus', 'money',
  // Company/product names often used
  'google', 'apple', 'facebook', 'amazon', 'microsoft',
  'linkedin', 'twitter', 'instagram', 'youtube',
  // Common years
  '2020', '2021', '2022', '2023', '2024', '2025', '2026',
  // Photography related (specific to this app)
  'photo', 'photo123', 'camera', 'camera123', 'studio', 'studio123',
  'gallery', 'gallery123', 'picture', 'picture123', 'wedding', 'wedding123',
  'ajanta', 'ajanta123', 'photography', 'photographer',
]);

const specialCharacters = "!@#$%^&*()_+-=[]{};':\"\\|,.<>/?";
const hasSpecialCharacter = (password: string) =>
  [...password].some((ch) => specialCharacters.includes(ch));

// Check if password contains sequential characters
const hasSequentialChars = (password: string): boolean => {
  const lower = password.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    const c1 = lower.charCodeAt(i);
    const c2 = lower.charCodeAt(i + 1);
    const c3 = lower.charCodeAt(i + 2);
    // Check for ascending sequence (abc, 123)
    if (c2 === c1 + 1 && c3 === c2 + 1) return true;
    // Check for descending sequence (cba, 321)
    if (c2 === c1 - 1 && c3 === c2 - 1) return true;
  }
  return false;
};

// Check if password has too many repeated characters
const hasRepeatedChars = (password: string): boolean => {
  const lower = password.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    if (lower[i] === lower[i + 1] && lower[i + 1] === lower[i + 2]) {
      return true;
    }
  }
  return false;
};

// Calculate password strength score (0-100)
export const calculatePasswordStrength = (password: string): {
  score: number;
  label: 'weak' | 'fair' | 'good' | 'strong';
  color: string;
} => {
  if (!password) {
    return { score: 0, label: 'weak', color: 'bg-destructive' };
  }

  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 15;
  if (password.length >= 10) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (hasSpecialCharacter(password)) score += 20;

  // Penalty for common patterns
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) score = Math.min(score, 10);
  if (hasSequentialChars(password)) score -= 15;
  if (hasRepeatedChars(password)) score -= 10;

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  let label: 'weak' | 'fair' | 'good' | 'strong';
  let color: string;

  if (score < 30) {
    label = 'weak';
    color = 'bg-destructive';
  } else if (score < 50) {
    label = 'fair';
    color = 'bg-orange-500';
  } else if (score < 75) {
    label = 'good';
    color = 'bg-yellow-500';
  } else {
    label = 'strong';
    color = 'bg-green-500';
  }

  return { score, label, color };
};

// Validate password and return error messages
export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
  strength: ReturnType<typeof calculatePasswordStrength>;
} => {
  const errors: string[] = [];

  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Require lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Require uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Require number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for common weak passwords
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common and easily guessable');
  }

  // Check for sequential characters
  if (hasSequentialChars(password) && password.length < 12) {
    errors.push('Avoid sequential characters like "abc" or "123"');
  }

  // Check for repeated characters
  if (hasRepeatedChars(password)) {
    errors.push('Avoid repeating the same character multiple times');
  }

  const strength = calculatePasswordStrength(password);

  return {
    isValid: errors.length === 0 && strength.score >= 30,
    errors,
    strength,
  };
};

// Zod schema for password validation with custom refinements
export const strongPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .refine(
      (password) => !COMMON_WEAK_PASSWORDS.has(password.toLowerCase()),
      'This password is too common. Please choose a stronger password.'
    )
    .refine(
      (password) => !hasRepeatedChars(password),
      'Avoid repeating the same character multiple times'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Type for the schema
export type StrongPasswordFormData = z.infer<typeof strongPasswordSchema>;
