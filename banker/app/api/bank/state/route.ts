import { NextResponse } from "next/server";

import { getBankSnapshot } from "@/lib/bank-repository";

export async function GET() {
  try {
    const snapshot = await getBankSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load MongoDB banking data."
      },
      { status: 500 }
    );
  }
}
