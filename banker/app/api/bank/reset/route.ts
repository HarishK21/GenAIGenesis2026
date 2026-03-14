import { NextResponse } from "next/server";
import { resetDemoData } from "@/lib/bank-repository";

export async function POST() {
  try {
    const snapshot = await resetDemoData();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reset data." },
      { status: 500 }
    );
  }
}
