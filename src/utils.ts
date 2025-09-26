export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function parseNumberFromString(input: string): number | null {
  const match = input.match(
    /[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-+]?\d+(?:\.\d+)?/
  );
  if (!match) return null;
  const cleaned = match[0].replace(/,/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function castValue(rawText: string | null, type: "number" | "string" | "boolean" | "raw" | "array" | "object" | "custom"): unknown {
  if (rawText == null) return null;
  const normalized = normalizeWhitespace(rawText);
  switch (type) {
    case "number": {
      return parseNumberFromString(normalized);
    }
    case "boolean": {
      const v = normalized.toLowerCase();
      if (["true", "yes", "y", "1", "on"].includes(v)) return true;
      if (["false", "no", "n", "0", "off"].includes(v)) return false;
      return null;
    }
    case "string": {
      return normalized;
    }
    case "array": {
      // This case is handled differently in extractor
      return normalized;
    }
    case "object": {
      // This case is handled differently in extractor
      return normalized;
    }
    case "raw":
    case "custom":
    default:
      return rawText;
  }
}