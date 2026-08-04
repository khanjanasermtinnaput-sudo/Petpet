import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ | Petpet",
  description: "เข้าสู่ระบบเพื่อดูแลสัตว์เลี้ยงของคุณ",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}