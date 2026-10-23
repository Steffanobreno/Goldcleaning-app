// Online booking times. One team, a fixed list of start times per weekday (9 AM "Morning",
// 1 PM "Afternoon"). A start time is open when the whole visit fits without touching any busy
// interval (active visits, holds by pending requests, time off) and it is not too soon.
import { addDaysYmd, dayLabel, timeLabel, weekdayOf, zonedToUtc } from "./format";

export type SlotDef = { weekday: number; start: string; label: string }; // weekday 0 = Sunday, start "HH:MM"
export type Busy = { start: Date; end: Date };
export type DaySlots = { date: string; label: string; times: { value: string; label: string; slotLabel: string }[] };

export function openSlots(a: {
  firstDay: string;
  days: number;
  tz: string;
  slots: SlotDef[];
  durationMin: number;
  busy: Busy[];
  earliest: Date;
}): DaySlots[] {
  const length = a.durationMin * 60_000;
  const result: DaySlots[] = [];
  for (let i = 0; i < a.days; i++) {
    const date = addDaysYmd(a.firstDay, i);
    const weekday = weekdayOf(date);
    const times = a.slots
      .filter((s) => s.weekday === weekday)
      .sort((x, y) => x.start.localeCompare(y.start))
      .map((s) => ({ s, start: zonedToUtc(date, s.start, a.tz) }))
      .filter(({ start }) => {
        const t = start.getTime();
        return (
          t >= a.earliest.getTime() &&
          !a.busy.some((b) => t < b.end.getTime() && t + length > b.start.getTime())
        );
      })
      .map(({ s, start }) => ({ value: start.toISOString(), label: timeLabel(start, a.tz), slotLabel: s.label }));
    if (times.length) result.push({ date, label: dayLabel(zonedToUtc(date, "12:00", a.tz), a.tz), times });
  }
  return result;
}
