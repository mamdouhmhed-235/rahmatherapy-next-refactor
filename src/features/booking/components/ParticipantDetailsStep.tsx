"use client";

import type { UseFormReturn } from "react-hook-form";
import { Mail, Phone, ShieldCheck, User, Users } from "lucide-react";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import type { BookingFor, ParticipantGenderInput } from "../types";
import { Field } from "./Field";
import styles from "../BookingExperience.module.css";

interface ParticipantDetailsStepProps {
  form: UseFormReturn<BookingDetailsFormValues>;
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

export function ParticipantDetailsStep({ form }: ParticipantDetailsStepProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const bookingFor = watch("bookingFor");
  const clientGender = watch("clientGender");
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

  return (
    <section className={styles.stepSection} aria-labelledby="participants-heading">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>2 of 7</p>
          <h3 id="participants-heading">Who is this for?</h3>
          <p>
            Add the main contact and each participant before location and
            therapist-matched times are checked.
          </p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formNotice}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            We use participant gender only to match the right therapist for the
            appointment. Group bookings stay as one simultaneous request.
          </p>
        </div>

        <fieldset className={`${styles.segmentField} ${styles.fullWidth}`}>
          <legend>Booking type</legend>
          <div className={styles.bookingTypeGrid}>
            {BOOKING_FOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  bookingFor === option.value
                    ? styles.segmentButtonActive
                    : styles.segmentButton
                }
                aria-pressed={bookingFor === option.value}
                onClick={() => setBookingFor(option.value)}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </fieldset>

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

        {isGroupBooking ? (
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
        ) : null}

        {!isGroupBooking ? (
          <div className={styles.groupParticipants}>
            <fieldset className={styles.segmentField}>
              <legend>
                {bookingFor === "someone_else"
                  ? "Participant gender"
                  : "Your gender"}
              </legend>
              <div className={styles.segmentGroup}>
                {(["male", "female"] as const).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    className={
                      clientGender === gender
                        ? styles.segmentButtonActive
                        : styles.segmentButton
                    }
                    aria-pressed={clientGender === gender}
                    onClick={() => setSingleClientGender(gender)}
                  >
                    {gender === "male" ? "Male" : "Female"}
                  </button>
                ))}
              </div>
              {errors.clientGender?.message ? (
                <p className={styles.fieldError} role="alert" aria-live="polite">
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
          </div>
        ) : (
          <div className={styles.groupParticipants}>
            <div>
              <strong>Group participants</strong>
              <span>
                Add a clear name or label for each person so therapist matching
                and notes are not mixed together.
              </span>
            </div>
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
                    <div className={styles.segmentGroup}>
                      {(["male", "female"] as const).map((gender) => (
                        <button
                          key={gender}
                          type="button"
                          className={
                            genderValue === gender
                              ? styles.segmentButtonActive
                              : styles.segmentButton
                          }
                          aria-pressed={genderValue === gender}
                          onClick={() => setParticipantGender(index, gender)}
                        >
                          {gender === "male" ? "Male" : "Female"}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <Field label="Participant note">
                    <textarea
                      rows={2}
                      placeholder="Optional note for this participant"
                      {...register(`participantNotes.${index}` as const)}
                    />
                  </Field>
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
          </div>
        )}
      </div>
    </section>
  );
}
