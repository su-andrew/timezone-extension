(function () {
  const DAYS = [
    { label: "Sunday", shortLabel: "Sun", value: 0 },
    { label: "Monday", shortLabel: "Mon", value: 1 },
    { label: "Tuesday", shortLabel: "Tue", value: 2 },
    { label: "Wednesday", shortLabel: "Wed", value: 3 },
    { label: "Thursday", shortLabel: "Thu", value: 4 },
    { label: "Friday", shortLabel: "Fri", value: 5 },
    { label: "Saturday", shortLabel: "Sat", value: 6 }
  ];

  const CITIES = {
    "san-francisco": {
      label: "San Francisco",
      shortLabel: "SF",
      timeZone: "America/Los_Angeles"
    },
    atlanta: {
      label: "Atlanta",
      shortLabel: "ATL",
      timeZone: "America/New_York"
    },
    london: {
      label: "London",
      shortLabel: "LDN",
      timeZone: "Europe/London"
    }
  };

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

  function parseSelection(text) {
    const normalized = text.trim().replace(/\s+/g, " ");
    const day = findWeekday(normalized);
    const timeMatch = normalized.match(/\b(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?\s*m\.?\b/i);

    if (!timeMatch) {
      return null;
    }

    const hour = timeMatch[1];
    const minute = timeMatch[2] ? `:${timeMatch[2]}` : "";
    const period = timeMatch[3].toUpperCase() === "A" ? "AM" : "PM";
    const parsed = parseTime(`${hour}${minute}`, period);

    if (!parsed) {
      return null;
    }

    return {
      day,
      hour24: parsed.hour24,
      minute: parsed.minute,
      rawTime: `${Number(hour)}${minute || ":00"} ${period}`
    };
  }

  function findWeekday(text) {
    const normalized = text.toLowerCase();

    for (const day of DAYS) {
      const fullPattern = new RegExp(`\\b${day.label.toLowerCase()}\\b`);
      const shortPattern = new RegExp(`\\b${day.shortLabel.toLowerCase()}\\b`);
      if (fullPattern.test(normalized) || shortPattern.test(normalized)) {
        return day.value;
      }
    }

    return null;
  }

  function convertFromParts(sourceKey, weekday, hour24, minute) {
    const sourceZone = CITIES[sourceKey].timeZone;
    const sourceDate = currentWeekDateForDay(weekday, sourceZone);
    const instant = zonedTimeToUtc({
      ...sourceDate,
      hour: hour24,
      minute,
      timeZone: sourceZone
    });

    return Object.keys(CITIES).map((key) => {
      const formatted = formatForZone(instant, CITIES[key].timeZone);
      return {
        key,
        city: CITIES[key].label,
        shortCity: CITIES[key].shortLabel,
        ...formatted
      };
    });
  }

  function currentWeekDateForDay(targetWeekday, timeZone) {
    const nowParts = getZonedParts(new Date(), timeZone);
    const weekday = targetWeekday === null ? nowParts.weekday : targetWeekday;
    const localNoonUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day, 12);
    const offsetFromToday = weekday - nowParts.weekday;
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
      day: DAYS[parts.weekday].label,
      shortDay: DAYS[parts.weekday].shortLabel,
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

  globalThis.TimeZoneConverter = {
    DAYS,
    CITIES,
    convertFromParts,
    currentWeekDateForDay,
    formatForZone,
    getZonedParts,
    parseSelection,
    parseTime,
    zonedTimeToUtc
  };
})();
