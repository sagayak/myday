import React, { useState, useEffect } from 'react';
import { Task, TaskType, TaskStatus, TaskPriority } from './types';
import { processUserCommand } from './services/geminiService';
import TaskCard from './components/TaskCard';
import EmptyState from './components/EmptyState';
import { TASK_TYPES } from './constants';
import { Send, Loader2, Sparkles, AlertCircle } from 'lucide-react';

// Helper to get local YYYY-MM-DD string to avoid timezone issues with UTC
const getLocalISODate = () => {
  const d = new Date();
  return d.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD in local time
};

const App: React.FC = () => {
  // Recurring logic: Reset Daily, Weekly, and Monthly tasks based on current date
  const checkAndResetRecurringTasks = (currentTasks: Task[]) => {
    const todayStr = getLocalISODate();
    const todayDate = new Date();
    
    // Calculate Monday of the current week
    // Day 0 is Sunday, Day 1 is Monday.
    const currentDay = todayDate.getDay();
    const diffToMonday = todayDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const mondayDate = new Date(todayDate);
    mondayDate.setDate(diffToMonday);
    const thisWeekMondayStr = mondayDate.toLocaleDateString('en-CA');

    // Calculate 1st of the current month
    const thisMonthFirstStr = todayStr.substring(0, 8) + '01';

    let hasChanges = false;

    const updated = currentTasks.map(t => {
      // Ensure priority exists for legacy data
      const safeTask = { ...t, priority: t.priority || 'medium' };

      let newDueDate = safeTask.due_date;
      let shouldReset = false;

      if (safeTask.type === TaskType.DAILY) {
         if (safeTask.due_date < todayStr) {
           newDueDate = todayStr;
           shouldReset = true;
         }
      } else if (safeTask.type === TaskType.WEEKLY) {
         if (safeTask.due_date < thisWeekMondayStr) {
           newDueDate = thisWeekMondayStr;
           shouldReset = true;
         }
      } else if (safeTask.type === TaskType.MONTHLY) {
         if (safeTask.due_date < thisMonthFirstStr) {
           newDueDate = thisMonthFirstStr;
           shouldReset = true;
         }
      }

      if (shouldReset) {
        hasChanges = true;
        return {
          ...safeTask,
          due_date: newDueDate,
          status: TaskStatus.PENDING,
          color: 'green',
          subtasks: safeTask.subtasks?.map(st => ({...st, isCompleted: false}))
        } as Task;
      }

      return safeTask;
    });

    return hasChanges ? updated : updated; // Always return updated to ensure priority defaults
  };

  // Initialize lazily from local storage to ensure data is available on first render
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTasks = localStorage.getItem('taskmind_tasks');
        if (savedTasks) {
          const parsed = JSON.parse(savedTasks);
          return checkAndResetRecurringTasks(parsed);
        }
      } catch (e) {
        console.error("Failed to parse local storage", e);
      }
    }
    return [];
  });

  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{ type?: TaskType, status?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Save to local storage whenever tasks change
  useEffect(() => {
    localStorage.setItem('taskmind_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Listen for visibility changes (e.g. app left open overnight) to trigger recurring reset
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTasks(prev => checkAndResetRecurringTasks(prev));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const command = inputValue;
    setInputValue(''); // Clear immediately for UX
    setLoading(true);
    setErrorMsg(null);

    try {
      // Pass the active filter type as context so the AI knows where we are
      const response = await processUserCommand(command, tasks, activeFilter?.type);

      if (response.error) {
        setErrorMsg(response.error);
        return;
      }

      switch (response.db_action) {
        case 'create':
          if (response.task) {
            let newTask = response.task;
            const today = getLocalISODate();
            
            // Force dates based on type for consistency
            if (newTask.type === TaskType.DAILY) {
                newTask = { ...newTask, due_date: today, status: TaskStatus.PENDING, color: 'green' };
            }
            
            // Ensure priority is set
            if (!newTask.priority) newTask.priority = 'medium';

            setTasks(prev => [...prev, newTask]);
          }
          break;
        
        case 'update':
          if (response.task) {
            setTasks(prev => prev.map(t => t.id === response.task!.id ? response.task! : t));
          }
          break;

        case 'delete':
          if (response.task_id) {
            setTasks(prev => prev.filter(t => t.id !== response.task_id));
          }
          break;

        case 'query':
          if (response.filters) {
            setActiveFilter(response.filters);
          } else {
            setActiveFilter(null); // Show all if query implies "show all"
          }
          break;
      }
    } catch (err) {
      setErrorMsg("Something went wrong processing your request.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: t.status === TaskStatus.PENDING ? TaskStatus.DONE : TaskStatus.PENDING
        };
      }
      return t;
    }));
  };

  const handleDateChange = (id: string, newDate: string) => {
    const today = getLocalISODate();
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          due_date: newDate,
          color: newDate < today ? 'red' : 'green'
        };
      }
      return t;
    }));
  };

  const handlePriorityChange = (id: string, newPriority: TaskPriority) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, priority: newPriority };
      }
      return t;
    }));
  };

  const handleDelete = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddSubtask = (taskId: string, title: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newSubtask = {
          id: crypto.randomUUID(),
          title,
          isCompleted: false
        };
        return { ...t, subtasks: [...(t.subtasks || []), newSubtask] };
      }
      return t;
    }));
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: t.subtasks?.map(st => 
            st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
          )
        };
      }
      return t;
    }));
  };

  // Filter and Sorting Logic
  const filteredTasks = tasks.filter(task => {
    if (!activeFilter) return true;
    
    // Type filter
    if (activeFilter.type && task.type !== activeFilter.type) return false;
    
    // Status filter (mostly implied by queries like "show pending")
    if (activeFilter.status && task.status !== activeFilter.status) return false;

    return true;
  }).sort((a, b) => {
    const today = getLocalISODate();
    
    // 1. Pending tasks first
    if (a.status !== b.status) return a.status === TaskStatus.PENDING ? -1 : 1;
    
    // 2. If both are done, sort by date descending (most recent first)
    if (a.status === TaskStatus.DONE) return b.due_date.localeCompare(a.due_date);

    // 3. Logic for Pending tasks:
    
    // Check overdue
    const aOverdue = a.due_date < today;
    const bOverdue = b.due_date < today;

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Check Priority (High > Medium > Low)
    const priorityWeight: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
    // Safe check in case priority is undefined (legacy data)
    const pA = priorityWeight[a.priority || 'medium'];
    const pB = priorityWeight[b.priority || 'medium'];

    if (pA !== pB) return pB - pA; // Descending weight

    // 4. Finally, sort by date ascending (sooner first)
    return a.due_date.localeCompare(b.due_date);
  });

  const getPlaceholder = () => {
    if (loading) return "Thinking...";
    if (activeFilter?.type) return `Add a ${activeFilter.type} task...`;
    return "Add a task (e.g., 'Urgent buy milk')";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-purple-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-tr from-purple-500 to-blue-500 p-2 rounded-lg shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">TaskMind AI</h1>
          </div>
          
          <div className="text-xs font-mono text-slate-500">
             {tasks.filter(t => t.status === TaskStatus.PENDING).length} pending
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-36 pt-6">
        
        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center text-red-400 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <p className="text-sm">{errorMsg}</p>
            <button 
              onClick={() => setErrorMsg(null)} 
              className="ml-auto text-xs hover:underline opacity-70"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setActiveFilter(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !activeFilter?.type 
                ? 'bg-slate-200 text-slate-900 shadow-md shadow-slate-200/10' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {TASK_TYPES.map(type => {
            const isActive = activeFilter?.type === type.value;
            const colorClass = type.color; 
            
            return (
              <button
                key={type.value}
                onClick={() => setActiveFilter({ type: type.value })}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive 
                    ? `${colorClass} text-white shadow-md` 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        {/* Active Filter Details (e.g. if filtered by Status via NLP) */}
        {activeFilter?.status && (
          <div className="mb-6 flex items-center space-x-2 animate-in fade-in slide-in-from-left-2">
             <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 capitalize">
               Status: {activeFilter.status}
             </span>
            <button 
              onClick={() => setActiveFilter(prev => ({ type: prev?.type }))}
              className="text-xs text-blue-400 hover:text-blue-300 ml-2"
            >
              Clear Status
            </button>
          </div>
        )}

        {/* Task List */}
        <div className="space-y-3">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                onDateChange={handleDateChange}
                onPriorityChange={handlePriorityChange}
                onAddSubtask={handleAddSubtask}
                onToggleSubtask={handleToggleSubtask}
              />
            ))
          ) : (
            <EmptyState message={
              activeFilter?.type 
                ? `No ${activeFilter.type} tasks found. Add one below!` 
                : "Your task list is empty. Ask AI to add one!"
            } />
          )}
        </div>

      </main>

      {/* Sticky Input Area */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-12 pb-safe z-50">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleCommandSubmit}
            className="relative group"
          >
            <div className={`absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl opacity-75 group-hover:opacity-100 transition duration-500 blur ${loading ? 'animate-pulse' : ''}`}></div>
            <div className="relative flex items-center bg-slate-900 rounded-xl p-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full bg-transparent text-slate-100 px-4 py-3.5 outline-none placeholder:text-slate-500"
                disabled={loading}
              />
              <button 
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="p-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </form>
          <p className="text-center text-xs text-slate-600 mt-3 font-mono">
            Powered by Gemini 2.5 Flash
          </p>
        </div>
      </div>

    </div>
  );
};

export default App;