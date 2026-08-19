const HOUR_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

export function formatTimeBudgetPrompt(input: {
  saturdayHours: number;
  sundayHours: number;
}): { prompt: string } | { error: string } {
  const saturday = normalizeHours(input.saturdayHours);
  const sunday = normalizeHours(input.sundayHours);
  if (saturday === null || sunday === null) {
    return { error: "Hours must be between 0 and 24." };
  }
  if (saturday === 0 && sunday === 0) {
    return { error: "Say how many hours you have on Saturday or Sunday." };
  }

  const parts: string[] = [];
  if (saturday > 0) {
    parts.push(`${hoursPhrase(saturday)} Saturday`);
  }
  if (sunday > 0) {
    parts.push(`${hoursPhrase(sunday)} Sunday`);
  }

  if (parts.length === 1) {
    return { prompt: `I have ${parts[0]}.` };
  }
  return { prompt: `I have ${parts[0]} and ${parts[1]}.` };
}

function normalizeHours(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > 24) {
    return null;
  }
  return Math.round(value * 2) / 2;
}

function hoursPhrase(hours: number): string {
  if (hours === 1) {
    return "one hour";
  }
  if (Number.isInteger(hours) && hours >= 2 && hours <= 12) {
    return `${HOUR_WORDS[hours]} hours`;
  }
  return `${hours} hours`;
}
