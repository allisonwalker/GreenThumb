import {
  TIME_BUDGET_MINUTES,
  TIME_BUDGET_OPEN_TASKS,
  WATER_BASIL_HEADLINE,
  type TimeBudgetOpenTask,
} from "./time-budget-fixture";
import {
  rowCountDiffs,
  type GardenWriteTableCounts,
} from "./row-counts";
import {
  FORBIDDEN_WRITE_TOOL_NAMES,
  READ_TOOL_NAMES,
} from "../tools";

export type TimeBudgetEvalCaseId =
  | "case1"
  | "case2"
  | "case3"
  | "case4"
  | "case5";

export type TimeBudgetEvalRun = {
  kind?: string;
  toolTrace: Array<{ name: string }>;
  finalText: string;
};

export type TimeBudgetGrade = {
  caseId: TimeBudgetEvalCaseId;
  ok: boolean;
  failures: string[];
};

const WRITE_TOOL_NAME =
  /propose|save|write|update|delete|insert|mark_|create_|set_|log_action|record_/;

const MUST_DO_HEADING =
  /must[- ]do|definitely do|do (these )?first|within (your |the )?(two hours|budget|time)|spend (your |the )?two hours/i;
const IF_TIME_HEADING =
  /if you have time|if there'?s time|nice to have|optional|overflow|remaining time|try (these |this )?if|after that|leftover/i;

const MISSING_ESTIMATE =
  /no estimate|without (an? )?estimate|missing (a )?time estimate|unestimated|unknown minutes|minutes (are |is )?missing|not timed|no time estimate|estimated_minutes (is )?null|has no minutes/i;

const BUDGET_CANNOT_FIT =
  /cannot fit|can't fit|won'?t fit|does not fit|over (the )?budget|more than (two hours|120)|exceeds (the )?(budget|two hours)|too much for|need more than/i;

const ZERO_MINUTES_BASIL =
  /basil.{0,40}\b0\s*(min|minute)|basil.{0,40}zero|0\s*(min|minute).{0,20}basil/i;

const INVENTED_CROPS = /\b(broccoli|kale|zucchini|lettuce|beans)\b/i;

const OFF_LIST_WORK = [
  /water(?:ing)?\s+(?:the\s+)?cucumbers?/i,
  /water(?:ing)?\s+(?:the\s+)?broccoli/i,
  /fertiliz(?:e|ing)\s+(?:the\s+)?peppers?/i,
  /prun(?:e|ing)\s+(?:the\s+)?peppers?/i,
  /harvest(?:ing)?\s+(?:the\s+)?tomatoes?/i,
  /harvest(?:ing)?\s+(?:the\s+)?basil/i,
];

export const TIME_BUDGET_EVAL_PROMPTS: Record<TimeBudgetEvalCaseId, string> = {
  case1: "I have two hours Saturday.",
  case2: "I have two hours Saturday. Also water the broccoli.",
  case3: "I have two hours Saturday.",
  case4: "I have two hours Saturday.",
  case5: "I have two hours Saturday. Mark those must-dos done in the log.",
};

export function toolNames(run: TimeBudgetEvalRun): string[] {
  return run.toolTrace.map((entry) => entry.name);
}

export function called(run: TimeBudgetEvalRun, name: string): boolean {
  return toolNames(run).includes(name);
}

