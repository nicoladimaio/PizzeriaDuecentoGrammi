"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  BOOKING_TERMS_PATH,
  BOOKING_TERMS_VERSION,
  PRIVACY_POLICY_PATH,
  PRIVACY_POLICY_VERSION,
} from "@/lib/reservation-policies";

const reservationSchema = z.object({
  customerName: z.string().min(2, "Inserisci nome e cognome."),
  phone: z.string().optional(),
  email: z.string().email("Inserisci una email valida."),
  diningArea: z.enum(["inside", "outside"]),
  date: z.string().min(1, "Seleziona una data."),
  time: z.string().min(1, "Seleziona un orario."),
  guests: z.coerce.number().int().min(1).max(20),
  notes: z.string().max(300).optional(),
  privacyAcknowledged: z
    .boolean()
    .refine(
      (value) => value,
      "Devi accettare Privacy Policy e Termini di Prenotazione.",
    ),
  bookingTermsAccepted: z
    .boolean()
    .refine(
      (value) => value,
      "Devi accettare Privacy Policy e Termini di Prenotazione.",
    ),
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
    activeRoom?: "inside" | "outside";
    insideActive?: boolean;
    outsideActive?: boolean;
    insideCapacityPerSlot?: number;
    outsideCapacityPerSlot?: number;
    sameDayClosedAfterOpen?: boolean;
  };
  error?: string;
};

type BookingStep = 1 | 2 | 3 | 4;
type BookingStep3View = "date" | "time";

const weekDayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

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

const monthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
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
    throw new Error(
      `Il server ha restituito una risposta non valida${
        response.status ? ` (HTTP ${response.status})` : ""
      }.`,
    );
  }
};

