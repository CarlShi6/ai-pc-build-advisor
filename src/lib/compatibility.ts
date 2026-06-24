import type { Build, CompatibilityWarning } from "@/types/build";
import type { Part } from "@/types/parts";

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
  return value ? value.split(",").map((item) => item.trim()) : [];
}

export function calculateBuildTotal(parts: Part[]) {
  return parts.reduce((total, part) => total + (part.owned ? 0 : part.price), 0);
}

export function estimateSystemPower(build: Build) {
  const cpuPower = getNumberSpec(getPart(build, "cpu"), "tdpW") ?? 0;
  const gpuPower = getNumberSpec(getPart(build, "gpu"), "powerDrawW") ?? 0;
  return cpuPower + gpuPower + 120;
}

export function evaluateCompatibility(build: Build): CompatibilityWarning[] {
  const warnings: CompatibilityWarning[] = [];
  const cpu = getPart(build, "cpu");
  const gpu = getPart(build, "gpu");
  const motherboard = getPart(build, "motherboard");
  const ram = getPart(build, "ram");
  const psu = getPart(build, "psu");
  const pcCase = getPart(build, "case");
  const cooler = getPart(build, "cooler");

  if (cpu && motherboard) {
    const cpuSocket = getStringSpec(cpu, "socket");
    const boardSocket = getStringSpec(motherboard, "socket");

    if (cpuSocket && boardSocket && cpuSocket !== boardSocket) {
      warnings.push({
        id: "cpu-motherboard-socket",
        severity: "error",
        message: `${cpu.displayName} uses ${cpuSocket}, but ${motherboard.displayName} uses ${boardSocket}.`,
        affectedPartIds: [cpu.id, motherboard.id],
        suggestedFix: "Choose a motherboard with the same CPU socket, or swap to a matching CPU.",
      });
    }
  }

  if (motherboard && ram) {
    const boardRamType = getStringSpec(motherboard, "ramType");
    const ramType = getStringSpec(ram, "ramType");

    if (boardRamType && ramType && boardRamType !== ramType) {
      warnings.push({
        id: "motherboard-ram-type",
        severity: "error",
        message: `${motherboard.displayName} supports ${boardRamType}, but ${ram.displayName} is ${ramType}.`,
        affectedPartIds: [motherboard.id, ram.id],
        suggestedFix: "Swap the RAM kit or motherboard so both use the same memory type.",
      });
    }
  }

  if (psu) {
    const psuWattage = getNumberSpec(psu, "wattageW") ?? 0;
    const estimatedRequirement = Math.ceil(estimateSystemPower(build));

    if (psuWattage < estimatedRequirement) {
      warnings.push({
        id: "psu-headroom",
        severity: "error",
        message: `${psu.displayName} may be undersized. Estimated recommended headroom is ${estimatedRequirement}W.`,
        affectedPartIds: [psu.id],
        suggestedFix: "Use a higher-wattage PSU before finalizing this build.",
      });
    } else if (psuWattage < estimatedRequirement + 50) {
      warnings.push({
        id: "psu-headroom-tight",
        severity: "warning",
        message: `${psu.displayName} is compatible, but power headroom is tighter than ideal for future upgrades.`,
        affectedPartIds: [psu.id],
        suggestedFix: "Consider a 1000W PSU if you may upgrade the GPU later.",
      });
    }
  }

  if (gpu && pcCase) {
    const gpuLength = getNumberSpec(gpu, "lengthMm");
    const caseClearance = getNumberSpec(pcCase, "gpuClearanceMm");

    if (gpuLength && caseClearance && gpuLength > caseClearance) {
      warnings.push({
        id: "gpu-case-clearance",
        severity: "error",
        message: `${gpu.displayName} is ${gpuLength}mm long, exceeding the case clearance of ${caseClearance}mm.`,
        affectedPartIds: [gpu.id, pcCase.id],
        suggestedFix: "Choose a shorter GPU or a roomier case.",
      });
    }
  }

  if (motherboard && pcCase) {
    const boardFormFactor = getStringSpec(motherboard, "formFactor");
    const supportedFormFactors = splitListSpec(pcCase, "formFactorSupport");

    if (boardFormFactor && supportedFormFactors.length > 0 && !supportedFormFactors.includes(boardFormFactor)) {
      warnings.push({
        id: "case-motherboard-form-factor",
        severity: "error",
        message: `${pcCase.displayName} does not list support for ${boardFormFactor} motherboards.`,
        affectedPartIds: [motherboard.id, pcCase.id],
        suggestedFix: "Pick a case that supports the current motherboard form factor.",
      });
    }
  }

  if (cooler && pcCase) {
    const coolerType = getStringSpec(cooler, "coolerType");

    if (coolerType === "air") {
      const coolerHeight = getNumberSpec(cooler, "heightMm");
      const caseClearance = getNumberSpec(pcCase, "coolerClearanceMm");

      if (coolerHeight && caseClearance && coolerHeight > caseClearance) {
        warnings.push({
          id: "air-cooler-height",
          severity: "error",
          message: `${cooler.displayName} is taller than the case CPU cooler clearance.`,
          affectedPartIds: [cooler.id, pcCase.id],
          suggestedFix: "Use a shorter air cooler or a case with more CPU cooler clearance.",
        });
      }
    }

    if (coolerType === "aio") {
      const radiatorSize = getNumberSpec(cooler, "radiatorMm");
      const radiatorSupport = getNumberSpec(pcCase, "radiatorSupportMm");

      if (radiatorSize && radiatorSupport && radiatorSize > radiatorSupport) {
        warnings.push({
          id: "aio-radiator-fit",
          severity: "error",
          message: `${cooler.displayName} needs a ${radiatorSize}mm mount, but the case supports up to ${radiatorSupport}mm.`,
          affectedPartIds: [cooler.id, pcCase.id],
          suggestedFix: "Choose a smaller AIO or a case with larger radiator support.",
        });
      }
    }
  }

  const gpuRecommendedPsu = getNumberSpec(gpu, "recommendedPsuW");
  const psuWattage = getNumberSpec(psu, "wattageW");

  if (gpu && psu && gpuRecommendedPsu && psuWattage && psuWattage < gpuRecommendedPsu) {
    warnings.push({
      id: "gpu-psu-vendor-guidance",
      severity: "warning",
      message: `${gpu.displayName} typically pairs best with at least a ${gpuRecommendedPsu}W PSU.`,
      affectedPartIds: [gpu.id, psu.id],
      suggestedFix: "Consider a stronger PSU for vendor-recommended headroom.",
    });
  }

  return warnings;
}

export function deriveCompatibilityStatus(warnings: CompatibilityWarning[]): Build["compatibilityStatus"] {
  if (warnings.some((warning) => warning.severity === "error")) {
    return "fail";
  }

  if (warnings.length > 0) {
    return "warning";
  }

  return "pass";
}
