import { formatDuration, intervalToDuration, format } from "date-fns";

export const formatDate = (
  _date: Date | string,
  verbs?: { future: string; past: string } | false
): { label: string; value: string } => {
  const date = typeof _date === "string" ? new Date(_date) : _date;
  const start = new Date();
  const duration = intervalToDuration({ start, end: date });
  let unit: (keyof Duration)[] = [
    "years",
    "months",
    "weeks",
    "days",
    "hours",
    "minutes",
    "seconds",
  ];
  for (let i = 0; i < unit.length; i += 1) {
    const fmt = unit[i];
    if (duration[fmt]) {
      unit = [fmt];
      break;
    }
  }
  const value = format(date, "yyyy-MM-dd:HH:mm:ss");
  let time = formatDuration(duration, {
    format: unit,
  });
  if (unit[0] === "seconds") {
    time = "less than a minute";
  }
  let label = time ? `${time} ago` : "just now";
  if (verbs === false) {
    if (start <= date) {
      label = `in ${time}`;
    }
  } else {
    let past = "ran";
    let future = "run";
    if (verbs) {
      past = verbs.past;
      future = verbs.future;
    }
    label = `${past} ${time} ago`;
    if (start <= date) {
      label = `will ${future} in ${time}`;
    }
  }
  return { label, value };
};
