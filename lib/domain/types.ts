/**
 * Shared domain contracts for the motorcycle state and its maintenance outlook.
 *
 * These types describe application data, not database rows. Database adapters
 * are responsible for translating their persistence representation into these
 * contracts before returning data to the rest of the application.
 */

export type MileageUnit = "mi";

export type MaintenanceIntervalUnit = "mi" | "km";

export type MaintenanceFactOrigin = "ocr" | "rider_corrected";

export type MotorcycleVisualState = "emoji" | "image";

export type MileageUpdateOrigin = "manual";

export type MaintenanceDefinitionStatus = "active";

export type MaintenanceOutlookStatus = "upcoming" | "due" | "unknown";

export interface MotorcycleState {
  id: string;
  make: string;
  model: string;
  modelYear: number;
  currentMileage: number;
  mileageUnit: MileageUnit;
  visualState: MotorcycleVisualState;
  visualEmoji: string | null;
  lastMileageUpdateAt: string | null;
  lastMileageUpdateOrigin: MileageUpdateOrigin | null;
  updatedAt: string;
}

export interface MaintenanceDefinition {
  id: string;
  motorcycleId: string;
  name: string;
  intervalValue?: number;
  intervalUnit?: MaintenanceIntervalUnit;
  intervalMiles: number;
  dueWindowMiles: number;
  status: MaintenanceDefinitionStatus;
  source: string;
  notes: string | null;
  sourceManualId?: string | null;
  sourcePageStart?: number | null;
  sourcePageEnd?: number | null;
  sourcePrintedPageLabel?: string | null;
  rawOcrContext?: string | null;
  origin?: MaintenanceFactOrigin | null;
  correctedAt?: string | null;
  sourceHref?: string | null;
}

export interface MileageUpdate {
  id: string;
  motorcycleId: string;
  previousMileage: number;
  acceptedMileage: number;
  recordedAt: string;
  origin: MileageUpdateOrigin;
}

export interface MaintenanceOutlookItem {
  definitionId: string;
  name: string;
  intervalValue?: number | null;
  intervalUnit?: MaintenanceIntervalUnit | null;
  intervalMiles: number | null;
  dueMileage: number | null;
  remainingMiles: number | null;
  status: MaintenanceOutlookStatus;
  source: string | null;
  sourceManualId?: string | null;
  sourcePageStart?: number | null;
  sourcePageEnd?: number | null;
  sourcePrintedPageLabel?: string | null;
  sourceHref?: string | null;
}

export interface MotorcycleOverview {
  motorcycle: MotorcycleState;
  maintenanceOutlook: MaintenanceOutlookItem[];
}
