"use client";

import type { UseFormReturn } from "react-hook-form";
import { ClipboardList, Mail, Phone, ShieldCheck, User, Users } from "lucide-react";
import type { BookingDetailsFormValues } from "../schemas/booking-schema";
import type { ParticipantGenderInput } from "../types";
import { Field } from "./Field";
import styles from "../BookingExperience.module.css";

interface ParticipantDetailsStepProps {
  form: UseFormReturn<BookingDetailsFormValues>;
}

const PEOPLE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function normalizeParticipantGenders(
  count: number,
  current: ParticipantGenderInput[]
) {
  return Array.from({ length: count }, (_, index) => current[index] ?? "");
}

function getParticipantGenderError(
  error: unknown
): string | undefined {
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
  const clientGender = watch("clientGender");
  const numberOfPeople = Number(watch("numberOfPeople")) || 1;
  const participantGenders = normalizeParticipantGenders(
    numberOfPeople,
    watch("participantGenders") ?? []
  );
  const participantGenderError = getParticipantGenderError(
    errors.participantGenders
  );
  const isGroupBooking = numberOfPeople > 1;

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

  function setParticipantCount(count: number) {
    const nextGenders = normalizeParticipantGenders(count, participantGenders);
    setValue("numberOfPeople", count, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("participantGenders", nextGenders, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("clientGender", nextGenders[0] ?? "", {
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
          <p className={styles.sectionKicker}>2 of 6</p>
          <h3 id="participants-heading">Who is the appointment for?</h3>
          <p>
            Share the contact details and participant genders before choosing a
            home visit area or time.
          </p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formNotice}>
          <ShieldCheck aria-hidden="true" size={18} />
          <p>
            Female clients are treated by a female therapist. Group bookings
            need each participant listed so the right therapist can be arranged.
          </p>
        </div>

        <Field
          label="Full name"
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

        <div className={styles.fullWidth}>
          <Field
            label="What would you like help with?"
            icon={<ClipboardList size={16} />}
          >
            <textarea
              rows={4}
              placeholder="E.g. back pain, neck and shoulder tension, hijama, massage, female therapist preference, gym recovery, or any health details we should know."
              {...register("notes")}
            />
          </Field>
        </div>

        <div className={styles.fullWidth}>
          <Field
            label="Health notes"
            icon={<ClipboardList size={16} />}
          >
            <textarea
              rows={3}
              placeholder="Share allergies, medication, pregnancy, recent surgery, injuries, or other safety details relevant to treatment."
              {...register("healthNotes")}
            />
          </Field>
        </div>

        <Field
          label="Number of people"
          error={errors.numberOfPeople?.message}
          icon={<Users size={16} />}
        >
          <select
            name="numberOfPeople"
            value={numberOfPeople}
            aria-invalid={Boolean(errors.numberOfPeople)}
            onChange={(event) => setParticipantCount(Number(event.target.value))}
          >
            {PEOPLE_OPTIONS.map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? "person" : "people"}
              </option>
            ))}
          </select>
        </Field>

        {!isGroupBooking ? (
          <fieldset className={styles.segmentField}>
            <legend>Client gender</legend>
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
                  {gender === "male" ? "Male client" : "Female client"}
                </button>
              ))}
            </div>
            {errors.clientGender?.message ? (
              <p className={styles.fieldError} role="alert" aria-live="polite">
                {errors.clientGender.message}
              </p>
            ) : null}
          </fieldset>
        ) : (
          <div className={styles.groupParticipants}>
            <div>
              <strong>Participant genders</strong>
              <span>First person is treated as the main contact.</span>
            </div>
            <div className={styles.participantGrid}>
              {participantGenders.map((genderValue, index) => (
                <fieldset key={index} className={styles.segmentField}>
                  <legend>Person {index + 1}</legend>
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
              ))}
            </div>
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
