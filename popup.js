const DAYS = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 }
];

const CITIES = {
  "san-francisco": {
    label: "San Francisco",
    timeZone: "America/Los_Angeles"
  },
  atlanta: {
    label: "Atlanta",
    timeZone: "America/New_York"
  },
  london: {
    label: "London",
    timeZone: "Europe/London"
  }
};

const rows = [...document.querySelectorAll(".row")].map((row) => ({
  key: row.dataset.city,
  row,
  day: row.querySelector(".day"),
  time: row.querySelector(".time"),
  period: row.querySelector(".period")
}));

const message = document.querySelector(".message");
let activeKey = "san-francisco";
let isUpdating = false;

for (const { day } of rows) {
  for (const option of DAYS) {
    day.add(new Option(option.label, String(option.value)));
  }
}

setInitialValues();
convertFrom(rows.find(({ key }) => key === activeKey));

for (const row of rows) {
  for (const control of [row.day, row.time, row.period]) {
    control.addEventListener("input", () => convertFrom(row));
    control.addEventListener("change", () => convertFrom(row));
    control.addEventListener("focus", () => markActive(row));
  }
}

function setInitialValues() {
  const now = new Date();
  const sfParts = getZonedParts(now, CITIES["san-francisco"].timeZone);

  rows.find(({ key }) => key === "san-francisco").day.value = String(sfParts.weekday);
  rows.find(({ key }) => key === "san-francisco").time.value = "7:00";
  rows.find(({ key }) => key === "san-francisco").period.value = "PM";

  rows.find(({ key }) => key === "atlanta").day.value = String(sfParts.weekday);
  rows.find(({ key }) => key === "atlanta").time.value = "";
  rows.find(({ key }) => key === "atlanta").period.value = "PM";

  rows.find(({ key }) => key === "london").day.value = String(sfParts.weekday);
  rows.find(({ key }) => key === "london").time.value = "";
  rows.find(({ key }) => key === "london").period.value = "AM";
}

function markActive(source) {
  activeKey = source.key;
  for (const row of rows) {
    row.row.classList.toggle("active", row.key === activeKey);
  }
}

function convertFrom(source) {
  if (isUpdating) {
    return;
  }

  markActive(source);
  clearInvalid();

  const parsed = parseTime(source.time.value, source.period.value);
  if (!parsed) {
    message.textContent = source.time.value.trim()
      ? "Use a time like 7, 7:30, or 11:45."
      : "";
    source.row.classList.toggle("invalid", Boolean(source.time.value.trim()));
    clearOtherTimes(source.key);
    return;
  }

  message.textContent = "";
  const sourceZone = CITIES[source.key].timeZone;
  const sourceDate = currentWeekDateForDay(Number(source.day.value), sourceZone);
  const instant = zonedTimeToUtc({
    ...sourceDate,
    hour: parsed.hour24,
    minute: parsed.minute,
    timeZone: sourceZone
  });

  isUpdating = true;
  for (const row of rows) {
    const formatted = formatForZone(instant, CITIES[row.key].timeZone);
    row.day.value = String(formatted.weekday);
    row.time.value = formatted.time;
    row.period.value = formatted.period;
  }
  isUpdating = false;
}

function clearInvalid() {
  for (const row of rows) {
    row.row.classList.remove("invalid");
  }
}

function clearOtherTimes(sourceKey) {
  isUpdating = true;
  for (const row of rows) {
    if (row.key !== sourceKey) {
      row.time.value = "";
    }
  }
  isUpdating = false;
}

function parseTime(value, period) {
  const match = value.trim().match(/^(\d{1,2})(?::([0-5]\d))?$/);
  if (!match) {
    return null;
  }

  const hour12 = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (hour12 < 1 || hour12 > 12) {
    return null;
  }

  let hour24 = hour12 % 12;
  if (period === "PM") {
    hour24 += 12;
  }

  return { hour24, minute };
}

function currentWeekDateForDay(targetWeekday, timeZone) {
  const nowParts = getZonedParts(new Date(), timeZone);
  const localNoonUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 12);
  const offsetFromToday = targetWeekday - nowParts.weekday;
  const target = new Date(localNoonUtc + offsetFromToday * 24 * 60 * 60 * 1000);

  return {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: target.getUTCDate()
  };
}

function zonedTimeToUtc({ year, month, day, hour, minute, timeZone }) {
  let utc = Date.UTC(year, month - 1, day, hour, minute);

  for (let i = 0; i < 4; i += 1) {
    const actual = getZonedParts(new Date(utc), timeZone);
    const desiredWallTime = Date.UTC(year, month - 1, day, hour, minute);
    const actualWallTime = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    );
    const difference = desiredWallTime - actualWallTime;

    if (difference === 0) {
      break;
    }

    utc += difference;
  }

  return new Date(utc);
}

function formatForZone(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  const period = parts.hour >= 12 ? "PM" : "AM";
  const hour12 = parts.hour % 12 || 12;
  const time = `${hour12}:${String(parts.minute).padStart(2, "0")}`;

  return {
    weekday: parts.weekday,
    time,
    period
  };
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: DAYS.find(({ label }) => label === parts.weekday).value
  };
}
