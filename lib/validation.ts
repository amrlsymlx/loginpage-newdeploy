/**
 * Shared credential validation.
 *
 * Sign-in only checks the server's own minimum (a valid-looking email and a
 * password long enough to be worth a round trip) — the server is the authority
 * on whether the credentials are correct. Sign-up and password reset enforce
 * the full policy, because that is where a password is chosen.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHARACTER_PATTERN = /[!@#$%^&*()\-_+=\[\]{}:;,.?/]/;

export const PASSWORD_MIN_LENGTH = 6;

export type PasswordChecks = {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialCharacter: boolean;
};

export const validateEmail = (email: string) => EMAIL_PATTERN.test(email.trim());

export const getPasswordChecks = (password: string): PasswordChecks => ({
  minLength: password.length >= PASSWORD_MIN_LENGTH,
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecialCharacter: SPECIAL_CHARACTER_PATTERN.test(password),
});

/** Full password policy, enforced wherever a new password is chosen. */
export const validatePassword = (password: string) =>
  Object.values(getPasswordChecks(password)).every(Boolean);

/** Cheap sign-in guard that mirrors the server's minimum length. */
export const validateSignInPassword = (password: string) =>
  password.length >= PASSWORD_MIN_LENGTH;

export const PASSWORD_POLICY_MESSAGE =
  `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include ` +
  "uppercase, lowercase, number, and special character.";
