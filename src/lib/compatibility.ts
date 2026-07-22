import type {
  Build,
  BuildConfidenceScore,
  CompatibilityRuleResult,
  CompatibilitySeverity,
  CompatibilityWarning,
} from "@/types/build";
import type { Part } from "@/types/parts";

type RuleContext = {
  build: Build;
  cpu?: Part;
  gpu?: Part;
  motherboard?: Part;
  ram?: Part;
  psu?: Part;
  pcCase?: Part;
  cooler?: Part;
};

type CompatibilityRule = {
  id: string;
  label: string;
  checkedPartCategories: string[];
  evaluate: (context: RuleContext) => Omit<CompatibilityRuleResult, "id" | "label" | "checkedPartCategories">;
};

function getPart(build: Build, category: Part["category"]) {
  return build.parts.find((part) => part.category === category);
}

function getStringSpec(part: Part | undefined, key: string) {
  const value = part?.specs[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberSpec(part: Part | undefined, key: string) {
  const value = part?.specs[key];
  return typeof value === "number" ? value : undefined;
}

function splitListSpec(part: Part | undefined, key: string) {
  const value = getStringSpec(part, key);
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function result(
  severity: CompatibilitySeverity,
  message: string,
  affectedPartIds: string[],
  suggestedFix?: string,
) {
  return { severity, message, affectedPartIds, suggestedFix };
}

function notEnoughData(message: string, affectedPartIds: string[]) {
  return result("warning", message, affectedPartIds, "Verify the missing fit data before purchasing.");
}

export function calculateBuildTotal(parts: Part[]) {
  return parts.reduce((total, part) => total + (part.owned ? 0 : part.price), 0);
}

export function estimateSystemPower(build: Build) {
  const cpuPower = getNumberSpec(getPart(build, "cpu"), "tdpW") ?? 0;
  const gpuPower = getNumberSpec(getPart(build, "gpu"), "powerDrawW") ?? 0;
  return cpuPower + gpuPower + 120;
}

const compatibilityRules: CompatibilityRule[] = [
  {
    id: "cpu-motherboard-socket",
    label: "CPU socket matches motherboard",
    checkedPartCategories: ["cpu", "motherboard"],
    evaluate: ({ cpu, motherboard }) => {
      if (!cpu || !motherboard) {
        return notEnoughData("CPU and motherboard are required for socket validation.", [
          cpu?.id,
          motherboard?.id,
        ].filter(Boolean) as string[]);
      }

      const cpuSocket = getStringSpec(cpu, "socket");
      const boardSocket = getStringSpec(motherboard, "socket");

      if (!cpuSocket || !boardSocket) {
        return notEnoughData("CPU or motherboard socket data is missing.", [cpu.id, motherboard.id]);
      }

      if (normalizeValue(cpuSocket) !== normalizeValue(boardSocket)) {
        return result(
          "fail",
          `${cpu.displayName} uses ${cpuSocket}, but ${motherboard.displayName} uses ${boardSocket}.`,
          [cpu.id, motherboard.id],
          "Choose a motherboard with the same CPU socket, or swap to a matching CPU.",
        );
      }

      return result("pass", `${cpuSocket} socket match confirmed.`, [cpu.id, motherboard.id]);
    },
  },
  {
    id: "motherboard-ram-type",
    label: "RAM type matches motherboard",
    checkedPartCategories: ["motherboard", "ram"],
    evaluate: ({ motherboard, ram }) => {
      if (!motherboard || !ram) {
        return notEnoughData("Motherboard and RAM are required for memory validation.", [
          motherboard?.id,
          ram?.id,
        ].filter(Boolean) as string[]);
      }

      const boardRamType = getStringSpec(motherboard, "ramType");
      const ramType = getStringSpec(ram, "ramType");

      if (!boardRamType || !ramType) {
        return notEnoughData("Motherboard or RAM memory type data is missing.", [motherboard.id, ram.id]);
      }

      if (normalizeValue(boardRamType) !== normalizeValue(ramType)) {
        return result(
          "fail",
          `${motherboard.displayName} supports ${boardRamType}, but ${ram.displayName} is ${ramType}.`,
          [motherboard.id, ram.id],
          "Swap the RAM kit or motherboard so both use the same memory type.",
        );
      }

      return result("pass", `${ramType} memory compatibility confirmed.`, [motherboard.id, ram.id]);
    },
  },
  {
    id: "gpu-case-clearance",
    label: "GPU length fits case",
    checkedPartCategories: ["gpu", "case"],
    evaluate: ({ gpu, pcCase }) => {
      if (!gpu || !pcCase) {
        return notEnoughData("GPU and case are required for clearance validation.", [
          gpu?.id,
          pcCase?.id,
        ].filter(Boolean) as string[]);
      }

      const gpuLength = getNumberSpec(gpu, "lengthMm");
      const caseClearance = getNumberSpec(pcCase, "gpuClearanceMm");

      if (!gpuLength || !caseClearance) {
        return notEnoughData("GPU length or case clearance data is missing.", [gpu.id, pcCase.id]);
      }

      if (gpuLength > caseClearance) {
        return result(
          "fail",
          `${gpu.displayName} is ${gpuLength}mm long, exceeding the case clearance of ${caseClearance}mm.`,
          [gpu.id, pcCase.id],
          "Choose a shorter GPU or a roomier case.",
        );
      }

      const clearance = caseClearance - gpuLength;
      if (clearance < 20) {
        return result(
          "warning",
          `${gpu.displayName} fits, but only leaves ${clearance}mm of GPU clearance.`,
          [gpu.id, pcCase.id],
          "Consider a case with more GPU clearance for easier installation.",
        );
      }

      return result("pass", `${clearance}mm of GPU clearance remains.`, [gpu.id, pcCase.id]);
    },
  },
  {
    id: "case-motherboard-form-factor",
    label: "Motherboard form factor fits case",
    checkedPartCategories: ["motherboard", "case"],
    evaluate: ({ motherboard, pcCase }) => {
      if (!motherboard || !pcCase) {
        return notEnoughData("Motherboard and case are required for form factor validation.", [
          motherboard?.id,
          pcCase?.id,
        ].filter(Boolean) as string[]);
      }

      const boardFormFactor = getStringSpec(motherboard, "formFactor");
      const supportedFormFactors = splitListSpec(pcCase, "formFactorSupport");

      if (!boardFormFactor || supportedFormFactors.length === 0) {
        return notEnoughData("Motherboard form factor or case support data is missing.", [
          motherboard.id,
          pcCase.id,
        ]);
      }

      if (!supportedFormFactors.map(normalizeValue).includes(normalizeValue(boardFormFactor))) {
        return result(
          "fail",
          `${pcCase.displayName} does not list support for ${boardFormFactor} motherboards.`,
          [motherboard.id, pcCase.id],
          "Pick a case that supports the current motherboard form factor.",
        );
      }

      return result("pass", `${pcCase.displayName} supports ${boardFormFactor}.`, [
        motherboard.id,
        pcCase.id,
      ]);
    },
  },
  {
    id: "psu-headroom",
    label: "PSU wattage has headroom",
    checkedPartCategories: ["cpu", "gpu", "psu"],
    evaluate: ({ build, psu }) => {
      if (!psu) {
        return notEnoughData("A PSU is required for wattage validation.", []);
      }

      const psuWattage = getNumberSpec(psu, "wattageW");
      const estimatedRequirement = Math.ceil(estimateSystemPower(build));
      const idealHeadroom = estimatedRequirement + 100;

      if (!psuWattage) {
        return notEnoughData("PSU wattage data is missing.", [psu.id]);
      }

      if (psuWattage < estimatedRequirement) {
        return result(
          "fail",
          `${psu.displayName} may be undersized. Estimated system draw plus baseline overhead is ${estimatedRequirement}W.`,
          [psu.id],
          "Use a higher-wattage PSU before finalizing this build.",
        );
      }

      if (psuWattage < idealHeadroom) {
        return result(
          "warning",
          `${psu.displayName} passes the estimated ${estimatedRequirement}W requirement, but upgrade headroom is tight.`,
          [psu.id],
          "Consider a stronger PSU if future GPU upgrades are likely.",
        );
      }

      return result("pass", `${psu.displayName} has at least 100W of estimated headroom.`, [psu.id]);
    },
  },
  {
    id: "cooler-socket-support",
    label: "Cooler supports CPU socket",
    checkedPartCategories: ["cpu", "cooler"],
    evaluate: ({ cpu, cooler }) => {
      if (!cpu || !cooler) {
        return notEnoughData("CPU and cooler are required for socket support validation.", [
          cpu?.id,
          cooler?.id,
        ].filter(Boolean) as string[]);
      }

      const cpuSocket = getStringSpec(cpu, "socket");
      const socketSupport = splitListSpec(cooler, "socketSupport");

      if (!cpuSocket || socketSupport.length === 0) {
        return notEnoughData("CPU socket or cooler socket support data is missing.", [cpu.id, cooler.id]);
      }

      if (!socketSupport.map(normalizeValue).includes(normalizeValue(cpuSocket))) {
        return result(
          "fail",
          `${cooler.displayName} does not list support for ${cpuSocket}.`,
          [cpu.id, cooler.id],
          "Choose a cooler with explicit support for the CPU socket.",
        );
      }

      return result("pass", `${cooler.displayName} supports ${cpuSocket}.`, [cpu.id, cooler.id]);
    },
  },
  {
    id: "cooler-case-fit",
    label: "Cooler physically fits case",
    checkedPartCategories: ["cooler", "case"],
    evaluate: ({ cooler, pcCase }) => {
      if (!cooler || !pcCase) {
        return notEnoughData("Cooler and case are required for cooler fit validation.", [
          cooler?.id,
          pcCase?.id,
        ].filter(Boolean) as string[]);
      }

      const coolerType = getStringSpec(cooler, "coolerType");

      if (coolerType === "air") {
        const coolerHeight = getNumberSpec(cooler, "heightMm");
        const caseClearance = getNumberSpec(pcCase, "coolerClearanceMm");

        if (!coolerHeight || !caseClearance) {
          return notEnoughData("Air cooler height or case cooler clearance data is missing.", [
            cooler.id,
            pcCase.id,
          ]);
        }

        if (coolerHeight > caseClearance) {
          return result(
            "fail",
            `${cooler.displayName} is ${coolerHeight}mm tall, exceeding the case CPU cooler clearance of ${caseClearance}mm.`,
            [cooler.id, pcCase.id],
            "Use a shorter air cooler or a case with more CPU cooler clearance.",
          );
        }

        return result("pass", `${caseClearance - coolerHeight}mm of air cooler clearance remains.`, [
          cooler.id,
          pcCase.id,
        ]);
      }

      if (coolerType === "aio") {
        const radiatorSize = getNumberSpec(cooler, "radiatorMm");
        const radiatorSupport = getNumberSpec(pcCase, "radiatorSupportMm");

        if (!radiatorSize || !radiatorSupport) {
          return notEnoughData("AIO radiator size or case radiator support data is missing.", [
            cooler.id,
            pcCase.id,
          ]);
        }

        if (radiatorSize > radiatorSupport) {
          return result(
            "fail",
            `${cooler.displayName} needs a ${radiatorSize}mm mount, but the case supports up to ${radiatorSupport}mm.`,
            [cooler.id, pcCase.id],
            "Choose a smaller AIO or a case with larger radiator support.",
          );
        }

        return result("pass", `${pcCase.displayName} supports the ${radiatorSize}mm radiator.`, [
          cooler.id,
          pcCase.id,
        ]);
      }

      return notEnoughData("Cooler type data is missing.", [cooler.id, pcCase.id]);
    },
  },
  {
    id: "gpu-psu-vendor-guidance",
    label: "GPU vendor PSU guidance",
    checkedPartCategories: ["gpu", "psu"],
    evaluate: ({ gpu, psu }) => {
      if (!gpu || !psu) {
        return notEnoughData("GPU and PSU are required for vendor PSU guidance.", [
          gpu?.id,
          psu?.id,
        ].filter(Boolean) as string[]);
      }

      const gpuRecommendedPsu = getNumberSpec(gpu, "recommendedPsuW");
      const psuWattage = getNumberSpec(psu, "wattageW");

      if (!gpuRecommendedPsu || !psuWattage) {
        return notEnoughData("GPU recommended PSU or PSU wattage data is missing.", [gpu.id, psu.id]);
      }

      if (psuWattage < gpuRecommendedPsu) {
        return result(
          "warning",
          `${gpu.displayName} typically pairs best with at least a ${gpuRecommendedPsu}W PSU.`,
          [gpu.id, psu.id],
          "Consider a stronger PSU for vendor-recommended headroom.",
        );
      }

      return result("pass", `${psu.displayName} meets GPU vendor PSU guidance.`, [gpu.id, psu.id]);
    },
  },
];

function createRuleContext(build: Build): RuleContext {
  return {
    build,
    cpu: getPart(build, "cpu"),
    gpu: getPart(build, "gpu"),
    motherboard: getPart(build, "motherboard"),
    ram: getPart(build, "ram"),
    psu: getPart(build, "psu"),
    pcCase: getPart(build, "case"),
    cooler: getPart(build, "cooler"),
  };
}

export function evaluateCompatibilityRules(build: Build): CompatibilityRuleResult[] {
  const context = createRuleContext(build);

  return compatibilityRules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    checkedPartCategories: rule.checkedPartCategories,
    ...rule.evaluate(context),
  }));
}

