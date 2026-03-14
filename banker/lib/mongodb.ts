import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "northmaple_bank_demo";

if (!uri) {
  throw new Error("Missing MONGODB_URI. Add it to .env.local before running the app.");
}

declare global {
  var _northMapleMongoClientPromise: Promise<MongoClient> | undefined;
}

const client = new MongoClient(uri, {
  appName: "NorthMapleBankDemo"
});

const clientPromise =
  process.env.NODE_ENV === "development"
    ? global._northMapleMongoClientPromise ?? (global._northMapleMongoClientPromise = client.connect())
    : client.connect();

export async function getDb() {
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}