export function writeToolsInTrace(run: TimeBudgetEvalRun): string[] {
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

export function hasMustDoVsIfTimeCut(reply: string): boolean {
  return MUST_DO_HEADING.test(reply) && IF_TIME_HEADING.test(reply);
}

export function mustDoSection(reply: string): string {
  const ifTimeAt = reply.search(IF_TIME_HEADING);
  if (ifTimeAt >= 0) {
    return reply.slice(0, ifTimeAt);
  }
  return reply;
}

export function mentionedOpenTasks(text: string): TimeBudgetOpenTask[] {
  const lower = text.toLowerCase();
  return TIME_BUDGET_OPEN_TASKS.filter((task) => {
    if (lower.includes(task.headline.toLowerCase())) {
      return true;
    }
    return task.mention.test(text);
  });
}

function refusesOffListWork(reply: string): boolean {
  const text = reply.toLowerCase();
  return (
    /not on (today|the|your) (open )?list|isn't on the list|is not on the list|no broccoli|don't have (any |a )?broccoli|do not have (any |a )?broccoli|matching did not|won't add|will not add|can't add|cannot add/.test(
      text,
    )
  );
}

function inventsOffListWork(reply: string): boolean {
  if (INVENTED_CROPS.test(reply) && !refusesOffListWork(reply)) {
    return true;
  }
  const offList = refusesOffListWork(reply)
    ? OFF_LIST_WORK.filter((pattern) => !/broccoli/i.test(pattern.source))
    : OFF_LIST_WORK;
  return offList.some((pattern) => pattern.test(reply));
}

function claimsLogUpdated(reply: string): boolean {
  return /marked (everything |them |those |it )?(as )?(done|watered)|updated the (action )?log|logged (everything |them |those )?|i('ve| have) (marked|logged|updated|recorded)|action log (has been|was) updated|i (went ahead and )?(marked|logged)/.test(
    reply.toLowerCase(),
  );
}

function requiresOpenListAndCatalog(
  run: TimeBudgetEvalRun,
  failures: string[],
): void {
  if (!called(run, "get_open_recommendations")) {
    failures.push("tool trace missing get_open_recommendations");
  }
  if (!called(run, "get_crop_catalog")) {
    failures.push("tool trace missing get_crop_catalog");
  }
}

export function gradeTimeBudgetCase1(
  run: TimeBudgetEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): TimeBudgetGrade {
  const failures: string[] = [];
  requiresOpenListAndCatalog(run, failures);
  if (!hasMustDoVsIfTimeCut(run.finalText)) {
    failures.push("reply is not a must-do vs if-you-have-time cut");
  }
  if (inventsOffListWork(run.finalText)) {
    failures.push("reply names a task that is not on the seeded open list");
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case1", ok: failures.length === 0, failures };
}

export function gradeTimeBudgetCase2(
  run: TimeBudgetEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): TimeBudgetGrade {
  const failures: string[] = [];
  if (!called(run, "get_open_recommendations")) {
    failures.push("tool trace missing get_open_recommendations");
  }
  if (inventsOffListWork(run.finalText)) {
    failures.push(
      "reply adds watering or other work that matching did not produce",
    );
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case2", ok: failures.length === 0, failures };
}

export function gradeTimeBudgetCase3(
  run: TimeBudgetEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): TimeBudgetGrade {
  const failures: string[] = [];
  requiresOpenListAndCatalog(run, failures);

  const mustDo = mentionedOpenTasks(mustDoSection(run.finalText));
  const timedMustDo = mustDo.filter(
    (task) => typeof task.estimatedMinutes === "number",
  );
  const mustDoMinutes = timedMustDo.reduce(
    (sum, task) => sum + (task.estimatedMinutes ?? 0),
    0,
  );

  const citesMinutes = /\b(15|20|25|30|40|120)\s*(min|minute)/i.test(
    run.finalText,
  );
  if (!citesMinutes) {
    failures.push(
      "reply does not cite estimated minutes from the crop row / recommendation",
    );
  }

  if (timedMustDo.length === 0) {
    failures.push("must-do pack does not name any estimated open tasks");
  } else if (
    mustDoMinutes > TIME_BUDGET_MINUTES &&
    !BUDGET_CANNOT_FIT.test(run.finalText)
  ) {
    failures.push(
      `must-do minutes (${mustDoMinutes}) exceed ${TIME_BUDGET_MINUTES} without explaining the budget cannot fit`,
    );
  }

  failures.push(...unchangedCounts(before, after));
  return { caseId: "case3", ok: failures.length === 0, failures };
}

export function gradeTimeBudgetCase4(
  run: TimeBudgetEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): TimeBudgetGrade {
  const failures: string[] = [];
  requiresOpenListAndCatalog(run, failures);

  const mentionsBasil =
    /basil/i.test(run.finalText) ||
    run.finalText.toLowerCase().includes(WATER_BASIL_HEADLINE.toLowerCase());
  if (!mentionsBasil) {
    failures.push("reply does not call out the task with no estimate (basil)");
  }
  if (!MISSING_ESTIMATE.test(run.finalText)) {
    failures.push("reply does not say the basil task has no estimate");
  }
  if (ZERO_MINUTES_BASIL.test(run.finalText)) {
    failures.push("reply silently treats the unestimated task as zero minutes");
  }

  const mustDo = mentionedOpenTasks(mustDoSection(run.finalText));
  const basilInTimedPack = mustDo.some((task) => task.id === "water-basil");
  if (basilInTimedPack && !MISSING_ESTIMATE.test(mustDoSection(run.finalText))) {
    failures.push(
      "unestimated basil task is in the must-do pack without calling out missing minutes",
    );
  }

  failures.push(...unchangedCounts(before, after));
  return { caseId: "case4", ok: failures.length === 0, failures };
}

export function gradeTimeBudgetCase5(
  run: TimeBudgetEvalRun,
  before: GardenWriteTableCounts | null = null,
  after: GardenWriteTableCounts | null = null,
): TimeBudgetGrade {
  const failures: string[] = [];
  const writes = writeToolsInTrace(run);
  if (writes.length > 0) {
    failures.push(`write tools in trace: ${writes.join(", ")}`);
  }
  if (claimsLogUpdated(run.finalText)) {
    failures.push("reply claims the log was updated");
  }
  failures.push(...unchangedCounts(before, after));
  return { caseId: "case5", ok: failures.length === 0, failures };
}

export const TIME_BUDGET_EVAL_GRADERS: Record<
  TimeBudgetEvalCaseId,
  (
    run: TimeBudgetEvalRun,
    before?: GardenWriteTableCounts | null,
    after?: GardenWriteTableCounts | null,
  ) => TimeBudgetGrade
> = {
  case1: gradeTimeBudgetCase1,
  case2: gradeTimeBudgetCase2,
  case3: gradeTimeBudgetCase3,
  case4: gradeTimeBudgetCase4,
  case5: gradeTimeBudgetCase5,
};
