import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION_TEMPLATE } from '../constants';
import { Task, ActionResponse } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const processUserCommand = async (
  userText: string,
  currentTasks: Task[],
  activeContextType?: string | null
): Promise<ActionResponse> => {
  try {
    const ai = getClient();
    
    // Prepare context for the model
    const today = new Date().toISOString().split('T')[0];
    const taskSummary = currentTasks.map(t => `ID: ${t.id}, Title: "${t.title}"`).join('\n');
    
    const contextMsg = activeContextType 
      ? `User is currently looking at "${activeContextType}" tasks.` 
      : "User is viewing all tasks.";

    const systemInstruction = SYSTEM_INSTRUCTION_TEMPLATE
      .replace('{{CURRENT_DATE}}', today)
      .replace('{{EXISTING_TASKS_SUMMARY}}', taskSummary || "No tasks currently.")
      .replace('{{ACTIVE_VIEW_CONTEXT}}', contextMsg);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            db_action: { type: Type.STRING, enum: ["create", "update", "delete", "query"] },
            task: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["daily", "weekly", "monthly", "onetime"] },
                due_date: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["pending", "done"] },
                color: { type: Type.STRING, enum: ["red", "green"] },
              }
            },
            task_id: { type: Type.STRING },
            filters: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["daily", "weekly", "monthly", "onetime"] },
                status: { type: Type.STRING, enum: ["pending", "done"] }
              }
            }
          },
          required: ["db_action"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ActionResponse;
    }
    
    throw new Error("Empty response from AI");

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      db_action: 'query', // Fallback
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
};