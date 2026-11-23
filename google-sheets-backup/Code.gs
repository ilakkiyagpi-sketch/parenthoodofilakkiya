/**
 * Happy Parenthood — Google Sheets backup receiver (version 2: with photo backup).
 *
 * SETUP / UPDATE:
 *  1. Open your backup Google Sheet → Extensions → Apps Script.
 *  2. Select ALL the old code (Ctrl+A), delete it, and paste this whole file.
 *  3. Put your own secret phrase in SECRET below (keep the quotes). Save.
 *  4. First time:   Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 *     Updating:     Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.
 *     Google will ask for permission again because photos are now saved to Google Drive.
 *  5. In the app: Settings → Online backup → Save & test.
 *
 * Tabs created automatically:
 *  - Entries : one row per log entry (readable columns + full JSON for restoring)
 *  - AppData : settings, milestones, vaccines, foods, custom timetables
 *  - Photos  : one row per photo, with a link to the file in Google Drive
 *  - Log     : a line for every backup received
 * Photos go to the Drive folder "Happy Parenthood Photos".
 * Deleted entries are NOT removed from the sheet; they are marked deleted = TRUE.
 */
const SECRET = 'change-this-to-your-own-secret-phrase';

const HEADERS = ['id', 'date', 'start', 'end', 'duration_min', 'type', 'activity', 'details', 'note', 'logged_by', 'deleted', 'updated_at', 'json', 'photos'];
const PHOTO_HEADERS = ['id', 'file_id', 'url', 'saved_at'];
const PHOTO_FOLDER = 'Happy Parenthood Photos';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== SECRET) return out({ ok: false, error: 'Wrong secret' });
    if (body.action === 'ping') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const en = ss.getSheetByName('Entries');
      return out({ ok: true, sheet: ss.getName(), count: en ? Math.max(0, en.getLastRow() - 1) : 0, photos: true });
    }
    if (body.action === 'export') return out(exportAll());
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (body.action === 'save') return out(saveRows(body.rows || [], body.deletes || []));
      if (body.action === 'saveKV') return out(saveKV(body.kv || {}));
      if (body.action === 'photo') return out(savePhoto(body));
      return out({ ok: false, error: 'Unknown action' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out({ ok: true, message: 'Happy Parenthood backup is running.' });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.setFrozenRows(1);
  }
  // create or extend the header row (older sheets get the new "photos" column)
  if (sh.getLastColumn() < headers.length || sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
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
    const values = [r.id, r.date, r.start, r.end, r.duration, r.type, r.activity, r.details, r.note, r.by, false,
      new Date(r.updatedAt || Date.now()), JSON.stringify(r.entry), r.photos || ''];
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

function photoFolder() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}

function savePhoto(body) {
  const sh = sheet('Photos', PHOTO_HEADERS);
  const last = sh.getLastRow();
  if (last > 1) {
    const rows = sh.getRange(2, 1, last - 1, 3).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === body.id) return { ok: true, fileId: rows[i][1], url: rows[i][2] }; // already saved
    }
  }
  const blob = Utilities.newBlob(Utilities.base64Decode(body.data), body.mime || 'image/jpeg', body.id + '.jpg');
  const file = photoFolder().createFile(blob);
  const url = file.getUrl();
  sh.appendRow([body.id, file.getId(), url, new Date()]);
  return { ok: true, fileId: file.getId(), url: url };
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
  const phSh = sheet('Photos', PHOTO_HEADERS);
  const phLast = phSh.getLastRow();
  const photos = phLast > 1 ? phSh.getRange(2, 1, phLast - 1, 3).getValues().map(r => ({ id: String(r[0]), fileId: r[1], url: r[2] })) : [];
  return { ok: true, entries: entries, kv: kv, photos: photos };
}
