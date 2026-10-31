// Which status a visit can move to from each status (the menu on the appointment screen).
export const NEXT_STATUS: Record<string, string[]> = {
  requested: ["confirmed", "declined"], // accepting confirms it: the client asked for that time
  // "completed" from any booked step: finishing the order when "on the way" or the check-in was skipped.
  unconfirmed: ["confirmed", "en_route", "in_progress", "completed", "cancelled", "no_show"],
  confirmed: ["unconfirmed", "en_route", "in_progress", "completed", "cancelled", "no_show"],
  en_route: ["in_progress", "completed", "confirmed", "cancelled", "no_show"],
  in_progress: ["completed", "en_route"],
  completed: ["in_progress"],
  cancelled: ["unconfirmed"],
  no_show: ["unconfirmed"],
};
