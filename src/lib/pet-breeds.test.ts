import { describe, expect, it } from "vitest";
import { breedLabel, breedsForSpecies, isBreedForSpecies } from "./pet-breeds";

describe("pet breed data", () => {
  it("keeps dog and cat options separated", () => {
    expect(isBreedForSpecies("Dog", "golden_retriever")).toBe(true);
    expect(isBreedForSpecies("Cat", "golden_retriever")).toBe(false);
    expect(isBreedForSpecies("Cat", "siamese")).toBe(true);
  });

  it("provides Mixed Breed and Other for both species", () => {
    for (const species of ["Dog", "Cat"] as const) {
      expect(breedsForSpecies(species).map((breed) => breed.value)).toEqual(
        expect.arrayContaining(["mixed_breed", "other"]),
      );
    }
  });

  it("uses an honest fallback for missing or invalid legacy data", () => {
    expect(breedLabel("Dog", null)).toBe("ไม่ระบุ");
    expect(breedLabel("Dog", "unknown_legacy_value")).toBe("ไม่ระบุ");
    expect(breedLabel("Cat", "siamese")).toBe("Siamese");
  });
});
