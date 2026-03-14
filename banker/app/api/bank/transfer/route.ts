import { NextResponse } from "next/server";

import { createTransfer } from "@/lib/bank-repository";
import { TransferRequest } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TransferRequest | null;

  if (!body) {
    return NextResponse.json(
      {
        error: "Transfer payload is required."
      },
      { status: 400 }
    );
  }

  try {
    const snapshot = await createTransfer(body);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to store transfer."
      },
      { status: 400 }
    );
  }
}
