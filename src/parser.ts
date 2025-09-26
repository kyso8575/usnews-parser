import { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { normalizeWhitespace } from "./utils";

export type StepAction = "get" | "haveText";

export function parseStep(step: string): { action: StepAction; arg: string } {
  const trimmed = step.trim();
  const idx = trimmed.indexOf(":");
  if (idx === -1) {
    throw new Error(`Invalid step syntax: ${step}`);
  }
  const actionRaw = trimmed.slice(0, idx).trim();
  const arg = trimmed.slice(idx + 1).trim();
  const lower = actionRaw.toLowerCase();
  let action: StepAction;
  if (lower === "find" || lower === "get") action = "get";
  else if (lower === "havetext") action = "haveText";
  else throw new Error(`Unsupported step action: ${actionRaw}`);
  if (!arg.length) {
    throw new Error(`Step missing argument: ${step}`);
  }
  return { action, arg };
}

export function selectWithin(
  $: CheerioAPI,
  roots: Cheerio<AnyNode>,
  selector: string
): Cheerio<AnyNode> {
  const matches: AnyNode[] = [];
  const rootArray: AnyNode[] =
    roots.length === 0
      ? [$.root().get(0) as unknown as AnyNode]
      : (roots.toArray() as unknown as AnyNode[]);
  for (const el of rootArray) {
    ($ as unknown as CheerioAPI)(el)
      .find(selector)
      .each((__, match) => {
        matches.push(match as unknown as AnyNode);
      });
  }
  return ($ as unknown as CheerioAPI)(matches);
}

export function filterByText(
  $: CheerioAPI,
  roots: Cheerio<AnyNode>,
  needleRaw: string
): Cheerio<AnyNode> {
  const needle = normalizeWhitespace(needleRaw);
  const kept: AnyNode[] = [];
  const arr = roots.toArray() as unknown as AnyNode[];
  for (const el of arr) {
    const haystack = normalizeWhitespace(
      ($ as unknown as CheerioAPI)(el).text()
    );
    if (haystack.includes(needle)) {
      kept.push(el);
    }
  }
  return ($ as unknown as CheerioAPI)(kept);
}

export function applySteps(
  $: CheerioAPI,
  initialRoots: Cheerio<AnyNode>,
  steps: string[] | undefined
): Cheerio<AnyNode> {
  if (!steps || steps.length === 0) {
    return initialRoots;
  }
  let current = initialRoots;
  for (const step of steps) {
    const { action, arg } = parseStep(step);
    if (action === "get") {
      current = selectWithin($, current, arg);
    } else if (action === "haveText") {
      current = filterByText($, current, arg);
    } else {
      throw new Error(`Unsupported step action: ${action}`);
    }
    // If any step fails (no matches), return empty result
    if (current.length === 0) {
      return current;
    }
  }
  return current;
}