import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/auth-server";

export async function POST() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return new NextResponse(null, { status: 204 });

  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    return NextResponse.json(
      { error: "ไม่สามารถเริ่ม session ของ VET AI ได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 503 },
    );
  }
  return new NextResponse(null, { status: 201 });
}
