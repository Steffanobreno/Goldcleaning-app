// Which status a visit can move to from each status (the menu on the appointment screen).
export const NEXT_STATUS: Record<string, string[]> = {
  requested: ["unconfirmed", "declined"],
  unconfirmed: ["confirmed", "en_route", "in_progress", "cancelled", "no_show"],
  confirmed: ["unconfirmed", "en_route", "in_progress", "cancelled", "no_show"],
  en_route: ["in_progress", "confirmed", "cancelled", "no_show"],
  in_progress: ["completed", "en_route"],
  completed: ["in_progress"],
  cancelled: ["unconfirmed"],
  no_show: ["unconfirmed"],
};