export function getCompatibilityWarnings(checks: CompatibilityRuleResult[]): CompatibilityWarning[] {
  return checks
    .filter((check): check is CompatibilityRuleResult & { severity: CompatibilityWarning["severity"] } => check.severity !== "pass")
    .map((check) => ({
      id: check.id,
      severity: check.severity,
      message: check.message,
      affectedPartIds: check.affectedPartIds,
      suggestedFix: check.suggestedFix,
    }));
}

export function evaluateCompatibility(build: Build): CompatibilityWarning[] {
  return getCompatibilityWarnings(evaluateCompatibilityRules(build));
}

export function deriveCompatibilityStatus(
  warningsOrChecks: Array<CompatibilityWarning | CompatibilityRuleResult>,
): Build["compatibilityStatus"] {
  if (warningsOrChecks.some((item) => item.severity === "fail")) {
    return "fail";
  }

  if (warningsOrChecks.some((item) => item.severity === "warning")) {
    return "warning";
  }

  return "pass";
}

export function calculateBuildConfidenceScore(
  checks: CompatibilityRuleResult[],
): BuildConfidenceScore {
  const passCount = checks.filter((check) => check.severity === "pass").length;
  const warningCount = checks.filter((check) => check.severity === "warning").length;
  const failCount = checks.filter((check) => check.severity === "fail").length;
  const totalChecks = Math.max(checks.length, 1);
  const penalty = warningCount * 8 + failCount * 25;
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty - (totalChecks - passCount - warningCount - failCount) * 5)));
  const label = score >= 85 ? "High" : score >= 65 ? "Medium" : "Low";
  const summary =
    failCount > 0
      ? `${failCount} blocking compatibility issue${failCount === 1 ? "" : "s"} found.`
      : warningCount > 0
        ? `${warningCount} compatibility warning${warningCount === 1 ? "" : "s"} should be reviewed.`
        : "All deterministic compatibility rules passed.";

  return {
    score,
    label,
    summary,
    passCount,
    warningCount,
    failCount,
  };
}
