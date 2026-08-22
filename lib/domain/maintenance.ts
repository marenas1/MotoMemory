import type {
  MaintenanceDefinition,
  MaintenanceOutlookItem,
} from "@/lib/domain/types";

function roundToSupportedPrecision(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateMaintenanceOutlook(
  currentMileage: number | null | undefined,
  definition: MaintenanceDefinition,
): MaintenanceOutlookItem {
  const base = {
    definitionId: definition.id,
    name: definition.name,
    source: definition.source,
  };

  if (
    currentMileage === null ||
    currentMileage === undefined ||
    !Number.isFinite(currentMileage) ||
    currentMileage < 0 ||
    !Number.isFinite(definition.intervalMiles) ||
    definition.intervalMiles <= 0
  ) {
    return {
      ...base,
      intervalMiles: null,
      dueMileage: null,
      remainingMiles: null,
      status: "unknown",
    };
  }

  const intervalMiles = roundToSupportedPrecision(definition.intervalMiles);
  const dueMileage = roundToSupportedPrecision(
    Math.max(
      intervalMiles,
      Math.ceil(currentMileage / intervalMiles) * intervalMiles,
    ),
  );
  const remainingMiles = roundToSupportedPrecision(dueMileage - currentMileage);

  return {
    ...base,
    intervalMiles,
    dueMileage,
    remainingMiles,
    status: remainingMiles === 0 ? "due" : "upcoming",
  };
}

export function calculateMaintenanceOutlooks(
  currentMileage: number | null | undefined,
  definitions: MaintenanceDefinition[],
): MaintenanceOutlookItem[] {
  return definitions.map((definition) =>
    calculateMaintenanceOutlook(currentMileage, definition),
  );
}
