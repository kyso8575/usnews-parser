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

export function parseSAT1600Scale(rawText: string): Record<string, number> | null {
  if (!rawText || rawText === "N/A") return null;
  
  // Remove the "SATs on 1600 scale" prefix if present
  const cleanText = rawText.replace(/^SATs on 1600 scale/i, '').trim();
  
  // Pattern to match score ranges and percentages
  // Matches patterns like "1400-160097%" or "1200-13992%"
  const pattern = /(\d{3,4}-\d{3,4})(\d+(?:\.\d+)?%)/g;
  const result: Record<string, number> = {};
  
  let match;
  while ((match = pattern.exec(cleanText)) !== null) {
    const scoreRange = match[1];
    const percentageStr = match[2].replace('%', '');
    const percentage = parseFloat(percentageStr);
    
    if (!isNaN(percentage)) {
      result[scoreRange] = percentage;
    }
  }
  
  return Object.keys(result).length > 0 ? result : null;
}

export function castValue(rawText: string | null, type: "number" | "string" | "boolean" | "raw" | "array" | "object" | "custom"): unknown {
  if (rawText == null) return null;
  
  switch (type) {
    case "number": {
      const normalized = normalizeWhitespace(rawText);
      return parseNumberFromString(normalized);
    }
    case "boolean": {
      const normalized = normalizeWhitespace(rawText);
      const v = normalized.toLowerCase();
      if (["true", "yes", "y", "1", "on"].includes(v)) return true;
      if (["false", "no", "n", "0", "off"].includes(v)) return false;
      return null;
    }
    case "string": {
      return normalizeWhitespace(rawText);
    }
    case "array": {
      // Arrays are handled in extractor logic, return null here to indicate empty/nonexistent data
      return null;
    }
    case "object": {
      // Objects are handled in extractor logic, return null here to indicate empty/nonexistent data
      return null;
    }
    case "raw": 
    case "custom":
    default:
      return rawText;
  }
}