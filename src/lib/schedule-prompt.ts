import { breedLabel } from "./pet-breeds";

export function buildSchedulePrompt(pet: { species: string; breed: string | null; weight_kg: number; age_years: number; age_months: number }): string {
  return `คุณคือ VET AI ผู้ช่วยวางแผนตารางการให้อาหารสัตว์เลี้ยง

ข้อมูลสัตว์เลี้ยง:
- ชนิด: ${pet.species === "Cat" ? "แมว" : pet.species === "Dog" ? "หมา" : pet.species}
- สายพันธุ์: ${breedLabel(pet.species, pet.breed)}
- น้ำหนัก: ${pet.weight_kg} กก.
- อายุ: ${pet.age_years} ปี ${pet.age_months} เดือน

จงวางแผนตารางการให้อาหาร 3 มื้อต่อวัน (เช้า กลางวัน เย็น) โดยใช้ชนิด น้ำหนัก อายุ และข้อมูลการให้อาหารเป็นปัจจัยหลัก กำหนดเวลาที่เหมาะสมสำหรับแต่ละมื้อ และปริมาณอาหารเป็นกรัมต่อมื้อที่เหมาะสมต่อสุขภาพ สายพันธุ์เป็นเพียงข้อมูลประกอบเมื่อมีความเกี่ยวข้องทางสรีรวิทยา ห้ามสรุปปริมาณอาหารที่แน่นอนจากสายพันธุ์เพียงอย่างเดียว`;
}
