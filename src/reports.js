// Report generator + exporters (CSV, real .xlsx via minimal zip writer, Apps Script POST).
import { shiftISO, weekStartISO, monthBounds, sessionsInRange, sumMinutes, minutesByDay } from './log.js';

export const REPORT_VERSION = 1;

function hours(min) {
  return Math.round((min / 60) * 100) / 100;
}
function datesBetween(start, end) {
  const out = [];
  for (let d = start; d <= end; d = shiftISO(d, 1)) out.push(d);
  return out;
}

export function periodBounds(type, anchorIso) {
  if (type === 'month') return monthBounds(anchorIso);
  const start = weekStartISO(anchorIso);
  return { start, end: shiftISO(start, 6) };
}

/**
 * Build the report payload (see docs/REPORT_SCHEMA.md).
 * state needs: subjects (tracks), sessions, tasks.
 */
export function buildReport(state, type = 'week', anchorIso) {
  const { start, end } = periodBounds(type, anchorIso);
  const tracks = state.subjects || [];
  const nameOf = (id) => tracks.find((t) => t.id === id)?.name || '';
  const sessions = sessionsInRange(state.sessions || [], start, end).sort(
    (a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || '')
  );
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T23:59:59`).getTime();
  const tasksAll = state.tasks || [];
  const doneInPeriod = tasksAll.filter((t) => t.completed && t.completedAt && t.completedAt >= startMs && t.completedAt <= endMs);
  const dueInPeriod = tasksAll.filter((t) => !t.completed && t.dueDate && t.dueDate >= start && t.dueDate <= end);
  const taskRows = [...doneInPeriod, ...dueInPeriod].map((t) => ({
    title: t.title,
    track: nameOf(t.subjectId),
    done: !!t.completed,
    due: t.dueDate || null
  }));

  const perTrack = {};
  sessions.forEach((s) => {
    const n = nameOf(s.trackId) || 'Unassigned';
    perTrack[n] = perTrack[n] || { name: n, minutes: 0, sessions: 0 };
    perTrack[n].minutes += s.minutes;
    perTrack[n].sessions += 1;
  });
  const byTrack = Object.values(perTrack).sort((a, b) => b.minutes - a.minutes);

  const perDay = minutesByDay(sessions);
  const daily = datesBetween(start, end).map((date) => ({ date, minutes: perDay[date] || 0 }));

  const weeks = daily.length / 7;
  const goals = tracks
    .filter((t) => t.targetHoursPerWeek > 0)
    .map((t) => {
      const mins = sumMinutes(sessions.filter((s) => s.trackId === t.id));
      // actualHours is normalised to hours per week so it is comparable to the target for both periods
      return { track: t.name, targetHoursPerWeek: t.targetHoursPerWeek, actualHours: hours(mins / weeks) };
    });

  return {
    version: REPORT_VERSION,
    period: { type, start, end },
    totals: { minutes: sumMinutes(sessions), sessions: sessions.length, tasksDone: doneInPeriod.length },
    byTrack,
    daily,
    sessions: sessions.map((s) => ({
      date: s.date,
      start: s.start,
      end: s.end,
      track: nameOf(s.trackId),
      topic: s.topic || '',
      rating: s.rating,
      notes: [s.covered, s.notes].filter(Boolean).join(' | ')
    })),
    tasks: taskRows,
    goals
  };
}

// ---------- CSV ----------

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function reportSheets(r) {
  return [
    {
      name: 'Summary',
      rows: [
        ['ChronoStudy report'],
        ['Period', r.period.type, r.period.start, r.period.end],
        ['Total minutes', r.totals.minutes],
        ['Total hours', hours(r.totals.minutes)],
        ['Sessions', r.totals.sessions],
        ['Tasks done', r.totals.tasksDone]
      ],
      headerRows: [0]
    },
    {
      name: 'By track',
      rows: [['Track', 'Minutes', 'Hours', 'Sessions'], ...r.byTrack.map((t) => [t.name, t.minutes, hours(t.minutes), t.sessions])],
      headerRows: [0]
    },
    { name: 'Daily', rows: [['Date', 'Minutes'], ...r.daily.map((d) => [d.date, d.minutes])], headerRows: [0] },
    {
      name: 'Sessions',
      rows: [
        ['Date', 'Start', 'End', 'Track', 'Topic', 'Rating', 'Notes'],
        ...r.sessions.map((s) => [s.date, s.start, s.end, s.track, s.topic, s.rating, s.notes])
      ],
      headerRows: [0]
    },
    {
      name: 'Tasks',
      rows: [['Title', 'Track', 'Done', 'Due'], ...r.tasks.map((t) => [t.title, t.track, t.done ? 'yes' : 'no', t.due])],
      headerRows: [0]
    },
    {
      name: 'Goals',
      rows: [
        ['Track', 'Target h/week', 'Actual h/week', '% of target'],
        ...r.goals.map((g) => [g.track, g.targetHoursPerWeek, g.actualHours, Math.round((g.actualHours / g.targetHoursPerWeek) * 100)])
      ],
      headerRows: [0]
    }
  ];
}
/** One CSV with titled sections separated by blank lines. */
export function reportToCSV(r) {
  return reportSheets(r)
    .map((sh) => [`# ${sh.name}`, ...sh.rows.map((row) => row.map(csvCell).join(','))].join('\r\n'))
    .join('\r\n\r\n');
}

