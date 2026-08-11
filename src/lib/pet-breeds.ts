export type PetSpecies = "Dog" | "Cat";

export interface BreedOption {
  value: string;
  label: string;
}

export const DOG_BREEDS: readonly BreedOption[] = [
  { value: "golden_retriever", label: "Golden Retriever" },
  { value: "labrador_retriever", label: "Labrador Retriever" },
  { value: "german_shepherd", label: "German Shepherd" },
  { value: "shiba_inu", label: "Shiba Inu" },
  { value: "pomeranian", label: "Pomeranian" },
  { value: "chihuahua", label: "Chihuahua" },
  { value: "french_bulldog", label: "French Bulldog" },
  { value: "pug", label: "Pug" },
  { value: "beagle", label: "Beagle" },
  { value: "poodle", label: "Poodle" },
  { value: "siberian_husky", label: "Siberian Husky" },
  { value: "rottweiler", label: "Rottweiler" },
  { value: "border_collie", label: "Border Collie" },
  { value: "corgi", label: "Pembroke Welsh Corgi" },
  { value: "dachshund", label: "Dachshund" },
  { value: "yorkshire_terrier", label: "Yorkshire Terrier" },
  { value: "mixed_breed", label: "Mixed Breed" },
  { value: "other", label: "Other" },
];

export const CAT_BREEDS: readonly BreedOption[] = [
  { value: "persian", label: "Persian" },
  { value: "siamese", label: "Siamese" },
  { value: "british_shorthair", label: "British Shorthair" },
  { value: "scottish_fold", label: "Scottish Fold" },
  { value: "ragdoll", label: "Ragdoll" },
  { value: "maine_coon", label: "Maine Coon" },
  { value: "american_shorthair", label: "American Shorthair" },
  { value: "bengal", label: "Bengal" },
  { value: "sphynx", label: "Sphynx" },
  { value: "russian_blue", label: "Russian Blue" },
  { value: "burmese", label: "Burmese" },
  { value: "exotic_shorthair", label: "Exotic Shorthair" },
  { value: "mixed_breed", label: "Mixed Breed" },
  { value: "other", label: "Other" },
];

export function isPetSpecies(value: unknown): value is PetSpecies {
  return value === "Dog" || value === "Cat";
}

export function breedsForSpecies(species: PetSpecies): readonly BreedOption[] {
  return species === "Dog" ? DOG_BREEDS : CAT_BREEDS;
}

export function isBreedForSpecies(species: PetSpecies, breed: string): boolean {
  return breedsForSpecies(species).some((option) => option.value === breed);
}

export function breedLabel(species: string, breed: string | null | undefined): string {
  if (!breed || !isPetSpecies(species)) return "ไม่ระบุ";
  return breedsForSpecies(species).find((option) => option.value === breed)?.label ?? "ไม่ระบุ";
}
