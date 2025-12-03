import { Task } from '../types';

const SHEET_URL = process.env.GOOGLE_SHEET_URL;

export const storageService = {
  /**
   * Fetches all tasks from the Google Sheet
   */
  async loadTasks(): Promise<Task[]> {
    if (!SHEET_URL) {
      console.warn("GOOGLE_SHEET_URL is not defined.");
      return [];
    }

    try {
      const response = await fetch(SHEET_URL);
      const json = await response.json();
      
      if (json.status === 'success' && Array.isArray(json.data)) {
        return json.data;
      }
      return [];
    } catch (error) {
      console.error("Failed to load tasks from Google Sheet:", error);
      return [];
    }
  },

  /**
   * Syncs the current state of tasks to the Google Sheet (Overwrite)
   */
  async saveTasks(tasks: Task[]): Promise<boolean> {
    if (!SHEET_URL) return false;

    try {
      // We use 'no-cors' mode or text/plain content type to avoid CORS preflight issues 
      // with simple Google Apps Script web apps.
      // However, to get a response, we usually need standard POST. 
      // If your GAS is set to "Anyone", standard fetch usually works if the script handles OPTIONS or we use this hack:
      
      const payload = JSON.stringify({
        action: 'sync',
        tasks: tasks
      });

      await fetch(SHEET_URL, {
        method: 'POST',
        // Using text/plain prevents the browser from sending an OPTIONS preflight request
        // which Google Apps Script doesn't handle natively.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload
      });
      
      return true;
    } catch (error) {
      console.error("Failed to save tasks to Google Sheet:", error);
      return false;
    }
  }
};