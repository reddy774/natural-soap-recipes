import { describe, expect, it } from "vitest";
import { scaleIngredientText } from "./scaleIngredient";

describe("scaleIngredientText", () => {
  it("returns the original string at factor 1", () => {
    expect(scaleIngredientText("250g Organic Coconut Oil", 1)).toBe("250g Organic Coconut Oil");
  });

  it("scales attached metric grams", () => {
    expect(scaleIngredientText("250g Organic Coconut Oil", 2)).toBe("500g Organic Coconut Oil");
  });

  it("scales spaced units and decimals", () => {
    expect(scaleIngredientText("2.5 oz shea butter", 2)).toBe("5 oz shea butter");
  });

  it("scales simple fractions", () => {
    expect(scaleIngredientText("1/2 cup citric acid", 3)).toBe("1.5 cup citric acid");
  });

  it("scales mixed numbers", () => {
    expect(scaleIngredientText("1 1/2 teaspoons vanilla extract", 2)).toBe("3 teaspoons vanilla extract");
  });

  it("scales both ends of a range", () => {
    expect(scaleIngredientText("10-15 drops lavender essential oil", 2)).toBe(
      "20-30 drops lavender essential oil",
    );
  });

  it("rounds to two decimals", () => {
    expect(scaleIngredientText("1/4 cup jojoba oil", 1.3)).toBe("0.33 cup jojoba oil");
  });

  it("leaves unquantified lines unchanged", () => {
    expect(scaleIngredientText("Dried rose petals for decoration", 2)).toBe(
      "Dried rose petals for decoration",
    );
  });

  it("leaves unit-less counts unchanged", () => {
    expect(scaleIngredientText("Zest of 1 lime", 2)).toBe("Zest of 1 lime");
  });

  it("scales multiple quantities in one line", () => {
    expect(scaleIngredientText("Mix 100g lye with 230g distilled water", 0.5)).toBe(
      "Mix 50g lye with 115g distilled water",
    );
  });
});