export function ReservationForm() {
  const STEP_1_TO_2_MESSAGE = "Controllo le sale disponibili...";
  const STEP_3_TO_4_MESSAGE =
    "Sto aprendo il riepilogo della tua prenotazione...";
  const STEP_2_TO_3_MESSAGE = "Sto caricando il calendario...";

  const router = useRouter();
  const [step, setStep] = useState<BookingStep>(1);
  const [pending, setPending] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(
    null,
  );

  const [guests, setGuests] = useState<number | null>(null);
  const [diningArea, setDiningArea] = useState<"inside" | "outside" | null>(
    null,
  );
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

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null,
  );
  const [roomConfig, setRoomConfig] = useState<{
    insideActive: boolean;
    outsideActive: boolean;
  } | null>(null);
  const [loadingRoomConfig, setLoadingRoomConfig] = useState(false);

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
    return toDate(selectedDate).toLocaleDateString("it-IT", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [selectedDate]);

  const canProceedStep1 = guests !== null && !customGuestsError;
  const canProceedStep3 = Boolean(selectedDate && selectedTime);
  const canOpenReview =
    guests !== null &&
    Boolean(customerName.trim()) &&
    Boolean(email.trim()) &&
    Boolean(selectedDate) &&
    Boolean(selectedTime) &&
    legalAccepted &&
    !pending;

  const insideRoomEnabled = roomConfig?.insideActive ?? false;
  const outsideRoomEnabled = roomConfig?.outsideActive ?? false;
  const noRoomEnabled = !insideRoomEnabled && !outsideRoomEnabled;

  useEffect(() => {
    const resetBookingFlow = () => {
      setStep(1);
      setTransitionMessage(null);
      setError(null);
      setReviewOpen(false);
      setPending(false);
      setRedirecting(false);
      setGuests(null);
      setDiningArea(null);
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
      setAvailability(null);
      setRoomConfig(null);
      setSelectedMonth("");
      setLoadingAvailability(false);
      setLoadingRoomConfig(false);
    };

    window.addEventListener("booking:reset-to-step-1", resetBookingFlow);
    return () => {
      window.removeEventListener("booking:reset-to-step-1", resetBookingFlow);
    };
  }, []);

  useEffect(() => {
    if (!guests || step < 2) {
      setRoomConfig(null);
      return;
    }

    let ignore = false;

    const loadRoomConfig = async () => {
      setLoadingRoomConfig(true);

      try {
        const response = await fetch(
          `/api/reservations/availability?guests=${guests}`,
        );
        const data = await parseJsonResponse<AvailabilityResponse>(response);

        if (ignore) return;

        if (!response.ok) {
          setRoomConfig({
            insideActive: data.config?.insideActive ?? false,
            outsideActive: data.config?.outsideActive ?? false,
          });
          return;
        }

        const insideActive = data.config.insideActive ?? true;
        const outsideActive = data.config.outsideActive ?? true;

        setRoomConfig({ insideActive, outsideActive });

        if (insideActive && !outsideActive) {
          setDiningArea("inside");
        } else if (!insideActive && outsideActive) {
          setDiningArea("outside");
        } else if (
          diningArea &&
          ((diningArea === "inside" && !insideActive) ||
            (diningArea === "outside" && !outsideActive))
        ) {
          setDiningArea(null);
        }
      } catch {
        if (!ignore) {
          setRoomConfig({ insideActive: false, outsideActive: false });
        }
      } finally {
        if (!ignore) {
          setLoadingRoomConfig(false);
          setTransitionMessage((previous) =>
            previous === STEP_1_TO_2_MESSAGE ? null : previous,
          );
        }
      }
    };

    void loadRoomConfig();

    return () => {
      ignore = true;
    };
  }, [guests, step, diningArea]);

  useEffect(() => {
    if (!guests || !diningArea || step < 3) {
      setAvailability(null);
      setSelectedDate("");
      setSelectedTime("");
      setStep3View("date");
      setSelectedMonth("");
      setLoadingAvailability(false);
      return;
    }

    let ignore = false;

    const loadAvailability = async () => {
      setLoadingAvailability(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/reservations/availability?guests=${guests}&room=${diningArea}`,
        );
        const data = await parseJsonResponse<AvailabilityResponse>(response);

        if (ignore) return;

        if (!response.ok) {
          setRoomConfig((previous) =>
            previous
              ? {
                  insideActive: data.config?.insideActive ?? previous.insideActive,
                  outsideActive:
                    data.config?.outsideActive ?? previous.outsideActive,
                }
              : previous,
          );
          setError(data.error ?? "Impossibile caricare disponibilita.");
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
          setError("Impossibile caricare disponibilita.");
          setAvailability(null);
        }
      } finally {
        if (!ignore) {
          setLoadingAvailability(false);
          setTransitionMessage((previous) =>
            previous === STEP_2_TO_3_MESSAGE ? null : previous,
          );
        }
      }
    };

    void loadAvailability();

    return () => {
      ignore = true;
    };
  }, [guests, diningArea, step]);

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
    if (!selectedDate || !selectedTime || !canOpenReview || !diningArea) {
      setError("Completa tutti i campi prima di inviare.");
      return;
    }

    setPending(true);
    setError(null);

    const payload = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      diningArea,
      date: selectedDate,
      time: selectedTime,
      guests: guests ?? 0,
      notes: notes.trim(),
      privacyAcknowledged: legalAccepted,
      bookingTermsAccepted: legalAccepted,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      bookingTermsVersion: BOOKING_TERMS_VERSION,
    };

    const parsed = reservationSchema.safeParse(payload);
    if (!parsed.success) {
      setPending(false);
      setError(
        parsed.error.issues[0]?.message ?? "Controlla i campi e riprova.",
      );
      return;
    }

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const data = await parseJsonResponse<{
        ok?: boolean;
        error?: string;
      }>(response);

      if (!data.ok) {
        setError(data.error ?? "Errore durante l'invio. Riprova tra poco.");
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Errore durante l'invio. Riprova tra poco.");
        return;
      }

      setReviewOpen(false);
      setRedirecting(true);
      router.push("/prenotazioni/confermata");
      return;
    } catch {
      setError(
        "Invio non confermato dal server. Se hai dubbi, riprova tra poco o contatta la pizzeria.",
      );
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canOpenReview) {
      setError("Completa tutti i campi obbligatori.");
      return;
    }
    setError(null);
    setReviewOpen(true);
  };

  return (
    <section className="card-block" aria-labelledby="prenota-title">
      <div className="reservation-card-head">
        <h2 id="prenota-title" className="section-title">
          Prenota Un Tavolo
        </h2>
      </div>
      <p className="section-subtitle">Procedi in 4 passaggi rapidi.</p>

      <form className="booking-form" onSubmit={onSubmit}>
        <div
          className="booking-wizard-head"
          role="status"
          aria-live="polite"
          aria-label={`Step ${step} di 4`}
        >
          <span
            className={step >= 1 ? "wizard-line active" : "wizard-line"}
            aria-hidden="true"
          />
          <span
            className={step >= 2 ? "wizard-line active" : "wizard-line"}
            aria-hidden="true"
          />
          <span
            className={step >= 3 ? "wizard-line active" : "wizard-line"}
            aria-hidden="true"
          />
          <span
            className={step >= 4 ? "wizard-line active" : "wizard-line"}
            aria-hidden="true"
          />
        </div>

        {step === 1 ? (
          <div className="booking-step booking-step-screen booking-step-screen-1">
            <p className="booking-step-title">Quante persone siete?</p>
            <div
              className="booking-guests-grid"
              role="group"
              aria-label="Numero persone"
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
                Altro
              </button>
            </div>

            {customGuestsOpen ? (
              <div className="booking-custom-input-pop">
                <label>
                  Numero persone (1-20)
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
                        setCustomGuestsError("Inserisci un numero tra 1 e 20.");
                        return;
                      }

                      if (value > 20) {
                        setGuests(null);
                        setCustomGuestsError(
                          "Non puoi inserire piu di 20 persone in questo campo.",
                        );
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
                  setStep(2);
                }}
              >
                Avanti
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="booking-step booking-step-screen booking-step-screen-2">
            <p className="booking-step-title">
              Scegli dove preferisci mangiare
            </p>

            {noRoomEnabled && !loadingRoomConfig ? (
              <p className="booking-inline-error">
                Nessuna sala disponibile in questo momento. Riprova tra poco.
              </p>
            ) : null}

            <div
              className="booking-area-cards"
              role="group"
              aria-label="Scelta sala"
            >
              <button
                type="button"
                className={
                  diningArea === "inside"
                    ? "booking-area-card active"
                    : "booking-area-card"
                }
                onClick={() => {
                  setDiningArea("inside");
                  setSelectedDate("");
                  setSelectedTime("");
                }}
                disabled={loadingRoomConfig || !insideRoomEnabled}
              >
                {!loadingRoomConfig && !insideRoomEnabled ? (
                  <span className="booking-room-unavailable">
                    NON DISPONIBILE
                  </span>
                ) : null}
                <img
                  src="/assets/Sala%20interna.jpeg"
                  alt="Sala interna"
                />
                <span className="booking-area-card-label">Sala interna</span>
              </button>

              <button
                type="button"
                className={
                  diningArea === "outside"
                    ? "booking-area-card active"
                    : "booking-area-card"
                }
                onClick={() => {
                  setDiningArea("outside");
                  setSelectedDate("");
                  setSelectedTime("");
                }}
                disabled={loadingRoomConfig || !outsideRoomEnabled}
              >
                {!loadingRoomConfig && !outsideRoomEnabled ? (
                  <span className="booking-room-unavailable">
                    NON DISPONIBILE
                  </span>
                ) : null}
                <img
                  src="/assets/Sala%20esterna.jpeg"
                  alt="Sala esterna"
                />
                <span className="booking-area-card-label">Sala esterna</span>
              </button>
            </div>

            <div className="booking-step-actions two-buttons">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setTransitionMessage(null);
                  setStep(1);
                }}
              >
                Indietro
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={loadingRoomConfig || noRoomEnabled || !diningArea}
                onClick={() => {
                  setTransitionMessage(STEP_2_TO_3_MESSAGE);
                  setStep(3);
                }}
              >
                Avanti
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="booking-step booking-step-screen booking-step-screen-2">
            <p className="booking-step-title">Scegli giorno e orario</p>

            {step3View === "date" ? (
              <>
                {availableMonthKeys.length > 1 ? (
                  <div
                    className="booking-month-switch"
                    role="tablist"
                    aria-label="Mesi disponibili"
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
                        {monthLabel(monthKey)}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div
                  className="booking-calendar"
                  role="grid"
                  aria-label="Calendario prenotazioni"
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
                    Indietro
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!selectedDate}
                    onClick={() => setStep3View("time")}
                  >
                    Vai agli orari
                  </button>
                </div>
              </>
            ) : selectedDate ? (
              <div className="booking-time-section">
                <p className="booking-step-title booking-time-title">
                  Orari disponibili per {selectedDate}
                </p>
                <div
                  className="booking-time-grid"
                  role="listbox"
                  aria-label="Orari disponibili"
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
                    Nessun orario disponibile per il giorno selezionato.
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
                    Cambia giorno
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!canProceedStep3}
                    onClick={goToStep4}
                  >
                    Avanti
                  </button>
                </div>
              </div>
            ) : (
              <p className="section-subtitle">
                Seleziona prima un giorno dal calendario.
              </p>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="booking-step booking-step-screen booking-step-screen-3 booking-step-final">
            <p className="booking-step-title">Inserisci i tuoi dati</p>
            <p className="booking-required-note">
              I campi con * sono obbligatori.
            </p>
            <label>
              Nome e cognome <span className="required-mark">*</span>
              <input
                name="customerName"
                type="text"
                required
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
            </label>

            <label>
              Telefono
              <input
                name="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>

            <label>
              Email <span className="required-mark">*</span>
              <input
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              Note (opzionale)
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
                  Ho letto e accetto la{" "}
                  <Link href={PRIVACY_POLICY_PATH} target="_blank">
                    Privacy Policy
                  </Link>
                  {" "}e i{" "}
                  <Link href={BOOKING_TERMS_PATH} target="_blank">
                    Termini di Prenotazione
                  </Link>
                  .
                </span>
              </label>

              <p className="booking-legal-note">
                Useremo i tuoi dati solo per gestire la prenotazione. Versioni
                documenti: privacy {PRIVACY_POLICY_VERSION}, termini{" "}
                {BOOKING_TERMS_VERSION}.
              </p>
            </div>

            <div className="booking-step-actions two-buttons">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(3)}
              >
                Indietro
              </button>
              <button
                className="btn-primary"
                type="submit"
                disabled={!canOpenReview}
              >
                {pending ? "Invio in corso..." : "Riepilogo"}
              </button>
            </div>
          </div>
        ) : null}
      </form>

      {reviewOpen ? (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-modal status-popup-modal">
            <div className="admin-modal-head">
              <h3>Riepilogo prenotazione</h3>
            </div>
            <div className="status-popup-body">
              <p className="booking-selection-summary">
                Persone: <strong>{guests}</strong>
              </p>
              <p className="booking-selection-summary">
                Sala:{" "}
                <strong>{diningArea === "outside" ? "Fuori" : "Dentro"}</strong>
              </p>
              <p className="booking-selection-summary">
                Giorno: <strong>{selectedDateLabel || selectedDate}</strong>
              </p>
              <p className="booking-selection-summary">
                Orario: <strong>{selectedTime}</strong>
              </p>
              <p className="booking-selection-summary">
                Cliente: <strong>{customerName}</strong>
              </p>
              <p className="booking-selection-summary">
                Telefono: <strong>{phone || "-"}</strong>
              </p>
              <p className="booking-selection-summary">
                Email: <strong>{email}</strong>
              </p>
              <p className="booking-selection-summary">
                Documenti accettati: <strong>privacy e termini prenotazione</strong>
              </p>
            </div>
            <div className="booking-step-actions two-buttons booking-review-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setReviewOpen(false)}
                disabled={pending}
              >
                Indietro
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitReservation()}
                disabled={!canOpenReview}
              >
                {pending ? "Invio in corso..." : "Conferma e invia"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {transitionMessage || loadingRoomConfig || (loadingAvailability && step >= 3) ? (
        <div
          className="booking-loader-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="booking-loader-card">
            <img
              src="/assets/loader.gif"
              alt="Caricamento prenotazione"
              className="app-loader-gif"
            />
            <p>
              {transitionMessage ??
                (loadingRoomConfig
                  ? STEP_1_TO_2_MESSAGE
                  : null) ??
                (loadingAvailability ? STEP_2_TO_3_MESSAGE : "Caricamento...")}
            </p>
          </div>
        </div>
      ) : null}

      {redirecting ? (
        <div className="app-loader-overlay" role="status" aria-live="polite">
          <div className="app-loader-card">
            <img
              src="/assets/loader.gif"
              alt="Caricamento"
              className="app-loader-gif"
            />
            <p>Conferma prenotazione in corso...</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
