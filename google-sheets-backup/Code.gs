/**
 * Parenthood Arena — Google Sheets backup receiver.
 *
 * SETUP (one time, ~5 minutes):
 *  1. Create a new Google Sheet (e.g. "Parenthood Arena Backup").
 *  2. Extensions → Apps Script. Delete the sample code and paste this whole file.
 *  3. Change SECRET below to your own long random phrase. Save.
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as: Me      Who has access: Anyone
 *     Click Deploy, allow the permissions, and copy the Web app URL (ends with /exec).
 *  5. In the app: Settings → Online backup → paste the URL and the same SECRET → "Save & test".
 *
 * Sheets created automatically:
 *  - Entries : one row per log entry (readable columns + full JSON for restoring)
 *  - AppData : settings, milestones, vaccines, foods, custom timetables
 *  - Log     : a line for every backup received
 * Deleted entries are NOT removed from the sheet; they are marked deleted = TRUE,
 * so nothing is ever lost.
 */
const SECRET = 'change-this-to-your-own-secret-phrase';

const HEADERS = ['id', 'date', 'start', 'end', 'duration_min', 'type', 'activity', 'details', 'note', 'logged_by', 'deleted', 'updated_at', 'json'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== SECRET) return out({ ok: false, error: 'Wrong secret' });
    if (body.action === 'ping') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const en = ss.getSheetByName('Entries');
      return out({ ok: true, sheet: ss.getName(), count: en ? Math.max(0, en.getLastRow() - 1) : 0 });
    }
    if (body.action === 'export') return out(exportAll());
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (body.action === 'save') return out(saveRows(body.rows || [], body.deletes || []));
      if (body.action === 'saveKV') return out(saveKV(body.kv || {}));
      return out({ ok: false, error: 'Unknown action' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out({ ok: true, message: 'Parenthood Arena backup is running.' });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function saveRows(rows, deletes) {
  const sh = sheet('Entries', HEADERS);
  const last = sh.getLastRow();
  const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
  const index = {};
  ids.forEach((id, i) => { index[id] = i + 2; });
  const append = [];
  let updated = 0;
  rows.forEach(r => {
    const values = [r.id, r.date, r.start, r.end, r.duration, r.type, r.activity, r.details, r.note, r.by, false, new Date(r.updatedAt || Date.now()), JSON.stringify(r.entry)];
    if (index[r.id]) { sh.getRange(index[r.id], 1, 1, values.length).setValues([values]); updated++; }
    else { append.push(values); index[r.id] = -1; }
  });
  if (append.length) sh.getRange(sh.getLastRow() + 1, 1, append.length, HEADERS.length).setValues(append);
  let marked = 0;
  deletes.forEach(id => {
    const row = index[id];
    if (row > 0) { sh.getRange(row, 11, 1, 2).setValues([[true, new Date()]]); marked++; }
  });
  sheet('Log', ['time', 'added', 'updated', 'deleted']).appendRow([new Date(), append.length, updated, marked]);
  return { ok: true, added: append.length, updated: updated, deleted: marked };
}

function saveKV(kv) {
  const sh = sheet('AppData', ['key', 'value_json', 'updated_at']);
  const last = sh.getLastRow();
  const keys = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
  Object.keys(kv).forEach(k => {
    const values = [k, JSON.stringify(kv[k]), new Date()];
    const i = keys.indexOf(k);
    if (i >= 0) sh.getRange(i + 2, 1, 1, 3).setValues([values]);
    else { sh.appendRow(values); keys.push(k); }
  });
  return { ok: true };
}

function exportAll() {
  const sh = sheet('Entries', HEADERS);
  const last = sh.getLastRow();
  const entries = [];
  if (last > 1) {
    sh.getRange(2, 1, last - 1, HEADERS.length).getValues().forEach(r => {
      if (r[10] === true || r[10] === 'TRUE') return; // deleted
      try { entries.push(JSON.parse(r[12])); } catch (e) { /* skip broken row */ }
    });
  }
  const kvSh = sheet('AppData', ['key', 'value_json', 'updated_at']);
  const kvLast = kvSh.getLastRow();
  const kv = {};
  if (kvLast > 1) kvSh.getRange(2, 1, kvLast - 1, 2).getValues().forEach(r => { try { kv[r[0]] = JSON.parse(r[1]); } catch (e) {} });
  return { ok: true, entries: entries, kv: kv };
}
