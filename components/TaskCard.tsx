import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { CheckCircle2, Circle, Trash2, Calendar, Plus, ChevronDown, ChevronRight, Flag } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onDateChange: (id: string, newDate: string) => void;
  onPriorityChange: (id: string, newPriority: TaskPriority) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onToggleStatus, 
  onDelete, 
  onDateChange,
  onPriorityChange,
  onAddSubtask,
  onToggleSubtask
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);

  const isDone = task.status === TaskStatus.DONE;
  
  // Recalculate overdue status dynamically using Local Time
  const today = new Date().toLocaleDateString('en-CA');
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

  const priorityColorMap: Record<TaskPriority, string> = {
    high: 'text-red-400 bg-red-400/10 border-red-400/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    low: 'text-blue-400 bg-blue-400/10 border-blue-400/20'
  };

  const handleSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      onAddSubtask(task.id, newSubtaskTitle);
      setNewSubtaskTitle('');
      setShowSubtaskInput(false);
    }
  };

  const cyclePriority = () => {
    const map: Record<TaskPriority, TaskPriority> = {
      high: 'low',
      medium: 'high',
      low: 'medium'
    };
    onPriorityChange(task.id, map[task.priority || 'medium']); // Default to medium if missing
  };

  return (
    <div className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${statusClasses}`}>
      <div className="flex items-start w-full">
        <button 
          onClick={() => onToggleStatus(task.id)}
          className="mt-1 mr-4 text-slate-400 hover:text-emerald-400 transition-colors focus:outline-none flex-shrink-0"
        >
          {isDone ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          ) : (
            <Circle className="w-6 h-6" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {/* Title - Removed truncate, added break-words */}
            <h3 className={`text-lg font-medium break-words whitespace-pre-wrap pr-2 ${isDone ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
              {task.title}
            </h3>
            
            {/* Metadata Badges - Right aligned */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0 mt-1">
              <div className="flex items-center gap-1.5">
                {/* Priority Badge - Click to cycle */}
                {!isDone && (
                  <button
                    onClick={cyclePriority}
                    className={`flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider transition-all hover:opacity-80 ${priorityColorMap[task.priority || 'medium']}`}
                    title="Click to change priority"
                  >
                     <Flag className="w-3 h-3 mr-1" fill="currentColor" />
                     {task.priority || 'MED'}
                  </button>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${typeColorMap[task.type] || 'text-slate-400'}`}>
                  {task.type}
                </span>
              </div>
            </div>
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

            {/* Subtask toggle if subtasks exist */}
            {task.subtasks && task.subtasks.length > 0 && (
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center text-xs hover:text-white transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronRight className="w-3 h-3 mr-1" />}
                {task.subtasks.filter(st => st.isCompleted).length}/{task.subtasks.length} subtasks
              </button>
            )}
          </div>
        </div>

        <button 
          onClick={() => onDelete(task.id)}
          className="ml-2 p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all focus:opacity-100 self-start mt-1"
          aria-label="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Subtasks Section */}
      <div className={`mt-3 pl-10 w-full transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        
        {/* List existing subtasks */}
        {task.subtasks?.map(subtask => (
          <div key={subtask.id} className="flex items-center py-1.5 group/sub">
             <button
                onClick={() => onToggleSubtask(task.id, subtask.id)}
                className="mr-3 text-slate-500 hover:text-emerald-400 transition-colors focus:outline-none"
             >
                {subtask.isCompleted ? (
                   <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
                ) : (
                   <Circle className="w-4 h-4" />
                )}
             </button>
             <span className={`text-sm break-words flex-1 ${subtask.isCompleted ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
               {subtask.title}
             </span>
          </div>
        ))}

        {/* Add Subtask Input */}
        {showSubtaskInput ? (
          <form onSubmit={handleSubtaskSubmit} className="mt-2 flex items-center">
            <Circle className="w-4 h-4 text-slate-600 mr-3 dashed flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onBlur={() => !newSubtaskTitle && setShowSubtaskInput(false)}
              placeholder="Subtask name..."
              className="bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600 w-full"
            />
          </form>
        ) : (
          !isDone && (
            <button
              onClick={() => setShowSubtaskInput(true)}
              className="mt-2 flex items-center text-xs text-slate-500 hover:text-blue-400 transition-colors"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add subtask
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default TaskCard;