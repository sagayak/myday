import React from 'react';
import { Task, TaskStatus } from '../types';
import { CheckCircle2, Circle, Trash2, Calendar, Clock } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggleStatus, onDelete }) => {
  const isDone = task.status === TaskStatus.DONE;
  
  // Dynamic border color based on task logic
  const statusColor = isDone 
    ? 'border-slate-700 bg-slate-800/50' 
    : task.color === 'red' 
      ? 'border-red-500/50 bg-slate-800' 
      : 'border-emerald-500/50 bg-slate-800';

  const typeColorMap: Record<string, string> = {
    daily: 'text-blue-400 bg-blue-400/10',
    weekly: 'text-purple-400 bg-purple-400/10',
    monthly: 'text-orange-400 bg-orange-400/10',
    onetime: 'text-pink-400 bg-pink-400/10'
  };

  return (
    <div className={`group relative flex items-start p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${statusColor}`}>
      <button 
        onClick={() => onToggleStatus(task.id)}
        className="mt-1 mr-4 text-slate-400 hover:text-emerald-400 transition-colors focus:outline-none"
      >
        {isDone ? (
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
        ) : (
          <Circle className="w-6 h-6" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-lg font-medium truncate pr-2 ${isDone ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
            {task.title}
          </h3>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${typeColorMap[task.type] || 'text-slate-400'}`}>
            {task.type}
          </span>
        </div>
        
        <div className="flex items-center mt-2 space-x-4 text-sm text-slate-400">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1.5 opacity-70" />
            <span className={task.color === 'red' && !isDone ? 'text-red-400 font-medium' : ''}>
              {task.due_date}
            </span>
          </div>
          {task.color === 'red' && !isDone && (
            <div className="flex items-center text-red-400 text-xs font-medium bg-red-400/10 px-2 py-0.5 rounded">
              Overdue
            </div>
          )}
        </div>
      </div>

      <button 
        onClick={() => onDelete(task.id)}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all focus:opacity-100"
        aria-label="Delete task"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export default TaskCard;
