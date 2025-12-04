// COPY THIS CODE INTO YOUR GOOGLE SHEET -> EXTENSIONS -> APPS SCRIPT

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    
    // Assume Row 1 is headers. If empty or just headers, return empty array
    if (data.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const tasks = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Skip empty rows
      if (!row[0]) continue;

      let subtasks = [];
      try {
        // Column 7 (Index 6) is subtasks
        subtasks = row[6] ? JSON.parse(row[6]) : [];
      } catch (e) { subtasks = []; }

      // STRICT DATE SANITIZATION
      // Google Sheets often returns Date objects for date cells.
      // We must format them strictly to YYYY-MM-DD.
      let rawDate = row[3];
      let cleanDate = "";
      
      if (Object.prototype.toString.call(rawDate) === '[object Date]') {
        // It's a real Date object, format it using Apps Script Utilities
        // Use the script's timezone (usually matches the sheet)
        cleanDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        // It's a string, just take the first 10 chars (YYYY-MM-DD)
        cleanDate = String(rawDate).substring(0, 10);
      }

      tasks.push({
        id: String(row[0]),
        title: String(row[1]),
        type: String(row[2]),
        due_date: cleanDate,
        status: String(row[4]),
        priority: String(row[5] || 'medium'),
        subtasks: subtasks,
        color: 'green' // Client will recalculate this based on date
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: tasks }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Parse body safely
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
       return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON body' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (body.action === 'sync') {
      const tasks = body.tasks;
      
      // Clear existing data (keep headers)
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      }
      
      // Ensure headers exist if completely new sheet
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, 7).setValues([["id", "title", "type", "due_date", "status", "priority", "subtasks"]]);
      }
      
      if (tasks && tasks.length > 0) {
        const rows = tasks.map(t => [
          t.id,
          t.title,
          t.type,
          // Ensure we only save YYYY-MM-DD back to the sheet too
          (t.due_date || "").substring(0, 10),
          t.status,
          t.priority || 'medium',
          JSON.stringify(t.subtasks || [])
        ]);
        
        sheet.getRange(2, 1, rows.length, 7).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}