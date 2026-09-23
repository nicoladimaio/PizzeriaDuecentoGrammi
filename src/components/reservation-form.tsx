"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  TURNSTILE_SITE_KEY,
  TurnstileWidget,
} from "@/components/turnstile-widget";
import { useRouter } from "@/i18n/navigation";
import {
  BOOKING_TERMS_PATH,
  BOOKING_TERMS_VERSION,
  PRIVACY_POLICY_PATH,
  PRIVACY_POLICY_VERSION,
} from "@/lib/reservation-policies";

const buildReservationSchema = (errorText: (key: string) => string) =>
  z.object({
    customerName: z.string().min(2, errorText("name")),
    phone: z.string().optional(),
    email: z.string().email(errorText("email")),
    date: z.string().min(1, errorText("date")),
    time: z.string().min(1, errorText("time")),
    guests: z.coerce.number().int().min(1).max(20),
    notes: z.string().max(300).optional(),
    privacyAcknowledged: z.boolean().refine((value) => value, errorText("legal")),
    bookingTermsAccepted: z
      .boolean()
      .refine((value) => value, errorText("legal")),
    privacyPolicyVersion: z.literal(PRIVACY_POLICY_VERSION),
    bookingTermsVersion: z.literal(BOOKING_TERMS_VERSION),
  });

type AvailabilityResponse = {
  days: Array<{
    date: string;
    hasAvailability: boolean;
    availableSlots: number;
  }>;
  slotsByDate: Record<
    string,
    Array<{ time: string; available: boolean; remainingSeats: number }>
  >;
  config: {
    maxDays: number;
    openTime: string;
    closeTime: string;
    slotMinutes: number;
    saturdaySlotMinutes?: number;
    sameDayClosedAfterOpen?: boolean;
  };
  error?: string;
};

type BookingStep = 1 | 2 | 3 | 4;
type BookingStep3View = "date" | "time";

const toDate = (dateKey: string): Date => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const dateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (monthKey: string, locale: string): string => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
};

const calendarCells = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);

  const firstWeekday = (first.getDay() + 6) % 7;
  const cells: Array<{ kind: "empty" } | { kind: "day"; date: string }> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ kind: "empty" });
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = dateKey(new Date(year, month - 1, day));
    cells.push({ kind: "day", date });
  }

  return cells;
};

const guestOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const parseJsonResponse = async <T,>(response: Response): Promise<T> => {
  const rawText = await response.text();

  if (!rawText) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${response.status})`);
  }
};

export function ReservationForm() {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const STEP_1_TO_2_MESSAGE = t("loadingCalendar");
  const STEP_3_TO_4_MESSAGE = t("openingSummary");
  const weekDayLabels = t("weekdays").split(",");

  const router = useRouter();
  const [step, setStep] = useState<BookingStep>(1);
  const [pending, setPending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(
    null,
  );

  const [guests, setGuests] = useState<number | null>(null);
  const [customGuestsOpen, setCustomGuestsOpen] = useState(false);
  const [customGuestsValue, setCustomGuestsValue] = useState("");
  const [customGuestsError, setCustomGuestsError] = useState<string | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [step3View, setStep3View] = useState<BookingStep3View>("date");

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  // Campo trappola anti-bot, invisibile alle persone.
  const [website, setWebsite] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // Il token Turnstile vale una volta sola: dopo un errore si rigenera la casella.
  const [turnstileKey, setTurnstileKey] = useState(0);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const selectedDaySlots = useMemo(() => {
    if (!availability || !selectedDate) return [];
    return availability.slotsByDate[selectedDate] ?? [];
  }, [availability, selectedDate]);

  const availableTimeOptions = useMemo(
    () =>
      selectedDaySlots
        .filter((slot) => slot.available)
        .map((slot) => slot.time),
    [selectedDaySlots],
  );

  const availableMonthKeys = useMemo(() => {
    if (!availability) return [] as string[];
    const set = new Set<string>();
    for (const day of availability.days) {
      set.add(getMonthKey(toDate(day.date)));
    }
    return [...set];
  }, [availability]);

  const dayAvailabilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const day of availability?.days ?? []) {
      map.set(day.date, day.hasAvailability);
    }
    return map;
  }, [availability]);

  const calendarGrid = useMemo(() => {
    if (!selectedMonth) return [];
    return calendarCells(selectedMonth);
  }, [selectedMonth]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return "";
    return toDate(selectedDate).toLocaleDateString(locale, {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [selectedDate, locale]);

  const canProceedStep1 = guests !== null && !customGuestsError;
  const canProceedStep3 = Boolean(selectedDate && selectedTime);
  const canOpenReview =
    guests !== null &&
    Boolean(customerName.trim()) &&
    Boolean(email.trim()) &&
    Boolean(selectedDate) &&
    Boolean(selectedTime) &&
    legalAccepted &&
    (!TURNSTILE_SITE_KEY || Boolean(turnstileToken)) &&
    !pending;
  const visualStep = step === 1 ? 1 : step === 3 ? 2 : 3;

  useEffect(() => {
    const resetBookingFlow = () => {
      setStep(1);
      setTransitionMessage(null);
      setError(null);
      setReviewOpen(false);
      setPending(false);
      setRedirecting(false);
      setGuests(null);
      setCustomGuestsOpen(false);
      setCustomGuestsValue("");
      setCustomGuestsError(null);
      setSelectedDate("");
      setSelectedTime("");
      setStep3View("date");
      setCustomerName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setLegalAccepted(false);
      setWebsite("");
      setTurnstileToken(null);
      setTurnstileKey((key) => key + 1);
      setAvailability(null);
      setSelectedMonth("");
      setLoadingAvailability(false);
    };

    window.addEventListener("booking:reset-to-step-1", resetBookingFlow);
    return () => {
      window.removeEventListener("booking:reset-to-step-1", resetBookingFlow);
    };
  }, []);

  useEffect(() => {
    if (!guests || step < 3) {
      return;
    }

    let ignore = false;

    const loadAvailability = async () => {
      setLoadingAvailability(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/reservations/availability?guests=${guests}`,
        );
        const data = await parseJsonResponse<AvailabilityResponse>(response);

        if (ignore) return;

        if (!response.ok) {
          setError(
            locale === "it" && data.error ? data.error : t("errors.availability"),
          );
          setAvailability(null);
          return;
        }

        setAvailability(data);

        const firstDay = data.days[0]?.date;
        if (firstDay) {
          setSelectedMonth(getMonthKey(toDate(firstDay)));
        }
      } catch {
        if (!ignore) {
          setError(t("errors.availability"));
          setAvailability(null);
        }
      } finally {
        if (!ignore) {
          setLoadingAvailability(false);
          setTransitionMessage((previous) =>
            previous === STEP_1_TO_2_MESSAGE ? null : previous,
          );
        }
      }
    };

    void loadAvailability();

    return () => {
      ignore = true;
    };
    // STEP_1_TO_2_MESSAGE e t dipendono solo dalla lingua, fissa per la pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, step]);

  useEffect(() => {
    if (!guests || step < 3) {
      setAvailability(null);
      setSelectedDate("");
      setSelectedTime("");
      setStep3View("date");
      setSelectedMonth("");
      setLoadingAvailability(false);
      return;
    }
  }, [guests, step]);

  useEffect(() => {
    if (!availability) return;

    if (!selectedDate || !dayAvailabilityMap.has(selectedDate)) {
      setSelectedDate("");
      setSelectedTime("");
      setStep3View("date");
      return;
    }

    if (!dayAvailabilityMap.get(selectedDate)) {
      setSelectedTime("");
      return;
    }

    if (selectedTime && !availableTimeOptions.includes(selectedTime)) {
      setSelectedTime("");
    }
  }, [
    availability,
    selectedDate,
    selectedTime,
    dayAvailabilityMap,
    availableTimeOptions,
  ]);

  const goToStep4 = () => {
    setTransitionMessage(STEP_3_TO_4_MESSAGE);
    window.setTimeout(() => {
      setStep(4);
      setTransitionMessage(null);
    }, 300);
  };

  const submitReservation = async () => {
    if (!selectedDate || !selectedTime || !canOpenReview) {
      setError(
        TURNSTILE_SITE_KEY && !turnstileToken
          ? t("errors.captcha")
          : t("errors.completeAll"),
      );
      return;
    }

    setPending(true);
    setError(null);

    const payload = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      date: selectedDate,
      time: selectedTime,
      guests: guests ?? 0,
      notes: notes.trim(),
      privacyAcknowledged: legalAccepted,
      bookingTermsAccepted: legalAccepted,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      bookingTermsVersion: BOOKING_TERMS_VERSION,
    };

    const parsed = buildReservationSchema((key) => t(`errors.${key}`)).safeParse(
      payload,
    );
    if (!parsed.success) {
      setPending(false);
      setError(parsed.error.issues[0]?.message ?? t("errors.checkFields"));
      return;
    }

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...parsed.data,
          locale,
          website,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });

      const data = await parseJsonResponse<{
        ok?: boolean;
        error?: string;
        code?: string;
      }>(response);

      if (!response.ok || !data.ok) {
        // Gli errori del server sono in italiano: nelle altre lingue si usa il messaggio tradotto.
        setError(
          data.code === "captcha_failed"
            ? t("errors.captcha")
            : locale === "it" && data.error
              ? data.error
              : t("errors.send"),
        );
        setTurnstileToken(null);
        setTurnstileKey((key) => key + 1);
        return;
      }

      setReviewOpen(false);
      setRedirecting(true);
      router.push("/prenotazioni/confermata");
      return;
    } catch {
      setError(t("errors.notConfirmed"));
      setTurnstileToken(null);
      setTurnstileKey((key) => key + 1);
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canOpenReview) {
      setError(
        TURNSTILE_SITE_KEY && !turnstileToken
          ? t("errors.captcha")
          : t("errors.completeRequired"),
      );
      return;
    }
    setError(null);
    setReviewOpen(true);
  };

  return (
    <section className="card-block" aria-labelledby="prenota-title">
      <div className="reservation-card-head">
        <h2 id="prenota-title" className="section-title">
          {t("title")}
        </h2>
        <LanguageSwitcher variant="inline" />
      </div>
      <p className="section-subtitle">{t("subtitle")}</p>

      <form className="booking-form" onSubmit={onSubmit}>
        <div
          className="booking-wizard-head"
          role="status"
          aria-live="polite"
          aria-label={t("stepAria", { step: visualStep })}
        >
          <span
            className={visualStep >= 1 ? "wizard-line active" : "wizard-line"}
            aria-hidden="true"
          />
          <span
            className={visualStep >= 2 ? "wizard-line active" : "wizard-line"}
            aria-hidden="true"
          />
          <span
            className={visualStep >= 3 ? "wizard-line active" : "wizard-line"}
            aria-hidden="true"
          />
        </div>

        {step === 1 ? (
          <div className="booking-step booking-step-screen booking-step-screen-1">
            <p className="booking-step-title">{t("guestsQuestion")}</p>
            <div
              className="booking-guests-grid"
              role="group"
              aria-label={t("guestsAria")}
            >
              {guestOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={
                    guests === option
                      ? "booking-guest-square active"
                      : "booking-guest-square"
                  }
                  onClick={() => {
                    setGuests(option);
                    setCustomGuestsOpen(false);
                    setCustomGuestsValue("");
                    setCustomGuestsError(null);
                  }}
                >
                  {option}
                </button>
              ))}

              <button
                type="button"
                className={
                  customGuestsOpen
                    ? "booking-guest-square booking-guest-other active"
                    : "booking-guest-square booking-guest-other"
                }
                onClick={() => {
                  setCustomGuestsOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      setGuests(null);
                      setCustomGuestsValue("");
                      setCustomGuestsError(null);
                    }
                    return next;
                  });
                }}
              >
                {t("other")}
              </button>
            </div>

            {customGuestsOpen ? (
              <div className="booking-custom-input-pop">
                <label>
                  {t("customGuestsLabel")}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={customGuestsValue}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCustomGuestsValue(nextValue);

                      if (nextValue === "") {
                        setGuests(null);
                        setCustomGuestsError(null);
                        return;
                      }

                      const value = Number(nextValue);
                      if (!Number.isFinite(value) || value < 1) {
                        setGuests(null);
                        setCustomGuestsError(t("customGuestsInvalid"));
                        return;
                      }

                      if (value > 20) {
                        setGuests(null);
                        setCustomGuestsError(t("customGuestsTooMany"));
                        return;
                      }

                      if (value >= 1 && value <= 20) {
                        setGuests(value);
                        setCustomGuestsError(null);
                      }
                    }}
                  />
                </label>
                {customGuestsError ? (
                  <p className="booking-inline-error">{customGuestsError}</p>
                ) : null}
              </div>
            ) : null}

            <div className="booking-step-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={!canProceedStep1}
                onClick={() => {
                  setTransitionMessage(STEP_1_TO_2_MESSAGE);
                  setStep(3);
                }}
              >
                {t("next")}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="booking-step booking-step-screen booking-step-screen-2">
            <p className="booking-step-title">{t("chooseDateTime")}</p>

            {step3View === "date" ? (
              <>
                {availableMonthKeys.length > 1 ? (
                  <div
                    className="booking-month-switch"
                    role="tablist"
                    aria-label={t("monthsAria")}
                  >
                    {availableMonthKeys.map((monthKey) => (
                      <button
                        key={monthKey}
                        type="button"
                        className={
                          monthKey === selectedMonth
                            ? "booking-month-pill active"
                            : "booking-month-pill"
                        }
                        onClick={() => setSelectedMonth(monthKey)}
                      >
                        {monthLabel(monthKey, locale)}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div
                  className="booking-calendar"
                  role="grid"
                  aria-label={t("calendarAria")}
                >
                  {weekDayLabels.map((label) => (
                    <div key={label} className="booking-calendar-weekday">
                      {label}
                    </div>
                  ))}

                  {calendarGrid.map((cell, index) => {
                    if (cell.kind === "empty") {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="booking-calendar-empty"
                        />
                      );
                    }

                    const currentDate = toDate(cell.date);
                    const disabled = !dayAvailabilityMap.get(cell.date);
                    const isSelected = cell.date === selectedDate;

                    return (
                      <button
                        key={cell.date}
                        type="button"
                        className={
                          isSelected
                            ? "booking-calendar-day active"
                            : "booking-calendar-day"
                        }
                        disabled={disabled}
                        onClick={() => {
                          setSelectedDate(cell.date);
                          setSelectedTime("");
                          setStep3View("time");
                        }}
                      >
                        {currentDate.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="booking-step-actions two-buttons">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep(1)}
                  >
                    {t("back")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!selectedDate}
                    onClick={() => setStep3View("time")}
                  >
                    {t("goToTimes")}
                  </button>
                </div>
              </>
            ) : selectedDate ? (
              <div className="booking-time-section">
                <p className="booking-step-title booking-time-title">
                  {t("timesFor", { date: selectedDateLabel || selectedDate })}
                </p>
                <div
                  className="booking-time-grid"
                  role="listbox"
                  aria-label={t("timesAria")}
                >
                  {availableTimeOptions.map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={
                        time === selectedTime
                          ? "booking-time-pill active"
                          : "booking-time-pill"
                      }
                      onClick={() => setSelectedTime(time)}
                    >
                      <span>{time}</span>
                    </button>
                  ))}
                </div>
                {availableTimeOptions.length === 0 ? (
                  <p className="section-subtitle">
                    {t("noTimes")}
                  </p>
                ) : null}

                <div className="booking-step-actions two-buttons">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setStep3View("date");
                      setSelectedTime("");
                    }}
                  >
                    {t("changeDay")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!canProceedStep3}
                    onClick={goToStep4}
                  >
                    {t("next")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="section-subtitle">
                {t("selectDayFirst")}
              </p>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="booking-step booking-step-screen booking-step-screen-3 booking-step-final">
            <p className="booking-step-title">{t("yourDetails")}</p>
            <p className="booking-required-note">
              {t("requiredNote")}
            </p>
            <label>
              {t("name")} <span className="required-mark">*</span>
              <input
                name="customerName"
                type="text"
                required
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </label>

            <label>
              {t("phone")}
              <input
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>

            <label>
              {t("email")} <span className="required-mark">*</span>
              <input
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              {t("notes")}
              <textarea
                name="notes"
                rows={3}
                maxLength={300}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>

            <div className="booking-legal-box">
              <label className="booking-checkbox-row">
                <input
                  name="legalAccepted"
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(event) => setLegalAccepted(event.target.checked)}
                />
                <span>
                  {t.rich("legalAccept", {
                    privacy: (chunks) => (
                      <Link href={PRIVACY_POLICY_PATH} target="_blank">
                        {chunks}
                      </Link>
                    ),
                    terms: (chunks) => (
                      <Link href={BOOKING_TERMS_PATH} target="_blank">
                        {chunks}
                      </Link>
                    ),
                  })}
                </span>
              </label>

              <p className="booking-legal-note">
                {t("legalNote", {
                  privacyVersion: PRIVACY_POLICY_VERSION,
                  termsVersion: BOOKING_TERMS_VERSION,
                })}
                {t("legalDocsItalianOnly") ? ` ${t("legalDocsItalianOnly")}` : null}
              </p>
            </div>

            <input
              type="text"
              name="website"
              className="booking-honeypot"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />

            <TurnstileWidget
              key={turnstileKey}
              language={locale}
              onToken={setTurnstileToken}
            />

            <div className="booking-step-actions two-buttons">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(3)}
              >
                {t("back")}
              </button>
              <button
                className="btn-primary"
                type="submit"
                disabled={!canOpenReview}
              >
                {pending ? t("sending") : t("summary")}
              </button>
            </div>
          </div>
        ) : null}
      </form>

      {reviewOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal status-popup-modal">
            <div className="admin-modal-head">
              <h3>{t("summaryTitle")}</h3>
            </div>
            <div className="status-popup-body">
              <p className="booking-selection-summary">
                {t("summaryGuests")}: <strong>{guests}</strong>
              </p>
              <p className="booking-selection-summary">
                {t("summaryDay")}: <strong>{selectedDateLabel || selectedDate}</strong>
              </p>
              <p className="booking-selection-summary">
                {t("summaryTime")}: <strong>{selectedTime}</strong>
              </p>
              <p className="booking-selection-summary">
                {t("summaryCustomer")}: <strong>{customerName}</strong>
              </p>
              <p className="booking-selection-summary">
                {t("summaryPhone")}: <strong>{phone || "-"}</strong>
              </p>
              <p className="booking-selection-summary">
                {t("summaryEmail")}: <strong>{email}</strong>
              </p>
              <p className="booking-selection-summary">
                {t("summaryDocs")}: <strong>{t("summaryDocsValue")}</strong>
              </p>
            </div>
            <div className="booking-step-actions two-buttons booking-review-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setReviewOpen(false)}
                disabled={pending}
              >
                {t("back")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitReservation()}
                disabled={!canOpenReview}
              >
                {pending ? t("sending") : t("confirmAndSend")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {transitionMessage || (loadingAvailability && step >= 3) ? (
        <div
          className="booking-loader-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="booking-loader-card">
            <img
              src="/assets/loader.gif"
              alt={t("loaderAlt")}
              className="app-loader-gif"
            />
            <p>
              {transitionMessage ??
                (loadingAvailability ? STEP_1_TO_2_MESSAGE : t("loading"))}
            </p>
          </div>
        </div>
      ) : null}

      {redirecting ? (
        <div className="app-loader-overlay" role="status" aria-live="polite">
          <div className="app-loader-card">
            <img
              src="/assets/loader.gif"
              alt={t("loading")}
              className="app-loader-gif"
            />
            <p>{t("redirecting")}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
