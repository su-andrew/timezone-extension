const { DAYS, CITIES } = TimeZoneConverter;

const rows = [...document.querySelectorAll(".row")].map((row) => ({
  key: row.dataset.city,
  row,
  day: row.querySelector(".day"),
  time: row.querySelector(".time"),
  period: row.querySelector(".period")
}));

const closeButton = document.querySelector(".close-button");
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

closeButton.addEventListener("click", () => window.close());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.close();
  }
});

for (const row of rows) {
  for (const control of [row.day, row.time, row.period]) {
    control.addEventListener("input", () => convertFrom(row));
    control.addEventListener("change", () => convertFrom(row));
    control.addEventListener("focus", () => markActive(row));
  }
}

function setInitialValues() {
  const sfParts = TimeZoneConverter.getZonedParts(
    new Date(),
    CITIES["san-francisco"].timeZone
  );

  setRow("san-francisco", sfParts.weekday, "7:00", "PM");
  setRow("atlanta", sfParts.weekday, "", "PM");
  setRow("london", sfParts.weekday, "", "AM");
}

function setRow(key, weekday, time, period) {
  const row = rows.find((item) => item.key === key);
  row.day.value = String(weekday);
  row.time.value = time;
  row.period.value = period;
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

  const parsed = TimeZoneConverter.parseTime(source.time.value, source.period.value);
  if (!parsed) {
    message.textContent = source.time.value.trim()
      ? "Use a time like 7, 7:30, or 11:45."
      : "";
    source.row.classList.toggle("invalid", Boolean(source.time.value.trim()));
    clearOtherTimes(source.key);
    return;
  }

  message.textContent = "";
  const conversions = TimeZoneConverter.convertFromParts(
    source.key,
    Number(source.day.value),
    parsed.hour24,
    parsed.minute
  );

  isUpdating = true;
  for (const row of rows) {
    const formatted = conversions.find((item) => item.key === row.key);
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
