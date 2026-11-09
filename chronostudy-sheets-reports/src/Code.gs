/**
 * ChronoStudy Google Sheets Report Generator (Apps Script)
 * Receives JSON report payloads from ChronoStudy Web, StudyLog, Termux, or Python local app.
 */

function doPost(e) {
  try {
    const raw = e.postData.contents;
    const payload = JSON.parse(raw);
    
    // Optional secret token verification
    const expectedToken = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (expectedToken && e.parameter.token !== expectedToken && payload.token !== expectedToken) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized: invalid token' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const result = renderReportToSpreadsheet(ss, payload);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, tab: result.tabName }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    service: 'ChronoStudy Google Sheets Report Webhook',
    status: 'Ready to receive POST reports'
  })).setMimeType(ContentService.MimeType.JSON);
}

function renderReportToSpreadsheet(ss, payload) {
  const p = payload.period || {};
  const tabName = p.type === 'month' ? `Month ${p.start.slice(0, 7)}` : `Week ${p.start}`;
  
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
  } else {
    sheet.clear();
  }

  sheet.setTabColor('#2B4C7E');

  // Title Banner
  sheet.getRange('A1:G1').merge();
  const banner = sheet.getRange('A1');
  banner.setValue(`📊 ChronoStudy Report: ${tabName}`);
  banner.setFontSize(16).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#2B4C7E');
  banner.setHorizontalAlignment('center');
  sheet.setRowHeight(1, 40);

  // KPIs
  const totals = payload.totals || {};
  const kpiData = [
    ['Metric', 'Value'],
    ['Start Date', p.start || ''],
    ['End Date', p.end || ''],
    ['Total Focus Time', `${Math.round(((totals.minutes || 0) / 60) * 10) / 10} hrs (${totals.minutes || 0} mins)`],
    ['Completed Sessions', totals.sessions || 0],
    ['Tasks Finished', totals.tasksDone || 0]
  ];
  sheet.getRange(3, 1, kpiData.length, 2).setValues(kpiData);
  sheet.getRange('A3:B3').setFontWeight('bold').setBackground('#EAEFF8');

  // By-Track Summary Table
  let row = 11;
  sheet.getRange(row, 1).setValue('🎯 Focus Time by Track / Subject').setFontSize(12).setFontWeight('bold');
  row++;
  sheet.getRange(row, 1, 1, 4).setValues([['Track / Subject', 'Hours', 'Minutes', 'Sessions']]);
  sheet.getRange(row, 1, 1, 4).setFontWeight('bold').setBackground('#EAEFF8');
  row++;

  const tracks = payload.byTrack || [];
  if (tracks.length > 0) {
    const trackRows = tracks.map(t => [t.name, Math.round(((t.minutes || 0) / 60) * 10) / 10, t.minutes, t.sessions]);
    sheet.getRange(row, 1, trackRows.length, 4).setValues(trackRows);
    row += trackRows.length + 2;
  } else {
    sheet.getRange(row, 1).setValue('No track data recorded');
    row += 2;
  }

  // Daily Heat Strip
  sheet.getRange(row, 1).setValue('📅 Daily Minutes Breakdown').setFontSize(12).setFontWeight('bold');
  row++;
  sheet.getRange(row, 1, 1, 3).setValues([['Date', 'Hours', 'Minutes']]);
  sheet.getRange(row, 1, 1, 3).setFontWeight('bold').setBackground('#EAEFF8');
  row++;

  const daily = payload.daily || [];
  if (daily.length > 0) {
    const dailyRows = daily.map(d => [d.date, Math.round(((d.minutes || 0) / 60) * 10) / 10, d.minutes]);
    sheet.getRange(row, 1, dailyRows.length, 3).setValues(dailyRows);
    row += dailyRows.length + 2;
  } else {
    sheet.getRange(row, 1).setValue('No daily focus recorded');
    row += 2;
  }

  // Sessions Log Table
  sheet.getRange(row, 1).setValue('⏱️ Detailed Sessions Log').setFontSize(12).setFontWeight('bold');
  row++;
  sheet.getRange(row, 1, 1, 7).setValues([['Date', 'Start', 'End', 'Track', 'Topic / Notes', 'Focus Rating', 'Reflection']]);
  sheet.getRange(row, 1, 1, 7).setFontWeight('bold').setBackground('#EAEFF8');
  row++;

  const sessions = payload.sessions || [];
  if (sessions.length > 0) {
    const sessionRows = sessions.map(s => [
      s.date,
      s.start || '',
      s.end || '',
      s.track || '',
      s.topic || '',
      s.rating ? `${s.rating}★` : '',
      s.notes || ''
    ]);
    sheet.getRange(row, 1, sessionRows.length, 7).setValues(sessionRows);
    row += sessionRows.length + 2;
  } else {
    sheet.getRange(row, 1).setValue('No session records');
    row += 2;
  }

  // Auto-fit columns
  for (let c = 1; c <= 7; c++) {
    sheet.autoResizeColumn(c);
  }

  return { tabName };
}
