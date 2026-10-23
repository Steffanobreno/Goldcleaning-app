// The Google Apps Script the owner pastes at script.google.com (free, runs in their own
// Google account). Every 15 minutes during the day it reads the app's calendar feed and
// creates, moves or deletes events in a "Woofers Dog Spa" calendar. Nothing to install and
// no Google Cloud project; Google asks once for permission to manage that calendar.
// It skips the night so the free database can sleep.

export function googleCalendarScript(feedUrl: string, calendarName: string, timezone: string) {
  return `// Woofers → Google Calendar. Paste this, Save, choose "setup" and press Run once.
const FEED = ${JSON.stringify(feedUrl)};
const CALENDAR = ${JSON.stringify(calendarName)};
const TIMEZONE = ${JSON.stringify(timezone)};
const FIRST_HOUR = 6, LAST_HOUR = 21; // only syncs from 6am to 9pm

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("sync").timeBased().everyMinutes(15).create();
  sync(true);
}

function sync(force) {
  const hour = Number(Utilities.formatDate(new Date(), TIMEZONE, "H"));
  if (force !== true && (hour < FIRST_HOUR || hour >= LAST_HOUR)) return;
  const cal = CalendarApp.getCalendarsByName(CALENDAR)[0] ||
    CalendarApp.createCalendar(CALENDAR, { color: CalendarApp.Color.BLUE, timeZone: TIMEZONE });
  const data = JSON.parse(UrlFetchApp.fetch(FEED).getContentText());
  const existing = {};
  cal.getEvents(new Date(data.from), new Date(data.to)).forEach((e) => {
    const id = e.getTag("woofersId");
    if (id) existing[id] = e;
  });
  data.events.forEach((ev) => {
    let e = existing[ev.id];
    if (e) {
      delete existing[ev.id];
      if (e.getTag("woofersVersion") === ev.version) return;
      e.setTime(new Date(ev.start), new Date(ev.end));
      e.setTitle(ev.title);
      e.setLocation(ev.location);
      e.setDescription(ev.description);
    } else {
      e = cal.createEvent(ev.title, new Date(ev.start), new Date(ev.end), { location: ev.location, description: ev.description });
      e.setTag("woofersId", ev.id);
    }
    e.setTag("woofersVersion", ev.version);
  });
  // Cancelled or deleted visits leave the feed: remove them from Google too.
  Object.keys(existing).forEach((id) => existing[id].deleteEvent());
}
`;
}
