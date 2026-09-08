import { z } from 'zod';

/** Shared limits and shapes used by both forms and database write helpers. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be 30 characters or fewer.')
  .regex(/^[A-Za-z0-9_#]+$/, 'Username can only use letters, numbers, underscores, and #.')
  .regex(/[A-Za-z]/, 'Username cannot contain only numbers. Add at least one letter.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a display name.')
  .max(40, 'Display name must be 40 characters or fewer.');

export const habitNameSchema = z
  .string()
  .trim()
  .min(1, 'Give your habit a name.')
  .max(60, 'Keep the name under 60 characters.');

export const chainNameSchema = z
  .string()
  .trim()
  .min(1, 'Give your chain a name.')
  .max(40, 'Keep the chain name under 40 characters.');

export const timeConstraintSchema = z
  .string()
  .nullable()
  .refine((value) => value === null || /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value), 'Enter a valid time, like 09:00.');

export const notesSchema = z.string().max(280, 'Keep notes under 280 characters.').nullable();

export function getUsernameValidationError(value: string): string | null {
  const result = usernameSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message ?? 'Enter a valid username.';
}

export function getDisplayNameValidationError(value: string): string | null {
  const result = displayNameSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message ?? 'Enter a valid display name.';
}

export function getChainNameValidationError(value: string): string | null {
  const result = chainNameSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message ?? 'Enter a valid chain name.';
}

function assertValid<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Invalid value.');
  return result.data;
}

export function validateUsername(value: string): string {
  return assertValid(usernameSchema, value);
}

export function validateDisplayName(value: string): string {
  return assertValid(displayNameSchema, value);
}

export function validateHabitName(value: string): string {
  return assertValid(habitNameSchema, value);
}

export function validateChainName(value: string): string {
  return assertValid(chainNameSchema, value);
}

export function validateTimeConstraint(value: string | null): string | null {
  return assertValid(timeConstraintSchema, value);
}

export function validateNotes(value: string | null): string | null {
  return assertValid(notesSchema, value);
}
