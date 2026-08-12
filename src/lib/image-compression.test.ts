import { describe, expect, it } from "vitest";
import { compressionCandidates, fitWithinDimension } from "./image-compression";

describe("VET AI image compression policy", () => {
  it("caps the longest side at 1568 pixels without changing aspect ratio", () => {
    expect(fitWithinDimension(4032, 3024)).toEqual({ width: 1568, height: 1176 });
    expect(fitWithinDimension(800, 1200)).toEqual({ width: 800, height: 1200 });
  });

  it("tries quality reductions before reducing dimensions", () => {
    const candidates = compressionCandidates(4000, 3000);
    expect(candidates[0]).toEqual({ width: 1568, height: 1176, quality: 0.9 });
    expect(candidates[6]).toEqual({ width: 1568, height: 1176, quality: 0.42 });
    expect(candidates[7]).toEqual({ width: 1333, height: 1000, quality: 0.9 });
    expect(candidates.at(-1)).toEqual({ width: 470, height: 353, quality: 0.42 });
  });
});
