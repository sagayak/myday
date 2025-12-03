// COPY THIS CODE INTO YOUR GOOGLE SHEET -> EXTENSIONS -> APPS SCRIPT

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Assume Row 1 is headers: ID, Title, Type, DueDate, Status, Priority, Subtasks(JSON)
  // If empty, return empty array
  if (data.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const tasks = [];
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Basic mapping based on fixed column order or header name matching
    // Order: id, title, type, due_date, status, priority, subtasks
    
    let subtasks = [];
    try {
      subtasks = row[6] ? JSON.parse(row[6]) : [];
    } catch (e) { subtasks = []; }

    tasks.push({
      id: row[0],
      title: row[1],
      type: row[2],
      due_date: row[3],
      status: row[4],
      priority: row[5],
      subtasks: subtasks,
      // Re-infer color based on date for client-side consistency (optional, handled by client usually)
      color: 'green' 
    });
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: tasks }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  try {
    const body = JSON.parse(e.postData.contents);
    
    if (body.action === 'sync') {
      const tasks = body.tasks;
      
      // Clear existing data (keep headers)
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
      } else {
        // Initialize headers if new sheet
        sheet.getRange(1, 1, 1, 7).setValues([["id", "title", "type", "due_date", "status", "priority", "subtasks"]]);
      }
      
      if (tasks.length > 0) {
        const rows = tasks.map(t => [
          t.id,
          t.title,
          t.type,
          t.due_date,
          t.status,
          t.priority || 'medium',
          JSON.stringify(t.subtasks || [])
        ]);
        
        sheet.getRange(2, 1, rows.length, 7).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}