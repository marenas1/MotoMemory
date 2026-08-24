import type {
  MaintenanceDefinition,
  MaintenanceRecord,
  MaintenanceOutlookItem,
} from "@/lib/domain/types";

function roundToSupportedPrecision(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateMaintenanceOutlook(
  currentMileage: number | null | undefined,
  definition: MaintenanceDefinition,
  records: MaintenanceRecord[] = [],
): MaintenanceOutlookItem {
  const base = {
    definitionId: definition.id,
    name: definition.name,
    currentMileage:
      typeof currentMileage === "number" && Number.isFinite(currentMileage) && currentMileage >= 0
        ? currentMileage
        : null,
    intervalValue: definition.intervalValue ?? definition.intervalMiles,
    intervalUnit: definition.intervalUnit ?? "mi",
    lastServiceRecordId: null,
    lastServiceMileage: null,
    source: definition.source,
    sourceManualId: definition.sourceManualId ?? null,
    sourcePageStart: definition.sourcePageStart ?? null,
    sourcePageEnd: definition.sourcePageEnd ?? null,
    sourcePrintedPageLabel: definition.sourcePrintedPageLabel ?? null,
    rawOcrContext: definition.rawOcrContext ?? null,
    sourceHref: definition.sourceHref ?? null,
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

  if (
    typeof definition.id !== "string" ||
    definition.id.trim() === "" ||
    typeof definition.motorcycleId !== "string" ||
    definition.motorcycleId.trim() === ""
  ) {
    return {
      ...base,
      intervalMiles: roundToSupportedPrecision(definition.intervalMiles),
      dueMileage: null,
      remainingMiles: null,
      status: "unknown",
    };
  }

  const intervalMiles = roundToSupportedPrecision(definition.intervalMiles);
  if (!Number.isFinite(intervalMiles) || intervalMiles <= 0) {
    return {
      ...base,
      intervalMiles: null,
      dueMileage: null,
      remainingMiles: null,
      status: "unknown",
    };
  }

  const linkedRecords = records.filter(
    (record) => record.definitionId === definition.id,
  );

  if (
    linkedRecords.some(
      (record) => record.motorcycleId !== definition.motorcycleId,
    ) ||
    linkedRecords.some(
      (record) =>
        !Number.isFinite(record.performedMileage) ||
        record.performedMileage < 0,
    ) ||
    linkedRecords.some((record) => record.performedMileage > currentMileage)
  ) {
    return {
      ...base,
      intervalMiles,
      dueMileage: null,
      remainingMiles: null,
      status: "unknown",
    };
  }

  const applicableRecords = linkedRecords.filter(
    (record) => record.performedMileage <= currentMileage,
  );

  if (applicableRecords.length === 0) {
    return {
      ...base,
      intervalMiles,
      dueMileage: null,
      remainingMiles: null,
      status: "not_recorded",
    };
  }

  const latestRecord = [...applicableRecords].sort((left, right) => {
    if (left.performedMileage !== right.performedMileage) {
      return right.performedMileage - left.performedMileage;
    }

    if (right.id === left.id) return 0;
    return right.id > left.id ? 1 : -1;
  })[0];

  if (!latestRecord) {
    return {
      ...base,
      intervalMiles,
      dueMileage: null,
      remainingMiles: null,
      status: "unknown",
    };
  }

  const dueMileage = roundToSupportedPrecision(
    latestRecord.performedMileage + intervalMiles,
  );
  if (!Number.isFinite(dueMileage)) {
    return {
      ...base,
      intervalMiles,
      dueMileage: null,
      remainingMiles: null,
      status: "unknown",
    };
  }

  const remainingMiles = roundToSupportedPrecision(dueMileage - currentMileage);

  return {
    ...base,
    intervalMiles,
    lastServiceRecordId: latestRecord.id,
    lastServiceMileage: latestRecord.performedMileage,
    dueMileage,
    remainingMiles,
    status:
      remainingMiles === 0
        ? "due"
        : remainingMiles > 0
          ? "upcoming"
          : "overdue",
  };
}

export function calculateMaintenanceOutlooks(
  currentMileage: number | null | undefined,
  definitions: MaintenanceDefinition[],
  records: MaintenanceRecord[] = [],
): MaintenanceOutlookItem[] {
  return definitions.map((definition) =>
    calculateMaintenanceOutlook(currentMileage, definition, records),
  );
}
