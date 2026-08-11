import { breedLabel } from "./pet-breeds";

export const CHAT_MESSAGE_MAX_LENGTH = 20_000;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VetChatRole = "user" | "assistant";

export function conversationTitle(message: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length > 44 ? `${characters.slice(0, 44).join("")}...` : normalized;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function buildVetSystemPrompt(
  pet: {
    name: string;
    species: string;
    breed: string | null;
    age_years: number;
    age_months: number;
    weight_kg: number;
    daily_target_g: number;
  },
  feedHistorySummary: string,
): string {
  const speciesLabel = pet.species === "Cat" ? "แมว" : pet.species === "Dog" ? "หมา" : pet.species;
  return `คุณคือ VET AI ผู้ช่วยในแอปเครื่องให้อาหารสัตว์เลี้ยงอัจฉริยะ "Petpet"

ข้อมูลสัตว์เลี้ยง:
- ชื่อ: ${pet.name}
- ชนิด: ${speciesLabel}
- สายพันธุ์: ${breedLabel(pet.species, pet.breed)}
- อายุ: ${pet.age_years} ปี ${pet.age_months} เดือน
- น้ำหนัก: ${pet.weight_kg} กก.
- เป้าหมายอาหารต่อวัน: ${pet.daily_target_g} กรัม

ประวัติการให้อาหารใน 24 ชั่วโมงที่ผ่านมา:
${feedHistorySummary}

ตอบคำถามของเจ้าของโดยอ้างอิงข้อมูลข้างต้นเมื่อเกี่ยวข้อง ให้คำแนะนำเบื้องต้นอย่างเป็นมิตรและกระชับ
คุณไม่ใช่สัตวแพทย์ตัวจริงและไม่สามารถวินิจฉัยหรือสั่งยาได้ — แนะนำให้พาไปพบสัตวแพทย์จริงหากมีอาการที่น่าเป็นห่วง`;
}
