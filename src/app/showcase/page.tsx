import type { Metadata } from "next";
import { ShowcaseClient } from "./ShowcaseClient";

export const metadata: Metadata = {
  title: "รีวิว Petpet — เครื่องให้อาหารสัตว์เลี้ยงอัจฉริยะ",
  description:
    "รีวิวการใช้งานแอป Petpet: ชั่งน้ำหนักอาหารในถาดแบบเรียลไทม์ ดูประวัติการกิน 7 วัน และถาม AI สัตวแพทย์เป็นภาษาไทย",
};

export default function ShowcasePage() {
  return <ShowcaseClient />;
}
