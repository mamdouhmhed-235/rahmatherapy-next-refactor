const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function londonStamp(instant) {
  return Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map((part) => [
      part.type,
      part.value,
    ])
  );
}

const cases = [
  {
    name: "GMT winter date stays in London business day",
    instant: "2026-01-15T12:00:00Z",
    expected: { year: "2026", month: "01", day: "15", hour: "12" },
  },
  {
    name: "BST summer date applies one-hour London offset",
    instant: "2026-07-15T12:00:00Z",
    expected: { year: "2026", month: "07", day: "15", hour: "13" },
  },
];

for (const testCase of cases) {
  const actual = londonStamp(testCase.instant);
  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    if (actual[key] !== expectedValue) {
      throw new Error(
        `${testCase.name}: expected ${key}=${expectedValue}, got ${actual[key]}`
      );
    }
  }
}

console.log("Europe/London GMT and BST checks passed.");
