import type {
  MaintenanceIntervalUnit,
} from "@/lib/domain/types";
import type {
  ManualMaintenanceFactInput,
  ManualPageRecord,
} from "@/lib/manual/manual-types";
import { ManualValidationError } from "@/lib/manual/manual-validation";

const INTERVAL_PATTERN =
  /\b([0-9][0-9,]*(?:\.[0-9]+)?)\s*(miles?|mi\.?|kilometers?|km)\b/gi;
const ACTION_PATTERN =
  /\b(?:adjust(?:ed|ment)?|change(?:d|s)?|check(?:ed|s)?|clean(?:ed|ing)?|inspect(?:ed|ion)?|install(?:ed|s)?|lubricat(?:e|ed|ing)|maintain(?:ed|s)?|refill(?:ed|s)?|remove(?:d|s)?|repair(?:ed|s)?|replace(?:d|s)?|service(?:d|s)?|tighten(?:ed|s)?)\b/gi;
const TASK_HINT_PATTERN =
  /\b(?:adjust|battery|brake|cable|chain|check|clean(?:er|ing)?|change|clutch|drive|filter|inspect|lubricat|maint|oil|replace|service|spark|steering|tire|valve)\b/i;
const MAX_FACT_NAME_LENGTH = 200;
const MAX_FACT_NOTE_LENGTH = 2_000;
const TASK_STOP_WORDS = new Set([
  "a",
  "after",
  "an",
  "and",
  "are",
  "at",
  "be",
  "each",
  "every",
  "for",
  "from",
  "initial",
  "is",
  "of",
  "per",
  "should",
  "the",
  "to",
  "within",
  "with",
]);

export interface NormalizedMaintenanceFactCorrection {
  name: string;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
  intervalMiles: number;
  notes: string | null;
}

function parseNumber(value: string): number {
  return Number(value.replaceAll(",", ""));
}

export function intervalToMiles(
  intervalValue: number,
  intervalUnit: MaintenanceIntervalUnit,
): number {
  return intervalUnit === "km" ? intervalValue * 0.621371192 : intervalValue;
}

export function normalizeMaintenanceFactCorrection(input: {
  name: string;
  intervalValue: number;
  intervalUnit: MaintenanceIntervalUnit;
  notes?: string | null;
}): NormalizedMaintenanceFactCorrection {
  const name = input.name.trim();
  if (!name || name.length > MAX_FACT_NAME_LENGTH) {
    throw new ManualValidationError(
      `Maintenance task must be between 1 and ${MAX_FACT_NAME_LENGTH} characters.`,
    );
  }

  if (
    !Number.isFinite(input.intervalValue) ||
    input.intervalValue <= 0 ||
    input.intervalValue > 1_000_000
  ) {
    throw new ManualValidationError(
      "Maintenance interval must be greater than zero and no more than 1,000,000.",
    );
  }

  if (input.intervalUnit !== "mi" && input.intervalUnit !== "km") {
    throw new ManualValidationError("Maintenance interval unit must be mi or km.");
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > MAX_FACT_NOTE_LENGTH) {
    throw new ManualValidationError(
      `Maintenance notes must be no more than ${MAX_FACT_NOTE_LENGTH} characters.`,
    );
  }

  return {
    name,
    intervalValue: input.intervalValue,
    intervalUnit: input.intervalUnit,
    intervalMiles: intervalToMiles(input.intervalValue, input.intervalUnit),
    notes,
  };
}

function normalizeLine(line: string): string {
  return line.replaceAll(/\s+/g, " ").trim();
}

