import "server-only";

import { getDb } from "@/lib/mongodb";
import { demoAccounts, demoTransactions, demoUser } from "@/lib/demo-data";
import { type RequestTelemetryContext } from "@/lib/request-fingerprint";
import { getBankUserById } from "@/lib/test-users";
import {
  type Account,
  type AccountId,
  type BankSnapshot,
  type DemoUser,
  type SessionSummary,
  type TelemetryEvent,
  type Transaction,
  type TransferRequest
} from "@/lib/types";

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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function asOptionalString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function tokenizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function isGeoProfileMismatch(profileAddress: string, geoRegion: string) {
  const homeTokens = new Set(tokenizeText(profileAddress));
  const geoTokens = tokenizeText(geoRegion);

  if (!homeTokens.size || !geoTokens.length) {
    return false;
  }

  const overlapCount = geoTokens.filter((token) => homeTokens.has(token)).length;
  const overlapRatio = overlapCount / geoTokens.length;

  return overlapRatio < 0.34;
}

function sortAccounts(accounts: Account[]) {
  const accountOrder = ["chequing", "savings"];
  return [...accounts].sort(
    (left, right) => accountOrder.indexOf(left.id) - accountOrder.indexOf(right.id)
  );
}

function parseUserOrdinal(userId: string) {
  if (userId === demoUser.id) {
    return 0;
  }

  const match = /test-user-(\d+)/i.exec(userId);
  if (!match) {
    return 0;
  }

  return Number.parseInt(match[1] ?? "0", 10) || 0;
}

function pseudoHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function buildMaskedNumber(userId: string, accountId: AccountId) {
  const suffixSeed = pseudoHash(`${userId}-${accountId}`);
  const suffix = String((suffixSeed % 9000) + 1000).padStart(4, "0");
  return `**** ${suffix}`;
}

function buildSeedAccounts(userId: string) {
  const ordinal = parseUserOrdinal(userId);

  return demoAccounts.map((account, index) => ({
    ...account,
    maskedNumber: buildMaskedNumber(userId, account.id),
    balance: roundCurrency(account.balance + ordinal * (index === 0 ? 37.11 : 83.47))
  }));
}

function buildSeedTransactions(userId: string) {
  return demoTransactions.map((transaction) => ({
    ...transaction,
    id: `${transaction.id}-${userId}`
  }));
}

function getRequiredUser(userId: string) {
  const user = getBankUserById(userId);
  if (!user) {
    throw new Error(`Unknown bank user: ${userId}`);
  }

  return user;
}

async function seedUserData(userId: string) {
  const user = getRequiredUser(userId);
  const db = await getDb();
  const users = db.collection<DemoUser>("users");
  const accounts = db.collection<AccountDocument>("accounts");
  const transactions = db.collection<TransactionDocument>("transactions");
  const seedAccounts = buildSeedAccounts(userId);
  const seedTransactions = buildSeedTransactions(userId);

  await users.updateOne({ id: user.id }, { $setOnInsert: user }, { upsert: true });

  await Promise.all(
    seedAccounts.map((account) =>
      accounts.updateOne(
        {
          id: account.id,
          userId
        },
        {
          $setOnInsert: {
            ...account,
            userId
          }
        },
        { upsert: true }
      )
    )
  );

  await Promise.all(
    seedTransactions.map((transaction) =>
      transactions.updateOne(
        {
          id: transaction.id,
          userId
        },
        {
          $setOnInsert: {
            ...transaction,
            userId
          }
        },
        { upsert: true }
      )
    )
  );
}

