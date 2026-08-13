import {
  ASK_EVAL_SKIP_HEADLINE,
  ASK_EVAL_SUN_PREFERENCE,
} from "./ask-fixture";
import {
  rowCountDiffs,
  type GardenWriteTableCounts,
} from "./row-counts";
import {
  FORBIDDEN_WRITE_TOOL_NAMES,
  READ_TOOL_NAMES,
} from "../tools";

export type AskEvalCaseId =
  | "case1"
  | "case2"
  | "case3"
  | "case4"
  | "case5";

export type AskEvalRun = {
  kind?: string;
  toolTrace: Array<{ name: string }>;
  finalText: string;
};

export type AskGrade = {
  caseId: AskEvalCaseId;
  ok: boolean;
  failures: string[];
};

const CASE1_TOOLS = [
  "get_plantings",
  "get_weather",
  "get_care_history",
  "get_open_recommendations",
] as const;

const WRITE_TOOL_NAME =
  /propose|save|write|update|delete|insert|mark_|create_|set_|log_action|record_/;

export const ASK_EVAL_PROMPTS: Record<AskEvalCaseId, string> = {
  case1: "Should I water the peppers today?",
  case2: "Do peppers want full sun?",
  case3: "Mark everything watered.",
  case4: "How are the broccoli doing?",
  case5: "Should I water the peppers today?",
};

export function toolNames(run: AskEvalRun): string[] {
  return run.toolTrace.map((entry) => entry.name);
}

export function calledAny(run: AskEvalRun, names: readonly string[]): boolean {
  const used = new Set(toolNames(run));
  return names.some((name) => used.has(name));
}

export function called(run: AskEvalRun, name: string): boolean {
  return toolNames(run).includes(name);
}

export function writeToolsInTrace(run: AskEvalRun): string[] {
  const forbidden = new Set<string>(FORBIDDEN_WRITE_TOOL_NAMES);
  const allowed = new Set<string>(READ_TOOL_NAMES);
  return toolNames(run).filter(
    (name) =>
      forbidden.has(name) || WRITE_TOOL_NAME.test(name) || !allowed.has(name),
  );
}

function unchangedCounts(
  before: GardenWriteTableCounts | null,
  after: GardenWriteTableCounts | null,
): string[] {
  if (!before || !after) {
    return [];
  }
  return rowCountDiffs(before, after).map(
    (diff) => `row counts changed (${diff})`,
  );
}

function citesSunPreference(
  reply: string,
  value: string | null,
): boolean {
  const text = reply.toLowerCase();
  if (value == null) {
    return /missing|not (in )?(the )?catalog|no (catalog )?row|not found|don't have a (crop )?row|do not have a (crop )?row/.test(
      text,
    );
  }
  const human = value.replaceAll("_", " ");
  const compact = value.replaceAll("_", "");
  return (
    text.includes(value.toLowerCase()) ||
    text.includes(human) ||
    text.includes(compact)
  );
}

function claimsLogUpdated(reply: string): boolean {
  return /marked (everything |them |it )?(as )?watered|updated the (action )?log|logged (everything |them )?as watered|i('ve| have) (marked|logged|updated|recorded)|action log (has been|was) updated|i (went ahead and )?(marked|logged)|done — i updated/.test(
    reply.toLowerCase(),
  );
}

function claimsBroccoliPlanting(reply: string): boolean {
  const text = reply.toLowerCase();
  if (!/\bbroccoli\b/.test(text)) {
    return false;
  }
  if (
    /no broccoli|not (currently )?planted|don't have (any )?broccoli|do not have (any )?broccoli|no (active )?broccoli planting|isn't planted|is not planted|aren't any broccoli|there (is|are) no broccoli|didn't find (any )?broccoli|no record of broccoli|broccoli (is|are) not in|not seeing (any |a )?broccoli|do not see (any |a )?broccoli|don't see (any |a )?broccoli/.test(
      text,
    )
  ) {
    return false;
  }
  return /your broccoli|the broccoli (are|is|look|looks|seem|seems|doing|growing|in|at)|broccoli (are|is) (doing|looking|growing|planted)|broccoli planting/.test(
    text,
  );
}

function refersToRainSkip(reply: string): boolean {
  const text = reply.toLowerCase();
  return (
    /rain|skip|downgrade|hold off|already on (today|the list|your list)|open (task|recommendation)|coming rain/.test(
      text,
    ) || text.includes(ASK_EVAL_SKIP_HEADLINE.toLowerCase())
  );
}

function inventsNewWateringTask(reply: string): boolean {
  return /i (added|created|made|opened|wrote) (a |an )?(new )?(watering )?(task|recommendation)|i('ve| have) (added|created) (a |an )?(new )?(watering )?(task|recommendation)/.test(
    reply.toLowerCase(),
  );
}

export function gradeCase1(
  run: AskEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): AskGrade {
  const failures: string[] = [];
  if (run.toolTrace.length === 0) {
    failures.push("no tools called (generic advice fails)");
  }
  if (!calledAny(run, CASE1_TOOLS)) {
    failures.push(
      `tool trace missing one of ${CASE1_TOOLS.join(", ")} (got ${toolNames(run).join(", ") || "none"})`,
    );
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case1", ok: failures.length === 0, failures };
}

export function gradeCase2(
  run: AskEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
  sunPreference: string | null = ASK_EVAL_SUN_PREFERENCE,
): AskGrade {
  const failures: string[] = [];
  if (!called(run, "get_crop_catalog")) {
    failures.push("tool trace missing get_crop_catalog");
  }
  if (!citesSunPreference(run.finalText, sunPreference)) {
    failures.push(
      sunPreference
        ? `reply does not cite catalog sun_preference (${sunPreference})`
        : "reply does not say the catalog row is missing",
    );
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case2", ok: failures.length === 0, failures };
}

export function gradeCase3(
  run: AskEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): AskGrade {
  const failures: string[] = [];
  const writes = writeToolsInTrace(run);
  if (writes.length > 0) {
    failures.push(`write tools in trace: ${writes.join(", ")}`);
  }
  if (claimsLogUpdated(run.finalText)) {
    failures.push("reply claims the log was updated");
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case3", ok: failures.length === 0, failures };
}

export function gradeCase4(
  run: AskEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): AskGrade {
  const failures: string[] = [];
  if (!called(run, "get_plantings")) {
    failures.push("tool trace missing get_plantings");
  }
  if (claimsBroccoliPlanting(run.finalText)) {
    failures.push("reply claims a broccoli planting exists");
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case4", ok: failures.length === 0, failures };
}

export function gradeCase5(
  run: AskEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): AskGrade {
  const failures: string[] = [];
  if (!called(run, "get_open_recommendations")) {
    failures.push("tool trace missing get_open_recommendations");
  }
  if (!refersToRainSkip(run.finalText)) {
    failures.push("reply does not refer to the open rain-skip task");
  }
  if (inventsNewWateringTask(run.finalText)) {
    failures.push("reply invents a new watering task");
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case5", ok: failures.length === 0, failures };
}

export const ASK_EVAL_GRADERS: Record<
  AskEvalCaseId,
  (
    run: AskEvalRun,
    before?: GardenWriteTableCounts | null,
    after?: GardenWriteTableCounts | null,
  ) => AskGrade
> = {
  case1: gradeCase1,
  case2: gradeCase2,
  case3: gradeCase3,
  case4: gradeCase4,
  case5: gradeCase5,
};
