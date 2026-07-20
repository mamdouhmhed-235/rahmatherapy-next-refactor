"use client";

import type { UseFormReturn } from "react-hook-form";
import {
  Car,
  DoorOpen,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import {
  BOOKING_ALLOWED_CITIES,
  type BookingDetailsFormValues,
} from "../schemas/booking-schema";
import type { BookingFor, ParticipantGenderInput } from "../types";
import { Field } from "./Field";
import { StepDisclosure } from "./StepDisclosure";
import styles from "../BookingExperience.module.css";

interface AboutYouStepProps {
  form: UseFormReturn<BookingDetailsFormValues>;
  prefilled?: boolean;
  onClearPrefill?: () => void;
}

const PEOPLE_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

const BOOKING_FOR_OPTIONS: Array<{
  value: BookingFor;
  label: string;
  description: string;
}> = [
  {
    value: "self",
    label: "For myself",
    description: "You are the person receiving treatment.",
  },
  {
    value: "someone_else",
    label: "For someone else",
    description: "You are the main contact for one participant.",
  },
  {
    value: "group",
    label: "For a group",
    description: "Two or more people need the same visit time.",
  },
];

const COVERED_TOWNS = BOOKING_ALLOWED_CITIES.map((city) =>
  city.replace(/\b\w/g, (letter) => letter.toUpperCase())
);

function normalizeStringList(count: number, current: string[]) {
  return Array.from({ length: count }, (_, index) => current[index] ?? "");
}

function normalizeParticipantGenders(
  count: number,
  current: ParticipantGenderInput[]
) {
  return Array.from({ length: count }, (_, index) => current[index] ?? "");
}

function getFieldArrayError(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : undefined;
}

export function AboutYouStep({
  form,
  prefilled = false,
  onClearPrefill,
}: AboutYouStepProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const bookingFor = watch("bookingFor");
  const clientGender = watch("clientGender");
  const city = watch("city");
  const numberOfPeople = Number(watch("numberOfPeople")) || 1;
  const participantGenders = normalizeParticipantGenders(
    numberOfPeople,
    watch("participantGenders") ?? []
  );
  const participantNames = normalizeStringList(
    numberOfPeople,
    watch("participantNames") ?? []
  );
  const participantNotes = normalizeStringList(
    numberOfPeople,
    watch("participantNotes") ?? []
  );
  const participantGenderError = getFieldArrayError(errors.participantGenders);
  const participantNameError = getFieldArrayError(errors.participantNames);
  const isGroupBooking = bookingFor === "group";

  const normalizedCity = city.trim().toLowerCase();
  const hasCityValue = normalizedCity.length > 1;
  const isCovered =
    hasCityValue &&
    BOOKING_ALLOWED_CITIES.some(
      (allowed) =>
        normalizedCity === allowed || normalizedCity.includes(allowed)
    );
  const isOutsideCoverage = hasCityValue && !isCovered;

  function setParticipantCount(count: number) {
    const nextGenders = normalizeParticipantGenders(count, participantGenders);
    const nextNames = normalizeStringList(count, participantNames);
    const nextNotes = normalizeStringList(count, participantNotes);

    setValue("numberOfPeople", count, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("participantGenders", nextGenders, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("participantNames", nextNames, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("participantNotes", nextNotes, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("clientGender", nextGenders[0] ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function setBookingFor(value: BookingFor) {
    setValue("bookingFor", value, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (value === "group") {
      setParticipantCount(Math.max(2, numberOfPeople));
      return;
    }

    setParticipantCount(1);
  }

  function setSingleClientGender(gender: "male" | "female") {
    setValue("clientGender", gender, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("participantGenders", [gender], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function setParticipantGender(index: number, gender: "male" | "female") {
    const nextGenders = normalizeParticipantGenders(
      numberOfPeople,
      participantGenders
    );
    nextGenders[index] = gender;
    setValue("participantGenders", nextGenders, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (index === 0) {
      setValue("clientGender", gender, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }

  function setCity(town: string) {
    setValue("city", town, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <section className={styles.stepSection} aria-labelledby="about-heading">
      <div className={styles.stepHeader}>
        <p className={styles.stepKicker}>Step 2 of 4</p>
        <h2 id="about-heading" className={styles.stepTitle} tabIndex={-1}>
          About you
        </h2>
        <p className={styles.stepSubtitle}>
          Tell us who the visit is for and where we should come.
        </p>
      </div>

      {prefilled ? (
        <div className={styles.prefillChip} role="status">
          <UserCheck aria-hidden="true" size={18} />
          <p>
            Welcome back — we&apos;ve filled your details from your last
            booking.
          </p>
          <button
            type="button"
            className={styles.textButton}
            onClick={onClearPrefill}
          >
            Clear my details
          </button>
        </div>
      ) : null}

      <div className={styles.stepBlock}>
        <h3 className={styles.blockTitle}>Who is this for?</h3>
        <div className={styles.choiceGrid}>
          {BOOKING_FOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                bookingFor === option.value
                  ? styles.choiceCardActive
                  : styles.choiceCard
              }
              aria-pressed={bookingFor === option.value}
              onClick={() => setBookingFor(option.value)}
            >
              <span>{option.label}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.stepBlock}>
        <h3 className={styles.blockTitle}>Your details</h3>
        <div className={styles.formGrid}>
          <Field
            label="Main contact name"
            error={errors.fullName?.message}
            icon={<User size={16} />}
          >
            <input
              autoComplete="name"
              placeholder="Your full name"
              aria-invalid={Boolean(errors.fullName)}
              {...register("fullName")}
            />
          </Field>

          <div className={`${styles.formGrid} ${styles.fieldRow2}`}>
            <Field
              label="Phone / WhatsApp number"
              error={errors.phone?.message}
              icon={<Phone size={16} />}
            >
              <input
                inputMode="tel"
                autoComplete="tel"
                placeholder="07700 000000"
                aria-invalid={Boolean(errors.phone)}
                {...register("phone")}
              />
            </Field>

            <Field
              label="Email address"
              error={errors.email?.message}
              icon={<Mail size={16} />}
            >
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </Field>
          </div>

          {!isGroupBooking ? (
            <>
              <fieldset className={styles.segmentField}>
                <legend>
                  {bookingFor === "someone_else"
                    ? "Participant gender"
                    : "Your gender"}
                </legend>
                <div className={styles.pillGroup}>
                  {(["male", "female"] as const).map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      className={
                        clientGender === gender
                          ? styles.pillButtonActive
                          : styles.pillButton
                      }
                      aria-pressed={clientGender === gender}
                      onClick={() => setSingleClientGender(gender)}
                    >
                      {gender === "male" ? "Male" : "Female"}
                    </button>
                  ))}
                </div>
                {errors.clientGender?.message ? (
                  <p
                    className={styles.fieldError}
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.clientGender.message}
                  </p>
                ) : null}
              </fieldset>

              {bookingFor === "someone_else" ? (
                <Field
                  label="Participant name or label"
                  error={participantNameError}
                  icon={<User size={16} />}
                >
                  <input
                    placeholder="E.g. Mum, Ahmed, client 1"
                    aria-invalid={Boolean(participantNameError)}
                    {...register("participantNames.0")}
                  />
                </Field>
              ) : null}

              <div className={styles.notice}>
                <ShieldCheck aria-hidden="true" size={18} />
                <p>
                  We use participant gender only to match the right therapist
                  for the appointment.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {isGroupBooking ? (
        <div className={styles.stepBlock}>
          <h3 className={styles.blockTitle}>Group participants</h3>
          <p className={styles.blockHint}>
            Add a clear name or label for each person so therapist matching and
            notes are not mixed together. Group bookings stay as one
            simultaneous request.
          </p>
          <div className={styles.formGrid}>
            <Field
              label="Participant count"
              error={errors.numberOfPeople?.message}
              icon={<Users size={16} />}
            >
              <select
                name="numberOfPeople"
                value={numberOfPeople}
                aria-invalid={Boolean(errors.numberOfPeople)}
                onChange={(event) =>
                  setParticipantCount(Number(event.target.value))
                }
              >
                {PEOPLE_OPTIONS.map((num) => (
                  <option key={num} value={num}>
                    {num} people
                  </option>
                ))}
              </select>
            </Field>

            <div className={styles.participantGrid}>
              {participantGenders.map((genderValue, index) => (
                <section key={index} className={styles.participantCard}>
                  <Field
                    label={`Participant ${index + 1} name or label`}
                    icon={<User size={16} />}
                  >
                    <input
                      placeholder={`Person ${index + 1}`}
                      aria-invalid={Boolean(participantNameError)}
                      {...register(`participantNames.${index}` as const)}
                    />
                  </Field>

                  <fieldset className={styles.segmentField}>
                    <legend>Gender for therapist matching</legend>
                    <div className={styles.pillGroup}>
                      {(["male", "female"] as const).map((gender) => (
                        <button
                          key={gender}
                          type="button"
                          className={
                            genderValue === gender
                              ? styles.pillButtonActive
                              : styles.pillButton
                          }
                          aria-pressed={genderValue === gender}
                          onClick={() => setParticipantGender(index, gender)}
                        >
                          {gender === "male" ? "Male" : "Female"}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <StepDisclosure
                    label="Add a note"
                    defaultOpen={Boolean(participantNotes[index]?.trim())}
                  >
                    <Field label="Participant note">
                      <textarea
                        rows={2}
                        placeholder="Optional note for this participant"
                        {...register(`participantNotes.${index}` as const)}
                      />
                    </Field>
                  </StepDisclosure>
                </section>
              ))}
            </div>
            {participantNameError ? (
              <p className={styles.fieldError} role="alert" aria-live="polite">
                {participantNameError}
              </p>
            ) : null}
            {participantGenderError ? (
              <p className={styles.fieldError} role="alert" aria-live="polite">
                {participantGenderError}
              </p>
            ) : null}
            <div className={styles.notice}>
              <ShieldCheck aria-hidden="true" size={18} />
              <p>
                We use participant gender only to match the right therapist for
                the appointment.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.stepBlock}>
        <h3 className={styles.blockTitle}>Where should we visit?</h3>
        <div className={styles.chipRow}>
          {COVERED_TOWNS.map((town) => {
            const active = normalizedCity === town.toLowerCase();
            return (
              <button
                key={town}
                type="button"
                className={active ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                aria-pressed={active}
                onClick={() => setCity(town)}
              >
                {town}
              </button>
            );
          })}
        </div>

        {isCovered ? (
          <div className={styles.notice}>
            <MapPin aria-hidden="true" size={18} />
            <p>
              <strong>Covered area:</strong> We can check matched appointment
              times for this location.
            </p>
          </div>
        ) : null}

        {isOutsideCoverage ? (
          <div className={styles.noticeError}>
            <MapPin aria-hidden="true" size={18} />
            <p>
              <strong>Outside current home visit area:</strong> We currently
              cover Luton, Dunstable, Houghton Regis, Harpenden and St Albans.
              Use a covered town before choosing a time.
            </p>
          </div>
        ) : null}

        <div className={`${styles.formGrid} ${styles.fieldRow3}`}>
          <Field
            label="City / Town"
            error={errors.city?.message}
            icon={<MapPin size={16} />}
          >
            <input
              autoComplete="address-level2"
              placeholder="e.g. Luton"
              aria-invalid={Boolean(errors.city)}
              {...register("city")}
            />
          </Field>

          <Field
            label="Area / County"
            error={errors.area?.message}
            icon={<MapPin size={16} />}
          >
            <input
              autoComplete="address-level1"
              placeholder="e.g. Bedfordshire"
              aria-invalid={Boolean(errors.area)}
              {...register("area")}
            />
          </Field>

          <Field
            label="Postcode"
            error={errors.postcode?.message}
            icon={<MapPin size={16} />}
          >
            <input
              autoComplete="postal-code"
              placeholder="e.g. LU1 1AA"
              aria-invalid={Boolean(errors.postcode)}
              {...register("postcode")}
            />
          </Field>
        </div>

        <Field
          label="Home visit address"
          error={errors.address?.message}
          icon={<MapPin size={16} />}
        >
          <input
            autoComplete="street-address"
            placeholder="House number and street"
            aria-invalid={Boolean(errors.address)}
            {...register("address")}
          />
        </Field>

        <StepDisclosure
          label="Access & parking notes (optional)"
          defaultOpen={Boolean(
            watch("accessNotes")?.trim() || watch("parkingNotes")?.trim()
          )}
        >
          <Field label="Area or access notes" icon={<DoorOpen size={16} />}>
            <textarea
              rows={3}
              placeholder="Flat number, entry instructions, lift/stairs, treatment space, or anything that helps arrival."
              {...register("accessNotes")}
            />
          </Field>

          <Field label="Parking notes" icon={<Car size={16} />}>
            <textarea
              rows={3}
              placeholder="Parking space, visitor permit, paid parking, or nearby stopping details."
              {...register("parkingNotes")}
            />
          </Field>
        </StepDisclosure>

        <div className={styles.notice}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            Please prepare a clean, private space with enough room for the
            therapist to work safely. We will confirm any setup details if
            needed.
          </p>
        </div>
      </div>
    </section>
  );
}
