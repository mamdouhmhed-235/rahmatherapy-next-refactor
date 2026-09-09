// SERVER + CLIENT SAFE - no secrets, no side effects, importable from either.

import { z } from "zod/v4";

/**
 * ⛔ THE ONE PLACE THE PASSWORD RULE LIVES.
 *
 * Before this file the minimum was written three times — an un-exported constant
 * in `password-reset/actions.ts`, and two hard-coded `12`s in
 * `password-reset/states/SetNewPassword.tsx` (the help text and the input's
 * `minLength`). Three copies of a security rule is three chances for them to
 * drift apart, and the browser-side pair could silently stop matching what the
 * server actually enforces.
 *
 * ⚠️ Supabase's own minimum is a project setting we do not control from here and
 * is most likely the default 6. So THIS is the only rule that really binds, and
 * it only binds where it is checked on the server. Client-side `minLength` is a
 * convenience for the person typing, never a control.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** The single wording used everywhere a password is too short. */
export const PASSWORD_TOO_SHORT_MESSAGE = `Password needs at least ${MIN_PASSWORD_LENGTH} characters.`;

/**
 * The shared password rule.
 *
 * ⚠️ Deliberately length-only, matching what the reset flow already enforced. This
 * is not the place to quietly raise the bar: adding complexity rules here would
 * change the reset page's behaviour for existing staff as a side effect of adding
 * a new feature elsewhere. If the policy should be stronger, that is its own
 * decision, made once, here.
 *
 * ⛔ No `.trim()`. Leading and trailing spaces are legitimate password characters,
 * and trimming would silently accept a password the person cannot then type back.
 */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE);

/**
 * Email rule for account creation.
 *
 * ⚠️ `createStaffProfile` historically checked only `email.includes("@")`, which
 * accepts `"@"` on its own. Anything created through the new login path must also
 * exist in Supabase Auth, which applies its own stricter parsing — so a value that
 * passes the old check can be accepted into `staff_profiles` and then rejected by
 * Auth, producing exactly the half-made account this feature must avoid. Validating
 * properly up front keeps both sides agreeing.
 */
export const accountEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));
