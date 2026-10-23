// The Google Apps Script the owner pastes at script.google.com (free, in their own Google
// account). Every Sunday night it saves two files in a "Woofers backups" folder on Google
// Drive: everything as JSON, and the client list as a spreadsheet. It keeps the last 12 weeks.
// If a backup fails, Google emails the account owner on its own.

export function backupScript(feedUrl: string, timezone: string) {
  return `// Woofers → Google Drive backup. Paste this in a NEW project, Save, choose "setup" and press Run once.
const FEED = ${JSON.stringify(feedUrl)};
const FOLDER = "Woofers backups";
const TIMEZONE = ${JSON.stringify(timezone)};
const KEEP_WEEKS = 12;

function setup() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "backup").forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("backup").timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(21).inTimezone(TIMEZONE).create();
  backup();
}

function backup() {
  const found = DriveApp.getFoldersByName(FOLDER);
  const folder = found.hasNext() ? found.next() : DriveApp.createFolder(FOLDER);
  const stamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
  [["data", "woofers-backup-" + stamp + ".json"], ["clients", "woofers-clients-" + stamp + ".csv"]].forEach(([file, name]) => {
    let res;
    for (let i = 0; i < 3; i++) { // the database may be asleep: try again
      res = UrlFetchApp.fetch(FEED + "&file=" + file, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) break;
      Utilities.sleep(20000);
    }
    if (res.getResponseCode() !== 200) throw new Error("Backup failed (" + res.getResponseCode() + "): " + res.getContentText().slice(0, 200));
    folder.createFile(res.getBlob().setName(name));
  });
  const cutoff = Date.now() - KEEP_WEEKS * 7 * 86400000;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getDateCreated().getTime() < cutoff) f.setTrashed(true);
  }
}
`;
}
