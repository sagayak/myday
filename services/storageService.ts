import { Task } from '../types';

const SHEET_URL = process.env.GOOGLE_SHEET_URL;

export const storageService = {
  /**
   * Fetches all tasks from the Google Sheet
   * Throws an error if fetching fails, so the App knows not to hydrate empty data.
   */
  async loadTasks(): Promise<Task[]> {
    if (!SHEET_URL) {
      throw new Error("GOOGLE_SHEET_URL is not defined in environment variables.");
    }

    try {
      // Append timestamp to prevent aggressive browser caching of GAS responses
      const url = `${SHEET_URL}?t=${Date.now()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow', // Important for GAS web apps
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error("Received invalid JSON from Sheet:", text);
        throw new Error("Invalid response from Google Sheet. Check script deployment.");
      }
      
      if (json.status === 'success' && Array.isArray(json.data)) {
        return json.data;
      } else if (json.status === 'error') {
        throw new Error(json.message || "Unknown error from Google Sheet script");
      }
      
      return [];
    } catch (error) {
      console.error("Failed to load tasks from Google Sheet:", error);
      throw error; // Re-throw so App.tsx can show the error UI
    }
  },

  /**
   * Syncs the current state of tasks to the Google Sheet (Overwrite)
   */
  async saveTasks(tasks: Task[]): Promise<boolean> {
    if (!SHEET_URL) return false;

    try {
      const payload = JSON.stringify({
        action: 'sync',
        tasks: tasks
      });

      // We use text/plain to avoid CORS preflight (OPTIONS) requests which GAS doesn't handle well
      await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        redirect: 'follow'
      });
      
      return true;
    } catch (error) {
      console.error("Failed to save tasks to Google Sheet:", error);
      return false;
    }
  }
};