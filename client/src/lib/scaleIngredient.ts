/**
 * Scale quantities inside a plain-text ingredient line by a batch factor.
 *
 * Only numbers directly attached to a measurement unit are scaled ("250g",
 * "1/2 cup", "10-15 drops", "1 1/2 teaspoons"); unquantified text ("dried
 * petals for decoration") passes through unchanged.
 */

const UNIT =
  "(?:g|grams?|kg|kilograms?|ml|millilit(?:er|re)s?|lit(?:er|re)s?|oz|ounces?|lbs?|pounds?|cups?|tablespoons?|tbsp|teaspoons?|tsp|drops?)";
const NUM = "\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+";
const QTY_RE = new RegExp(`((?:${NUM})(?:\\s*[-\\u2013]\\s*(?:${NUM}))?)(\\s*)(${UNIT})\\b`, "gi");

function parseAmount(raw: string): number {
  const mixed = raw.trim().match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = raw.trim().match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(raw);
}

function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function scaleIngredientText(text: string, factor: number): string {
  if (factor === 1 || !text) return text;
  return text.replace(QTY_RE, (_match, qty: string, space: string, unit: string) => {
    const parts = qty.split(/\s*[-–]\s*/);
    const scaled = parts
      .map((part) => {
        const amount = parseAmount(part);
        return Number.isFinite(amount) ? formatAmount(amount * factor) : part;
      })
      .join("-");
    return `${scaled}${space}${unit}`;
  });
}
