export type AccountId = "chequing" | "savings";
export type TransactionType = "deposit" | "withdrawal" | "transfer";

export interface DemoUser {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarInitials: string;
  membershipSince: string;
  email: string;
  phone: string;
  address: string;
}

export interface Account {
  id: AccountId;
  name: string;
  maskedNumber: string;
  balance: number;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  subtitle: string;
  amount: number;
  direction: "in" | "out";
  accountId?: AccountId;
  occurredAt: string;
  note?: string;
}

export interface TransferRequest {
  fromAccountId: AccountId;
  toAccountId: AccountId;
  amount: number;
  note?: string;
}

export interface BankSnapshot {
  user: DemoUser;
  accounts: Account[];
  transactions: Transaction[];
}

export interface TelemetryEvent {
  sessionId: string;
  eventType:
    | "page_view"
    | "page_dwell"
    | "nav_click"
    | "account_card_click"
    | "transfer_field_focus"
    | "transfer_amount_change"
    | "hesitation_detected"
    | "review_transfer"
    | "submit_transfer"
    | "session_summary"
    | "area_transition"
    | "rapid_navigation"
    | "rapid_repeat_click"
    | "first_click"
    | "ui_click";
  page: string;
  elementId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SessionSummary {
  sessionId: string;
  totalSessionDuration: number;
  clickCount: number;
  avgTypingSpeed: number;
  correctionCount: number;
  hesitationCount: number;
  unusualAmountFlag: boolean;
  erraticMouseFlag: boolean;
  rapidNavFlag: boolean;
  submitDelayMs: number;
  focusChanges: number;
  transferAmount: number;
  majorClickSequence: string[];
  areaPath: string[];
}