export async function getBankSnapshot(userId: string): Promise<BankSnapshot> {
  await seedUserData(userId);
  const fallbackUser = getRequiredUser(userId);

  const db = await getDb();
  const user = await db
    .collection<DemoUser>("users")
    .findOne(
      { id: userId },
      {
        projection: {
          _id: 0
        }
      }
    );
  const accounts = await db
    .collection<AccountDocument>("accounts")
    .find({ userId })
    .project<Account>({ _id: 0, userId: 0 })
    .toArray();
  const transactions = await db
    .collection<TransactionDocument>("transactions")
    .find({ userId })
    .sort({ occurredAt: -1 })
    .project<Transaction>({ _id: 0, userId: 0 })
    .toArray();

  return {
    user: {
      ...fallbackUser,
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

function isAccountId(value: string): value is AccountId {
  return value === "chequing" || value === "savings";
}

export async function createTransfer(
  userId: string,
  payload: TransferRequest
): Promise<BankSnapshot> {
  await seedUserData(userId);

  const db = await getDb();
  const accountsCollection = db.collection<AccountDocument>("accounts");
  const transactionsCollection = db.collection<TransactionDocument>("transactions");

  const [fromAccount, toAccount] = await Promise.all([
    accountsCollection.findOne({ userId, id: payload.fromAccountId }),
    accountsCollection.findOne({ userId, id: payload.toAccountId })
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
    userId,
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
      { userId, id: payload.fromAccountId },
      {
        $set: {
          balance: roundCurrency(fromAccount.balance - amount),
          lastUpdated: createdAt
        }
      }
    ),
    accountsCollection.updateOne(
      { userId, id: payload.toAccountId },
      {
        $set: {
          balance: roundCurrency(toAccount.balance + amount),
          lastUpdated: createdAt
        }
      }
    ),
    transactionsCollection.insertOne(transaction)
  ]);

  return getBankSnapshot(userId);
}

export async function updateUserProfile(
  userId: string,
  payload: Partial<DemoUser>
): Promise<BankSnapshot> {
  await seedUserData(userId);
  const db = await getDb();

  await db.collection("users").updateOne(
    { id: userId },
    { $set: payload }
  );

  return getBankSnapshot(userId);
}

export async function resetUserData(userId: string): Promise<BankSnapshot> {
  const user = getRequiredUser(userId);
  const db = await getDb();

  await db.collection("users").updateOne(
    { id: userId },
    { $set: user },
    { upsert: true }
  );
  await db.collection("accounts").deleteMany({ userId });
  await db.collection("transactions").deleteMany({ userId });
  await db.collection("telemetry_events").deleteMany({ userId });
  await db.collection("telemetry_sessions").deleteMany({ userId });

  await seedUserData(userId);
  return getBankSnapshot(userId);
}

export async function createDeposit(
  userId: string,
  accountId: string,
  amount: number
): Promise<BankSnapshot> {
  await seedUserData(userId);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Deposit amount must be greater than zero.");
  }

  if (!isAccountId(accountId)) {
    throw new Error("Deposit account must be a valid account ID.");
  }

  const db = await getDb();
  const accountsCollection = db.collection<AccountDocument>("accounts");
  const transactionsCollection = db.collection<TransactionDocument>("transactions");
  const account = await accountsCollection.findOne({
    userId,
    id: accountId
  });

  if (!account) {
    throw new Error("The target account could not be found.");
  }

  const createdAt = new Date().toISOString();
  const roundedAmount = roundCurrency(amount);
  const transaction: TransactionDocument = {
    id: `txn-${crypto.randomUUID()}`,
    userId,
    type: "deposit",
    title: "Quick Deposit",
    subtitle: "Synthetic funds injected for testing",
    amount: roundedAmount,
    direction: "in",
    accountId,
    occurredAt: createdAt
  };

  await Promise.all([
    accountsCollection.updateOne(
      {
        userId,
        id: accountId
      },
      {
        $set: {
          balance: roundCurrency(account.balance + roundedAmount),
          lastUpdated: createdAt
        }
      }
    ),
    transactionsCollection.insertOne(transaction)
  ]);

  return getBankSnapshot(userId);
}

export async function saveTelemetryBatch(
  userId: string,
  payload: TelemetryBatchInput,
  context: RequestTelemetryContext = {}
) {
  await seedUserData(userId);

  const db = await getDb();
  const eventsCollection = db.collection("telemetry_events");
  const sessionsCollection = db.collection("telemetry_sessions");
  const usersCollection = db.collection<DemoUser>("users");
  const receivedAt = new Date().toISOString();
  const source = payload.source ?? "northmaple-bank";
  const contextGeoRegion = asOptionalString(context.geoRegion);
  const contextDeviceLabel = asOptionalString(context.deviceLabel);
  const userRecord = await usersCollection.findOne(
    { id: userId },
    { projection: { _id: 0, address: 1 } }
  );
  const profileAddress =
    asOptionalString(userRecord?.address) ?? getRequiredUser(userId).address;

  if (payload.events.length) {
    await eventsCollection.insertMany(
      payload.events.map((event) => {
        const metadata = asRecord(event.metadata);
        const eventGeoRegion = asOptionalString(metadata.geoRegion ?? contextGeoRegion);
        const eventDeviceLabel = asOptionalString(
          metadata.deviceLabel ?? contextDeviceLabel
        );
        const testRunId = asOptionalString(
          event.testRunId ?? metadata.testRunId ?? metadata.test_run_id
        );
        const agentId = asOptionalString(
          event.agentId ?? metadata.agentId ?? metadata.agent_id
        );
        const scenarioId = asOptionalString(
          event.scenarioId ?? metadata.scenarioId ?? metadata.scenario_id
        );

        return {
          ...event,
          userId,
          source,
          sentAt: payload.sentAt,
          receivedAt,
          metadata: {
            ...metadata,
            ...(eventGeoRegion ? { geoRegion: eventGeoRegion } : {}),
            ...(eventDeviceLabel ? { deviceLabel: eventDeviceLabel } : {})
          },
          geoRegion: eventGeoRegion,
          deviceLabel: eventDeviceLabel,
          testRunId,
          agentId,
          scenarioId
        };
      })
    );
  }

  const sessionSummaries = payload.events.filter(
    (event): event is TelemetryEvent & { metadata: SessionSummary } =>
      event.eventType === "session_summary" && Boolean(event.metadata)
  );

  await Promise.all(
    sessionSummaries.map(async (summaryEvent) => {
      const metadata = asRecord(summaryEvent.metadata);
      const summaryGeoRegion = asOptionalString(
        metadata.geoRegion ?? contextGeoRegion
      );
      const summaryDeviceLabel = asOptionalString(
        metadata.deviceLabel ?? contextDeviceLabel
      );
      const seenGeoRegion = summaryGeoRegion
        ? await sessionsCollection.findOne(
            {
              userId,
              geoRegion: summaryGeoRegion,
              sessionId: { $ne: summaryEvent.sessionId }
            },
            { projection: { _id: 1 } }
          )
        : null;
      const geoRegionNewForUser = summaryGeoRegion ? !seenGeoRegion : false;
      const geoProfileMismatch = summaryGeoRegion
        ? isGeoProfileMismatch(profileAddress, summaryGeoRegion)
        : false;
      const suspiciousBehaviorSignals =
        asBoolean(metadata.rapidNavFlag, false) ||
        asBoolean(metadata.erraticMouseFlag, false) ||
        asNumber(metadata.sharpDirectionChanges, 0) >= 20;
      const unusualLocationFlag =
        geoProfileMismatch || (geoRegionNewForUser && suspiciousBehaviorSignals);
      const enrichedMetadata = {
        ...metadata,
        ...(summaryGeoRegion ? { geoRegion: summaryGeoRegion } : {}),
        ...(summaryDeviceLabel ? { deviceLabel: summaryDeviceLabel } : {}),
        geoRegionNewForUser,
        geoProfileMismatch,
        unusualLocationFlag
      };

      return sessionsCollection.updateOne(
        {
          userId,
          sessionId: summaryEvent.sessionId
        },
        {
          $set: {
            userId,
            sessionId: summaryEvent.sessionId,
            page: summaryEvent.page,
            source,
            metadata: enrichedMetadata,
            geoRegion: summaryGeoRegion,
            deviceLabel: summaryDeviceLabel,
            unusualLocationFlag,
            updatedAt: receivedAt,
            testRunId: asOptionalString(
              summaryEvent.testRunId ??
                summaryEvent.metadata?.testRunId ??
                summaryEvent.metadata?.test_run_id
            ),
            agentId: asOptionalString(
              summaryEvent.agentId ??
                summaryEvent.metadata?.agentId ??
                summaryEvent.metadata?.agent_id
            ),
            scenarioId: asOptionalString(
              summaryEvent.scenarioId ??
                summaryEvent.metadata?.scenarioId ??
                summaryEvent.metadata?.scenario_id
            )
          }
        },
        { upsert: true }
      );
    })
  );

  return {
    received: payload.events.length,
    storedSessionSummaries: sessionSummaries.length
  };
}
