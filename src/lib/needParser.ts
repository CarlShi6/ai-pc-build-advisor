import type { CustomerNeeds } from "@/types/api";

export type ParsedNeedField =
  | "budget"
  | "targetUseCase"
  | "appearancePreference"
  | "experienceLevel"
  | "cpuBrandPreference"
  | "gpuBrandPreference";

export interface ParsedNeedResult {
  parsedNeeds: CustomerNeeds;
  matchedFields: ParsedNeedField[];
}

const USE_CASE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b2k\b|\b1440p\b/, value: "2K gaming" },
  { pattern: /\b4k\b/, value: "4K gaming" },
  { pattern: /\bgaming\b|\bgames\b/, value: "Gaming" },
  { pattern: /\bvideo editing\b|\bediting\b|\bpremiere\b|\bdavinci\b/, value: "Video editing" },
  { pattern: /\bstreaming\b|\bstream\b/, value: "Streaming" },
  { pattern: /\bai\b|\bmachine learning\b|\bllm\b/, value: "AI workloads" },
  { pattern: /\b3d\b|\brendering\b|\bblender\b|\bmaya\b/, value: "3D rendering" },
];

function parseBudget(message: string) {
  const underMatch = message.match(/\b(?:under|below|less than|max(?:imum)?|budget)\s*\$?\s*(\d{3,5})\b/i);

  if (underMatch) {
    return Number.parseInt(underMatch[1], 10);
  }

  const currencyMatch = message.match(/\$\s*(\d{3,5})\b/);

  if (currencyMatch) {
    return Number.parseInt(currencyMatch[1], 10);
  }

  const aroundMatch = message.match(/\b(\d{4,5})\b/);

  if (aroundMatch) {
    return Number.parseInt(aroundMatch[1], 10);
  }

  return undefined;
}

function parseUseCases(message: string) {
  const normalized = message.toLowerCase();
  const matches = USE_CASE_PATTERNS
    .filter((entry) => entry.pattern.test(normalized))
    .map((entry) => entry.value);

  return Array.from(new Set(matches));
}

function parseAppearancePreference(message: string): CustomerNeeds["appearancePreference"] {
  if (/\brgb\b|\bled\b|\bcolorful\b|\blighting\b/i.test(message)) {
    return "rgb";
  }

  if (/\bwhite\b/i.test(message)) {
    return "white";
  }

  if (/\bblack\b|\bdark\b/i.test(message)) {
    return "black";
  }

  return undefined;
}

function parseExperienceLevel(message: string): CustomerNeeds["experienceLevel"] {
  if (/\bbeginner\b|\bnew to pc\b|\bfirst pc\b|\bfirst build\b|\bnot technical\b/i.test(message)) {
    return "beginner";
  }

  if (/\bexpert\b|\benthusiast\b|\badvanced\b|\bpower user\b/i.test(message)) {
    return "expert";
  }

  if (/\bintermediate\b|\bsome experience\b/i.test(message)) {
    return "intermediate";
  }

  return undefined;
}

function parseCpuBrandPreference(message: string): CustomerNeeds["cpuBrandPreference"] {
  if (/\bintel\b/i.test(message)) {
    return "intel";
  }

  if (/\bamd\b/i.test(message)) {
    return "amd";
  }

  return undefined;
}

function parseGpuBrandPreference(message: string): CustomerNeeds["gpuBrandPreference"] {
  if (/\bnvidia\b|\brtx\b|\bgeforce\b/i.test(message)) {
    return "nvidia";
  }

  if (/\bradeon\b/i.test(message)) {
    return "amd";
  }

  return undefined;
}

export function parseCustomerNeeds(message: string): ParsedNeedResult {
  const parsedNeeds: CustomerNeeds = {};
  const matchedFields: ParsedNeedField[] = [];
  const budget = parseBudget(message);
  const targetUseCase = parseUseCases(message);
  const appearancePreference = parseAppearancePreference(message);
  const experienceLevel = parseExperienceLevel(message);
  const cpuBrandPreference = parseCpuBrandPreference(message);
  const gpuBrandPreference = parseGpuBrandPreference(message);

  if (budget) {
    parsedNeeds.budget = budget;
    matchedFields.push("budget");
  }

  if (targetUseCase.length > 0) {
    parsedNeeds.targetUseCase = targetUseCase;
    matchedFields.push("targetUseCase");
  }

  if (appearancePreference) {
    parsedNeeds.appearancePreference = appearancePreference;
    matchedFields.push("appearancePreference");
  }

  if (experienceLevel) {
    parsedNeeds.experienceLevel = experienceLevel;
    matchedFields.push("experienceLevel");
  }

  if (cpuBrandPreference) {
    parsedNeeds.cpuBrandPreference = cpuBrandPreference;
    matchedFields.push("cpuBrandPreference");
  }

  if (gpuBrandPreference) {
    parsedNeeds.gpuBrandPreference = gpuBrandPreference;
    matchedFields.push("gpuBrandPreference");
  }

  return {
    parsedNeeds,
    matchedFields,
  };
}

export function mergeCustomerNeeds(current: CustomerNeeds, incoming: CustomerNeeds): CustomerNeeds {
  return {
    ...current,
    ...incoming,
    targetUseCase:
      incoming.targetUseCase && incoming.targetUseCase.length > 0
        ? Array.from(new Set([...(current.targetUseCase ?? []), ...incoming.targetUseCase]))
        : current.targetUseCase,
  };
}

export function hasUsefulNeedInfo(parsed: ParsedNeedResult) {
  return parsed.matchedFields.length > 0;
}