// ---------- XLSX (stored zip, no deps) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** files: [{name, data: string}] -> Uint8Array zip (method 0 / stored). */
export function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => [v & 255, (v >> 8) & 255];
  const u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  files.forEach((f) => {
    const name = enc.encode(f.name);
    const data = enc.encode(f.data);
    const crc = crc32(data);
    const local = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
    chunks.push(Uint8Array.from(local), name, data);
    central.push(
      Uint8Array.from([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]),
      name
    );
    offset += local.length + name.length + data.length;
  });
  const cdSize = central.reduce((a, c) => a + c.length, 0);
  const end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), 0, 0]);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let p = 0;
  all.forEach((c) => {
    out.set(c, p);
    p += c.length;
  });
  return out;
}

const xe = (s) =>
  String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
function colName(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
function sheetXml(sh) {
  const widths = [];
  sh.rows.forEach((r) => r.forEach((c, i) => (widths[i] = Math.min(60, Math.max(widths[i] || 8, String(c ?? '').length + 2)))));
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rows = sh.rows
    .map((r, ri) => {
      const header = sh.headerRows.includes(ri);
      const cells = r
        .map((c, ci) => {
          if (c == null || c === '') return '';
          const ref = `${colName(ci)}${ri + 1}`;
          const s = header ? ' s="1"' : '';
          return typeof c === 'number' && Number.isFinite(c)
            ? `<c r="${ref}"${s}><v>${c}</v></c>`
            : `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xe(c)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

export function reportToXLSX(r) {
  const sheets = reportSheets(r);
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC85A32"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }))
  ];
  return zipStore(files);
}

// ---------- Delivery ----------

export function reportFilename(r, ext) {
  return `chronostudy-${r.period.type}-${r.period.start}.${ext}`;
}

export function downloadBlob(data, filename, mime) {
  const blob = new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export function isValidAppsScriptUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && /(^|\.)google(usercontent)?\.com$/.test(u.hostname);
  } catch (_) {
    return false;
  }
}

/**
 * POST JSON to an Apps Script web app. Content-Type text/plain avoids a CORS
 * preflight (Apps Script cannot answer OPTIONS). Falls back to an opaque
 * no-cors request if the browser blocks reading the response.
 */
export async function postReportToAppsScript(url, report, fetchImpl = globalThis.fetch) {
  if (!isValidAppsScriptUrl(url)) throw new Error('Not a Google Apps Script web-app URL (https://script.google.com/macros/s/.../exec)');
  const body = JSON.stringify(report);
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, opaque: false, response: text };
  } catch (err) {
    if (err instanceof TypeError) {
      await fetchImpl(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
      return { ok: true, opaque: true, response: '' };
    }
    throw err;
  }
}
