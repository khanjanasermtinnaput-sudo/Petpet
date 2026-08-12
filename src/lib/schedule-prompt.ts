import { breedLabel } from "./pet-breeds";
import { KCAL_PER_GRAM_DEFAULT, renderLifeStageTableTh } from "./vet-nutrition";

export function buildSchedulePrompt(pet: { species: string; breed: string | null; weight_kg: number; age_years: number; age_months: number }): string {
  return `คุณคือ VET AI ผู้ช่วยวางแผนตารางการให้อาหารสัตว์เลี้ยง

ข้อมูลสัตว์เลี้ยง:
- ชนิด: ${pet.species === "Cat" ? "แมว" : pet.species === "Dog" ? "หมา" : pet.species}
- สายพันธุ์: ${breedLabel(pet.species, pet.breed)}
- น้ำหนัก: ${pet.weight_kg} กก.
- อายุ: ${pet.age_years} ปี ${pet.age_months} เดือน

จงวางแผนตารางการให้อาหาร 3 มื้อต่อวัน (เช้า กลางวัน เย็น) โดยใช้ชนิด น้ำหนัก อายุ และข้อมูลการให้อาหารเป็นปัจจัยหลัก กำหนดเวลาที่เหมาะสมสำหรับแต่ละมื้อ และปริมาณอาหารเป็นกรัมต่อมื้อที่เหมาะสมต่อสุขภาพ สายพันธุ์เป็นเพียงข้อมูลประกอบเมื่อมีความเกี่ยวข้องทางสรีรวิทยา ห้ามสรุปปริมาณอาหารที่แน่นอนจากสายพันธุ์เพียงอย่างเดียว

วิธีคำนวณปริมาณอาหารต่อวัน ให้คำนวณตามหลักโภชนาการสัตวแพทย์ต่อไปนี้ทีละขั้นตอน แล้วรายงานตัวเลขทุกขั้นตอนกลับมาด้วย:

ขั้นที่ 1 — คำนวณ RER (Resting Energy Requirement, พลังงานที่ใช้ขณะพัก หน่วย kcal/วัน):
  RER = 70 × (น้ำหนักตัวเป็นกิโลกรัม) ^ 0.75
  สำหรับสัตว์เลี้ยงตัวนี้ น้ำหนัก ${pet.weight_kg} กก. ดังนั้น RER ≈ 70 × ${pet.weight_kg}^0.75

ขั้นที่ 2 — เลือกตัวคูณช่วงวัย (life stage factor) จากตารางต่อไปนี้ โดยเทียบอายุของสัตว์เลี้ยงกับช่วงที่ตรงกัน:
${renderLifeStageTableTh(pet.species)}

ขั้นที่ 3 — คำนวณ MER (Maintenance Energy Requirement, พลังงานที่ต้องการต่อวัน หน่วย kcal/วัน):
  MER = RER × ตัวคูณช่วงวัยจากขั้นที่ 2

ขั้นที่ 4 — แปลงจากพลังงาน (kcal) เป็นน้ำหนักอาหาร (กรัม) โดยใช้ค่าคงที่ความหนาแน่นพลังงานของอาหารเม็ดสำเร็จรูปทั่วไปที่ ${KCAL_PER_GRAM_DEFAULT} kcal ต่อกรัมเสมอ (ค่านี้คงที่ ไม่ต้องปรับเปลี่ยนตามชนิดหรือสายพันธุ์):
  ปริมาณอาหารต่อวัน (กรัม) = MER ÷ ${KCAL_PER_GRAM_DEFAULT}

จากนั้นให้แบ่งปริมาณอาหารต่อวันที่คำนวณได้ออกเป็น 3 มื้อ (เช้า กลางวัน เย็น) ตามความเหมาะสม และรายงานผลลัพธ์ทุกขั้นตอนกลับมาเป็นตัวเลขในฟิลด์ rer_kcal, life_stage_factor, mer_kcal, kcal_per_gram_assumed (ควรเท่ากับ ${KCAL_PER_GRAM_DEFAULT}) และ daily_target_g (ผลรวมของทั้ง 3 มื้อ) พร้อมรายละเอียดแต่ละมื้อใน meals`;
}
