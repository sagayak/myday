import React from 'react';
import { Task, TaskStatus } from '../types';
import { CheckCircle2, Circle, Trash2, Calendar } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onDateChange: (id: string, newDate: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onToggleStatus, onDelete, onDateChange }) => {
  const isDone = task.status === TaskStatus.DONE;
  
  // Recalculate overdue status dynamically for immediate feedback
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = task.due_date < today && !isDone;
  
  // Dynamic border and background
  const statusClasses = isDone 
    ? 'border-slate-700 bg-slate-800/50' 
    : isOverdue
      ? 'border-red-500/50 bg-slate-900 shadow-[0_0_15px_-3px_rgba(239,68,68,0.15)]' 
      : 'border-emerald-500/50 bg-slate-800';

  const typeColorMap: Record<string, string> = {
    daily: 'text-blue-400 bg-blue-400/10',
    weekly: 'text-purple-400 bg-purple-400/10',
    monthly: 'text-orange-400 bg-orange-400/10',
    onetime: 'text-pink-400 bg-pink-400/10'
  };

  return (
    <div className={`group relative flex items-start p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${statusClasses}`}>
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
          <div className={`relative flex items-center group/date ${task.type !== 'daily' ? 'cursor-pointer hover:text-slate-200' : ''}`}>
            <Calendar className={`w-4 h-4 mr-1.5 opacity-70 ${isOverdue ? 'text-red-400' : ''}`} />
            
            <span className={isOverdue ? 'text-red-400 font-medium' : ''}>
              {task.due_date}
            </span>

            {/* Date Picker Input - Only for non-daily tasks */}
            {task.type !== 'daily' && !isDone && (
              <input 
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                value={task.due_date}
                onChange={(e) => onDateChange(task.id, e.target.value)}
              />
            )}
            
            {task.type !== 'daily' && !isDone && (
              <span className="ml-1.5 text-[10px] bg-slate-700 px-1 rounded opacity-0 group-hover/date:opacity-100 transition-opacity">
                Edit
              </span>
            )}
          </div>

          {isOverdue && (
            <div className="flex items-center text-red-400 text-xs font-medium bg-red-400/10 px-2 py-0.5 rounded animate-pulse">
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