function cleanTask(value: string): string {
  return value
    .replace(/^[\s|:–—,.;()[\]{}-]+|[\s|:–—,.;()[\]{}-]+$/g, "")
    .replace(/\s+\b(?:at|before|by|from|in|on|with)\b[\s\S]*$/i, "")
    .replace(/\b(?:after|at|each|every|for|initial|per|within|with)\s*$/i, "")
    .replace(/\b(?:are|be|is|should)(?:\s+(?:are|be|is|should))*\s*$/i, "")
    .replace(/\b(?:and|to)\s*$/i, "")
    .replace(
      /^(?:and\s+)?(?:adjust|change|check|clean|inspect|install|lubricate|maintain|refill|remove|repair|replace|service|tighten)\s+/i,
      "",
    )
    .replace(/^(?:a|an|and|the|with)\s+/i, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function canonicalAction(value: string): string {
  const action = value.toLowerCase();
  let label: string;

  if (action.startsWith("adjust")) label = "adjust";
  else if (action.startsWith("change")) label = "change";
  else if (action.startsWith("check")) label = "check";
  else if (action.startsWith("clean")) label = "clean";
  else if (action.startsWith("inspect")) label = "inspect";
  else if (action.startsWith("install")) label = "install";
  else if (action.startsWith("lubricat")) label = "lubricate";
  else if (action.startsWith("maintain")) label = "maintain";
  else if (action.startsWith("refill")) label = "refill";
  else if (action.startsWith("remove")) label = "remove";
  else if (action.startsWith("repair")) label = "repair";
  else if (action.startsWith("replace")) label = "replace";
  else if (action.startsWith("service")) label = "service";
  else label = "tighten";

  return /^[A-Z]/.test(value) ? `${label[0]?.toUpperCase()}${label.slice(1)}` : label;
}

function cleanSubject(value: string): string {
  return cleanTask(value)
    .replace(/^[\s|:–—,.;()[\]{}-]+|[\s|:–—,.;()[\]{}-]+$/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function currentLinePart(value: string): string {
  return value.slice(value.lastIndexOf("\n") + 1);
}

function isMeaningfulSubject(subject: string): boolean {
  if (
    subject.length < 3 ||
    subject.length > MAX_FACT_NAME_LENGTH ||
    /\d|[|=“”"]|\b(?:miles?|mi|kilometers?|km)\b/i.test(subject)
  ) {
    return false;
  }

  const withoutActions = subject
    .replace(ACTION_PATTERN, " ")
    .split(/\s+/)
    .filter((word) => !TASK_STOP_WORDS.has(word.toLowerCase()))
    .join(" ");

  return TASK_HINT_PATTERN.test(withoutActions);
}

interface TaskMatch {
  name: string;
  subject: string;
}

interface ActionCandidate {
  action: string;
  subject: string;
  actionFirst: boolean;
}

function meaningfulTaskCandidate(
  candidates: ActionCandidate[],
  previousSubject: string | null,
): TaskMatch | null {
  for (const candidate of candidates) {
    const subject = cleanSubject(candidate.subject);
    if (!isMeaningfulSubject(subject)) {
      continue;
    }

    return {
      name: candidate.actionFirst
        ? `${candidate.action} ${subject}`
        : `${subject} ${candidate.action}`,
      subject,
    };
  }

  if (previousSubject && candidates[0] && isMeaningfulSubject(previousSubject)) {
    return {
      name: `${previousSubject} ${candidates[0].action}`,
      subject: previousSubject,
    };
  }

  return null;
}

function taskFromMatch(
  line: string,
  matchIndex: number,
  matchLength: number,
  previousSubject: string | null,
): TaskMatch | null {
  const candidates: ActionCandidate[] = [];
  const beforeMatch = line.slice(0, matchIndex);
  const afterMatch = line.slice(matchIndex + matchLength);

  const actionsBefore = [...beforeMatch.matchAll(ACTION_PATTERN)];
  const actionBefore = actionsBefore.at(-1);
  if (actionBefore?.index !== undefined) {
    const actionEnd = actionBefore.index + actionBefore[0].length;
    candidates.push(
      {
        action: canonicalAction(actionBefore[0]),
        subject: beforeMatch.slice(actionEnd),
        actionFirst: true,
      },
      {
        action: canonicalAction(actionBefore[0]),
        subject: currentLinePart(beforeMatch.slice(0, actionBefore.index)),
        actionFirst: false,
      },
    );
  }

  const actionsAfter = [...afterMatch.matchAll(ACTION_PATTERN)];
  const actionAfter = actionsAfter[0];
  if (actionAfter?.index !== undefined) {
    const actionIndex = matchIndex + matchLength + actionAfter.index;
    const intervalsBeforeAction = [
      ...line.slice(0, actionIndex).matchAll(INTERVAL_PATTERN),
    ];
    const previousInterval = intervalsBeforeAction.at(-1);
    const previousIntervalEnd = previousInterval?.index === undefined
      ? matchIndex + matchLength
      : previousInterval.index + previousInterval[0].length;
    const actionEnd = actionIndex + actionAfter[0].length;

    candidates.push(
      {
        action: canonicalAction(actionAfter[0]),
        subject: line.slice(previousIntervalEnd, actionIndex),
        actionFirst: false,
      },
      {
        action: canonicalAction(actionAfter[0]),
        subject: line.slice(actionEnd),
        actionFirst: true,
      },
    );
  }

  if (previousSubject && candidates[0]) {
    candidates.push({
      action: candidates[0].action,
      subject: previousSubject,
      actionFirst: false,
    });
  }

  return meaningfulTaskCandidate(candidates, previousSubject);
}

function contextWindow(lines: string[], lineIndex: number): {
  text: string;
  currentLineOffset: number;
} {
  const start = Math.max(0, lineIndex - 2);
  const beforeCurrent = lines.slice(start, lineIndex).join("\n");
  return {
    text: lines.slice(start, Math.min(lines.length, lineIndex + 2)).join("\n"),
    currentLineOffset: beforeCurrent ? beforeCurrent.length + 1 : 0,
  };
}

function appendFact(
  facts: ManualMaintenanceFactInput[],
  fact: ManualMaintenanceFactInput,
  seenTasks: Map<string, number>,
): void {
  const taskKey = fact.name.toLocaleLowerCase();
  const existingIndex = seenTasks.get(taskKey);
  if (existingIndex === undefined) {
    seenTasks.set(taskKey, facts.length);
    facts.push(fact);
    return;
  }

  const existing = facts[existingIndex];
  if (existing && fact.intervalMiles > existing.intervalMiles) {
    facts[existingIndex] = fact;
  }
}

function processLineIntervals(
  page: ManualPageRecord,
  lines: string[],
  lineIndex: number,
  previousSubject: string | null,
  facts: ManualMaintenanceFactInput[],
  seenTasks: Map<string, number>,
): string | null {
  const line = lines[lineIndex] ?? "";
  const matches = [...line.matchAll(INTERVAL_PATTERN)];
  if (matches.length === 0) {
    return previousSubject;
  }

  const hasMilesInterval = matches.some((match) =>
    /^(?:miles?|mi\.?)$/i.test(match[2] ?? ""),
  );
  const window = contextWindow(lines, lineIndex);
  let currentSubject = previousSubject;

  for (const match of matches) {
    const rawValue = match[1];
    const rawUnit = match[2];
    if (!rawValue || !rawUnit || match.index === undefined) {
      continue;
    }

    const intervalValue = parseNumber(rawValue);
    const intervalUnit = unitFromLabel(rawUnit);
    if (intervalUnit === "km" && hasMilesInterval) {
      continue;
    }

    const task = taskFromMatch(
      window.text,
      window.currentLineOffset + match.index,
      match[0].length,
      currentSubject,
    );
    if (!task || !Number.isFinite(intervalValue) || intervalValue <= 0) {
      continue;
    }

    currentSubject = task.subject;
    appendFact(
      facts,
      {
        name: task.name,
        intervalValue,
        intervalUnit,
        intervalMiles: intervalToMiles(intervalValue, intervalUnit),
        notes: null,
        sourceManualId: page.manualId,
        sourcePageStart: page.pageNumber,
        sourcePageEnd: page.pageNumber,
        sourcePrintedPageLabel: page.printedPageLabel,
        rawOcrContext: contextFor(lines, lineIndex),
      },
      seenTasks,
    );
  }

  return currentSubject;
}

function contextFor(lines: string[], lineIndex: number): string {
  return lines
    .slice(Math.max(0, lineIndex - 2), Math.min(lines.length, lineIndex + 3))
    .join("\n")
    .slice(0, MAX_FACT_NOTE_LENGTH);
}

function unitFromLabel(label: string): MaintenanceIntervalUnit {
  return label.toLowerCase().startsWith("k") ? "km" : "mi";
}

/**
 * Extracts only explicit task/interval pairs from OCR. It deliberately does
 * not infer a task from an isolated number: the rider can inspect and correct
 * the captured fact, but an unsupported number must not replace the fallback.
 */
export function extractManualMaintenanceFacts(
  manualId: string,
  motorcycleId: string,
  pages: ManualPageRecord[],
): ManualMaintenanceFactInput[] {
  const facts: ManualMaintenanceFactInput[] = [];
  const seenTasks = new Map<string, number>();

  for (const page of pages) {
    if (page.extractionStatus !== "available" || !page.extractedText?.trim()) {
      continue;
    }

    const lines = page.extractedText.split(/\r?\n/).map(normalizeLine).filter(Boolean);
    let previousSubject: string | null = null;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      previousSubject = processLineIntervals(
        { ...page, manualId },
        lines,
        lineIndex,
        previousSubject,
        facts,
        seenTasks,
      );
    }
  }

  return facts;
}
