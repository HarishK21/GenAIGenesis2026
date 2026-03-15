import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  try {
    const { accountId, amount } = await req.json();

    if (!accountId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid deposit input." }, { status: 400 });
    }

    const db = await getDb();

    // 1. Update the account balance
    await db.collection("accounts").updateOne(
      { id: accountId },
      { 
        $inc: { balance: amount },
        $set: { lastUpdated: new Date().toISOString() } 
      }
    );

    // 2. Insert a new deposit transaction
    const newTransaction = {
      id: "txn_" + randomUUID().substring(0, 8),
      accountId,
      type: "deposit",
      amount,
      occurredAt: new Date().toISOString(),
      title: "Quick Deposit",
      subtitle: "Synthetic funds injected for testing",
      direction: "in",
    };

    await db.collection("transactions").insertOne(newTransaction);

    // 3. Fetch the updated state to return to the client
    const { getBankSnapshot } = await import("@/lib/bank-repository");
    const snapshot = await getBankSnapshot();

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[Deposit Error]", error);
    return NextResponse.json({ error: "Failed to process deposit." }, { status: 500 });
  }
}
