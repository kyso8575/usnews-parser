import * as fs from "fs";
import * as path from "path";

export interface FieldConfig {
  find?: string[];
  getText?: string[];
  type?: "number" | "string" | "boolean" | "raw" | "array" | "object" | "custom";
  // When provided, extract the given attribute from the matched element instead of text
  attribute?: string;
  objectMapping?: Record<string, {
    find: string[];
    getText?: string[];
    type?: "number" | "string" | "boolean" | "raw" | "array" | "object" | "custom";
  }>;
  flexibleMapping?: boolean;
  customFunction?: string;
  getItemType?: "number" | "string" | "boolean" | "raw";
}

export type ExtractionConfig = Record<string, FieldConfig>;

function loadConfig(): ExtractionConfig {
  const configPath = path.resolve("./data/extraction-config.json");
  const configContent = fs.readFileSync(configPath, "utf8");
  return JSON.parse(configContent) as ExtractionConfig;
}

export const config: ExtractionConfig = loadConfig();
