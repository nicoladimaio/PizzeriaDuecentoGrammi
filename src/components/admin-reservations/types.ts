export type ActionType = "confirmed" | "rejected" | "proposed" | "delete";

export type ProposalDraft = {
  ownerResponse: string;
  proposedDate: string;
  proposedTime: string;
};

export type CalendarCell =
  { kind: "empty" } | { kind: "day"; dateKey: string; day: number };

export type DecisionDialogMode = "rejected" | "proposed";

export type DecisionAvailability = {
  days: Array<{
    date: string;
    hasAvailability: boolean;
  }>;
  slotsByDate: Record<string, Array<{ time: string; available: boolean }>>;
  error?: string;
};

export type ManualReservationForm = {
  customerName: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  guests: string;
  notes: string;
};

export type ApiErrorPayload = {
  error?: string;
};

export type SettingsLeaveGuard = {
  hasUnsavedChanges: () => boolean;
  saveChanges: () => Promise<boolean>;
  discardChanges: () => void;
};

export type SettingsTab = "general" | "availability" | "exceptions";
