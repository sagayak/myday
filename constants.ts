import { TaskType } from './types';

export const TASK_TYPES = [
  { value: TaskType.DAILY, label: 'Daily', color: 'bg-blue-500' },
  { value: TaskType.WEEKLY, label: 'Weekly', color: 'bg-purple-500' },
  { value: TaskType.MONTHLY, label: 'Monthly', color: 'bg-orange-500' },
  { value: TaskType.ONETIME, label: 'One-time', color: 'bg-pink-500' },
];
