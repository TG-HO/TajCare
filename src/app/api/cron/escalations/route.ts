import { NextResponse } from "next/server";
import { checkAndProcessEscalations } from "@/lib/escalation/service";

export async function GET() {
  try {
    const result = await checkAndProcessEscalations();
    return NextResponse.json({
      success: true,
      message: `Checked ${result.checkedCount} pending ticket(s); escalated ${result.escalatedCount}.`,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
