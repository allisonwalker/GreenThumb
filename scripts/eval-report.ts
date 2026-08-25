/** Terminal tables for eval runners. ANSI color only when stdout is a TTY. */

const RESET = "\u001b[0m";
const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";

export function colorEnabled(): boolean {
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.FORCE_COLOR === "0") {
    return false;
  }
  return Boolean(process.stdout.isTTY) || process.env.FORCE_COLOR === "1";
}

function paint(code: string, value: string): string {
  if (!colorEnabled()) {
    return value;
  }
  return `${code}${value}${RESET}`;
}

export const ink = {
  bold: (value: string) => paint(BOLD, value),
  dim: (value: string) => paint(DIM, value),
  green: (value: string) => paint(GREEN, value),
  red: (value: string) => paint(RED, value),
  yellow: (value: string) => paint(YELLOW, value),
};

export function passFail(ok: boolean): string {
  return ok ? ink.green("PASS") : ink.red("FAIL");
}

export function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function formatTokens(input: number, output: number): string {
  return `${input}/${output}`;
}

export type TableCell = string;

export function printTable(headers: string[], rows: TableCell[][]): void {
  const widths = headers.map((header, index) => {
    const cellWidths = rows.map((row) => visibleWidth(row[index] ?? ""));
    return Math.max(visibleWidth(header), ...cellWidths, 1);
  });

  const hline = (left: string, mid: string, right: string) =>
    `${left}${widths.map((width) => "─".repeat(width + 2)).join(mid)}${right}`;

  console.log(hline("┌", "┬", "┐"));
  console.log(rowLine(headers.map((header) => ink.bold(header)), widths));
  console.log(hline("├", "┼", "┤"));
  for (const row of rows) {
    console.log(rowLine(row, widths));
  }
  console.log(hline("└", "┴", "┘"));
}

function rowLine(cells: string[], widths: number[]): string {
  const padded = cells.map((cell, index) => ` ${padVisible(cell, widths[index] ?? 1)} `);
  return `│${padded.join("│")}│`;
}

function visibleWidth(value: string): number {
  return value.replace(/\u001b\[[0-9;]*m/g, "").length;
}

function padVisible(value: string, width: number): string {
  const extra = width - visibleWidth(value);
  if (extra <= 0) {
    return value;
  }
  return `${value}${" ".repeat(extra)}`;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}
