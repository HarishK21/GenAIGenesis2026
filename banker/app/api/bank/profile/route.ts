import { NextResponse } from "next/server";
import { updateUserProfile } from "@/lib/bank-repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const snapshot = await updateUserProfile({
      email: body.email,
      phone: body.phone,
      address: body.address
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update profile." },
      { status: 500 }
    );
  }
}
