export type PetSpecies = "Dog" | "Cat";

export interface PetBreed {
  value: string;
  label: string;
}

export const PET_BREEDS: Record<PetSpecies, PetBreed[]> = {
  Dog: [
    { value: "Golden Retriever", label: "โกลเด้น รีทรีฟเวอร์" },
    { value: "Labrador Retriever", label: "ลาบราดอร์ รีทรีฟเวอร์" },
    { value: "Pomeranian", label: "ปอมเมอเรเนียน" },
    { value: "Chihuahua", label: "ชิวาวา" },
    { value: "Shih Tzu", label: "ชิสุ" },
    { value: "French Bulldog", label: "เฟรนช์ บูลด็อก" },
    { value: "Poodle", label: "พุดเดิ้ล" },
    { value: "Thai Bangkaew", label: "ไทยบางแก้ว" },
    { value: "Thai Ridgeback", label: "ไทยหลังอาน" },
    { value: "Mixed Breed", label: "พันธุ์ผสม" },
  ],
  Cat: [
    { value: "British Shorthair", label: "บริติชชอร์ตแฮร์" },
    { value: "Scottish Fold", label: "สก็อตติชโฟลด์" },
    { value: "Persian", label: "เปอร์เซีย" },
    { value: "Siamese", label: "วิเชียรมาศ" },
    { value: "American Shorthair", label: "อเมริกันชอร์ตแฮร์" },
    { value: "Maine Coon", label: "เมนคูน" },
    { value: "Ragdoll", label: "แร็กดอลล์" },
    { value: "Bengal", label: "เบงกอล" },
    { value: "Domestic Shorthair", label: "แมวบ้านขนสั้น" },
    { value: "Mixed Breed", label: "พันธุ์ผสม" },
  ],
};
