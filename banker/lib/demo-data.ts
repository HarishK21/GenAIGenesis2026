import { Account, DemoUser, Transaction } from "@/lib/types";

export const demoUser: DemoUser = {
  id: "demo-user-river-chen",
  firstName: "River",
  lastName: "Chen",
  displayName: "River Chen",
  avatarInitials: "RC",
  membershipSince: "2023-06-01T12:00:00.000Z"
};

export const demoAccounts: Account[] = [
  {
    id: "chequing",
    name: "Everyday Chequing",
    maskedNumber: "•••• 1842",
    balance: 6845.21,
    lastUpdated: "2026-03-14T13:05:00.000Z"
  },
  {
    id: "savings",
    name: "Maple Savings",
    maskedNumber: "•••• 9471",
    balance: 21340.88,
    lastUpdated: "2026-03-14T12:48:00.000Z"
  }
];

export const demoTransactions: Transaction[] = [
  {
    id: "txn-payroll",
    type: "deposit",
    title: "Payroll Deposit",
    subtitle: "Northwind Creative",
    amount: 2450,
    direction: "in",
    accountId: "chequing",
    occurredAt: "2026-03-13T14:12:00.000Z"
  },
  {
    id: "txn-grocery",
    type: "withdrawal",
    title: "Fresh Market",
    subtitle: "Debit purchase",
    amount: 82.16,
    direction: "out",
    accountId: "chequing",
    occurredAt: "2026-03-13T17:40:00.000Z"
  },
  {
    id: "txn-transfer",
    type: "transfer",
    title: "Transfer to Savings",
    subtitle: "Scheduled savings move",
    amount: 250,
    direction: "out",
    accountId: "chequing",
    occurredAt: "2026-03-12T18:15:00.000Z"
  },
  {
    id: "txn-hydro",
    type: "withdrawal",
    title: "City Hydro",
    subtitle: "Pre-authorized payment",
    amount: 114.72,
    direction: "out",
    accountId: "chequing",
    occurredAt: "2026-03-11T11:08:00.000Z"
  },
  {
    id: "txn-interest",
    type: "deposit",
    title: "Savings Interest",
    subtitle: "Monthly interest credit",
    amount: 31.94,
    direction: "in",
    accountId: "savings",
    occurredAt: "2026-03-10T08:30:00.000Z"
  }
];
