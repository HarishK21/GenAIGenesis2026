import "server-only";

import { getDb } from "@/lib/mongodb";
import { demoAccounts, demoTransactions, demoUser } from "@/lib/demo-data";
import { Account, BankSnapshot, DemoUser, SessionSummary, TelemetryEvent, Transaction, TransferRequest } from "@/lib/types";

const DEMO_USER_ID = demoUser.id;

interface AccountDocument extends Account {
  userId: string;
}

interface TransactionDocument extends Transaction {
  userId: string;
}

interface TelemetryBatchInput {
  source?: string;
  sentAt?: string;
  events: TelemetryEvent[];
}

function sortAccounts(accounts: Account[]) {
  const accountOrder = ["chequing", "savings"];
  return [...accounts].sort((left, right) => accountOrder.indexOf(left.id) - accountOrder.indexOf(right.id));
}

async function seedDemoData() {
  const db = await getDb();
  const users = db.collection("users");
  const accounts = db.collection<AccountDocument>("accounts");
  const transactions = db.collection<TransactionDocument>("transactions");

  await users.updateOne({ id: DEMO_USER_ID }, { $setOnInsert: demoUser }, { upsert: true });

  await Promise.all(
    demoAccounts.map((account) =>
      accounts.updateOne(
        {
          id: account.id,
          userId: DEMO_USER_ID
        },
        {
          $setOnInsert: {
            ...account,
            userId: DEMO_USER_ID
          }
        },
        { upsert: true }
      )
    )
  );

  await Promise.all(
    demoTransactions.map((transaction) =>
      transactions.updateOne(
        {
          id: transaction.id,
          userId: DEMO_USER_ID
        },
        {
          $setOnInsert: {
            ...transaction,
            userId: DEMO_USER_ID
          }
        },
        { upsert: true }
      )
    )
  );
}

export async function getBankSnapshot(): Promise<BankSnapshot> {
  await seedDemoData();

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne(
      { id: DEMO_USER_ID },
      {
        projection: {
          _id: 0
        }
      }
    );
  const accounts = await db
    .collection<AccountDocument>("accounts")
    .find({ userId: DEMO_USER_ID })
    .project<Account>({ _id: 0, userId: 0 })
    .toArray();
  const transactions = await db
    .collection<TransactionDocument>("transactions")
    .find({ userId: DEMO_USER_ID })
    .sort({ occurredAt: -1 })
    .project<Transaction>({ _id: 0, userId: 0 })
    .toArray();

  return {
    user: {
      ...demoUser,
      ...(user ?? {})
    },
    accounts: sortAccounts(accounts),
    transactions
  };
}

function transferTitle(toName: string) {
  return `Transfer to ${toName.replace("Maple ", "")}`;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

export async function createTransfer(payload: TransferRequest): Promise<BankSnapshot> {
  await seedDemoData();

  const db = await getDb();
  const accountsCollection = db.collection<AccountDocument>("accounts");
  const transactionsCollection = db.collection<TransactionDocument>("transactions");

  const [fromAccount, toAccount] = await Promise.all([
    accountsCollection.findOne({ userId: DEMO_USER_ID, id: payload.fromAccountId }),
    accountsCollection.findOne({ userId: DEMO_USER_ID, id: payload.toAccountId })
  ]);

  if (!fromAccount || !toAccount) {
    throw new Error("The demo transfer accounts could not be loaded from MongoDB.");
  }

  if (payload.fromAccountId === payload.toAccountId) {
    throw new Error("Choose two different accounts for the demo transfer.");
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  if (payload.amount > fromAccount.balance) {
    throw new Error("Transfer amount exceeds the available balance of the source account.");
  }

  const createdAt = new Date().toISOString();
  const amount = roundCurrency(payload.amount);
  const transaction: TransactionDocument = {
    id: `txn-${crypto.randomUUID()}`,
    userId: DEMO_USER_ID,
    type: "transfer",
    title: transferTitle(toAccount.name),
    subtitle: payload.note?.trim() ? payload.note.trim() : "Instant transfer",
    amount,
    direction: "out",
    accountId: payload.fromAccountId,
    occurredAt: createdAt,
    note: payload.note
  };

  await Promise.all([
    accountsCollection.updateOne(
      { userId: DEMO_USER_ID, id: payload.fromAccountId },
      {
        $set: {
          balance: roundCurrency(fromAccount.balance - amount),
          lastUpdated: createdAt
        }
      }
    ),
    accountsCollection.updateOne(
      { userId: DEMO_USER_ID, id: payload.toAccountId },
      {
        $set: {
          balance: roundCurrency(toAccount.balance + amount),
          lastUpdated: createdAt
        }
      }
    ),
    transactionsCollection.insertOne(transaction)
  ]);

  return getBankSnapshot();
}

export async function updateUserProfile(payload: Partial<DemoUser>): Promise<BankSnapshot> {
  await seedDemoData();
  const db = await getDb();
  
  await db.collection("users").updateOne(
    { id: DEMO_USER_ID },
    { $set: payload }
  );

  return getBankSnapshot();
}

export async function resetDemoData(): Promise<BankSnapshot> {
  const db = await getDb();
  
  // Clear existing demo data
  await db.collection("users").deleteOne({ id: DEMO_USER_ID });
  await db.collection("accounts").deleteMany({ userId: DEMO_USER_ID });
  await db.collection("transactions").deleteMany({ userId: DEMO_USER_ID });
  
  // Re-seed with fresh data
  await seedDemoData();
  
  return getBankSnapshot();
}

export async function saveTelemetryBatch(payload: TelemetryBatchInput) {
  await seedDemoData();

  const db = await getDb();
  const eventsCollection = db.collection("telemetry_events");
  const sessionsCollection = db.collection("telemetry_sessions");
  const receivedAt = new Date().toISOString();

  if (payload.events.length) {
    await eventsCollection.insertMany(
      payload.events.map((event) => ({
        ...event,
        userId: DEMO_USER_ID,
        source: payload.source ?? "northmaple-bank-demo",
        sentAt: payload.sentAt,
        receivedAt
      }))
    );
  }

  const sessionSummaries = payload.events.filter(
    (event): event is TelemetryEvent & { metadata: SessionSummary } =>
      event.eventType === "session_summary" && Boolean(event.metadata)
  );

  await Promise.all(
    sessionSummaries.map((summaryEvent) =>
      sessionsCollection.updateOne(
        { sessionId: summaryEvent.sessionId },
        {
          $set: {
            userId: DEMO_USER_ID,
            sessionId: summaryEvent.sessionId,
            page: summaryEvent.page,
            metadata: summaryEvent.metadata,
            updatedAt: receivedAt
          }
        },
        { upsert: true }
      )
    )
  );

  return {
    received: payload.events.length,
    storedSessionSummaries: sessionSummaries.length
  };
}
