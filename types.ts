export enum TaskType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ONETIME = 'onetime'
}

export enum TaskStatus {
  PENDING = 'pending',
  DONE = 'done'
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  due_date: string; // YYYY-MM-DD
  status: TaskStatus;
  color: 'red' | 'green';
}

export type DbAction = 'create' | 'update' | 'delete' | 'query';

export interface ActionResponse {
  db_action: DbAction;
  task?: Task; // For create/update
  task_id?: string; // For delete
  filters?: {
    type?: TaskType;
    status?: TaskStatus;
  }; // For query
  error?: string; // Internal use
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
}