import React, { useState, useEffect } from 'react';
import { Task, TaskType, TaskStatus, TaskPriority } from './types';
import { processUserCommand } from './services/geminiService';
import { storageService } from './services/storageService';
import TaskCard from './components/TaskCard';
import EmptyState from './components/EmptyState';
import { TASK_TYPES } from './constants';
import { Send, Loader2, Sparkles, AlertCircle, Bell, BellOff, RefreshCw, Database } from 'lucide-react';

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

    return updated; 
  };

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{ type?: TaskType, status?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [sheetConfigured, setSheetConfigured] = useState(true);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // INITIAL LOAD FROM GOOGLE SHEETS
  useEffect(() => {
    async function initData() {
      if (!process.env.GOOGLE_SHEET_URL) {
        setSheetConfigured(false);
        setErrorMsg("Please set GOOGLE_SHEET_URL in your environment variables.");
        return;
      }

      setIsSyncing(true);
      const serverTasks = await storageService.loadTasks();
      
      // Run recurring logic on the fresh data
      const processedTasks = checkAndResetRecurringTasks(serverTasks);
      
      setTasks(processedTasks);
      setIsHydrated(true);
      setIsSyncing(false);
      checkAndSendNotifications(processedTasks);
    }

    initData();
  }, []);

  // SYNC TO GOOGLE SHEETS ON CHANGE
  // Debounce slightly to avoid hammering the sheet on rapid typing/clicking
  useEffect(() => {
    if (!isHydrated) return;

    const timeoutId = setTimeout(async () => {
      setIsSyncing(true);
      await storageService.saveTasks(tasks);
      setIsSyncing(false);
    }, 2000); // 2 second delay to batch rapid changes

    return () => clearTimeout(timeoutId);
  }, [tasks, isHydrated]);

  // Check for due tasks and notify
  const checkAndSendNotifications = (currentTasks: Task[]) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const today = getLocalISODate();
    const lastNotifiedDate = localStorage.getItem('taskmind_last_notified');

    if (lastNotifiedDate === today) return;

    const dueTasks = currentTasks.filter(t => t.status === TaskStatus.PENDING && t.due_date === today);

    if (dueTasks.length > 0) {
      const title = dueTasks.length === 1 
        ? `Task Due: ${dueTasks[0].title}`
        : `You have ${dueTasks.length} tasks due today`;
      
      const body = dueTasks.length === 1
        ? `Priority: ${dueTasks[0].priority || 'medium'}`
        : dueTasks.map(t => t.title).join(', ');

      new Notification("TaskMind AI", {
        body: body,
        icon: '/manifest-icon-192.maskable.png'
      });

      localStorage.setItem('taskmind_last_notified', today);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission === 'granted') {
      checkAndSendNotifications(tasks);
    }
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const command = inputValue;
    setInputValue('');
    setLoading(true);
    setErrorMsg(null);

    try {
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
            if (newTask.type === TaskType.DAILY) {
                newTask = { ...newTask, due_date: today, status: TaskStatus.PENDING, color: 'green' };
            }
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
            setActiveFilter(null);
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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, priority: newPriority } : t));
  };

  const handleDelete = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddSubtask = (taskId: string, title: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newSubtask = { id: crypto.randomUUID(), title, isCompleted: false };
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
          subtasks: t.subtasks?.map(st => st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st)
        };
      }
      return t;
    }));
  };

  // Sort tasks
  const filteredTasks = tasks.filter(task => {
    if (!activeFilter) return true;
    if (activeFilter.type && task.type !== activeFilter.type) return false;
    if (activeFilter.status && task.status !== activeFilter.status) return false;
    return true;
  }).sort((a, b) => {
    const today = getLocalISODate();
    
    // 1. Pending tasks always before Done tasks
    if (a.status !== b.status) return a.status === TaskStatus.PENDING ? -1 : 1;
    
    // 2. Done tasks: Sort by date descending
    if (a.status === TaskStatus.DONE) return b.due_date.localeCompare(a.due_date);

    // Common Priority calculation
    const priorityWeight: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };
    const pA = priorityWeight[a.priority || 'medium'];
    const pB = priorityWeight[b.priority || 'medium'];

    // 3. Special Logic for One-Time Tasks: Priority > Due Date
    // If we are comparing two One-Time tasks (e.g. in One-Time view),
    // we strictly follow Priority > Date, ignoring the "Overdue" grouping.
    const isOneTimeComparison = a.type === TaskType.ONETIME && b.type === TaskType.ONETIME;

    if (isOneTimeComparison) {
      if (pA !== pB) return pB - pA; // High priority first
      return a.due_date.localeCompare(b.due_date); // Earliest date next
    }

    // 4. Default Logic (Daily, Weekly, Monthly, or Mixed types)
    
    // Overdue items check
    const aOverdue = a.due_date < today;
    const bOverdue = b.due_date < today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Priority
    if (pA !== pB) return pB - pA;

    // Due Date
    return a.due_date.localeCompare(b.due_date);
  });

  const getPlaceholder = () => {
    if (loading) return "Thinking...";
    if (activeFilter?.type) return `Add a ${activeFilter.type} task...`;
    return "Add a task (e.g., 'Urgent buy milk')";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-purple-500/30">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-tr from-purple-500 to-blue-500 p-2 rounded-lg shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">TaskMind AI</h1>
          </div>
          
          <div className="flex items-center space-x-4">
             {/* Sync Status Indicator */}
             {sheetConfigured && (
               <div className="flex items-center space-x-1.5" title={isSyncing ? "Saving to Google Sheet..." : "Synced with Google Sheet"}>
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 hidden sm:block">
                    {isSyncing ? 'Syncing' : 'Synced'}
                  </span>
               </div>
             )}

             <button
               onClick={requestNotificationPermission}
               className={`p-2 rounded-full transition-colors ${notificationsEnabled ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 hover:text-slate-300'}`}
             >
               {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-36 pt-6">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center text-red-400 animate-in fade-in">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            <p className="text-sm">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="ml-auto text-xs hover:underline opacity-70">Dismiss</button>
          </div>
        )}
        
        {!sheetConfigured && (
           <div className="mb-6 p-6 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
              <h3 className="text-blue-300 font-semibold mb-2">Google Sheet Setup Required</h3>
              <p className="text-sm text-blue-200/70 mb-4">
                To enable task persistence, create a Google Sheet, deploy the provided Apps Script, and add the URL to your environment variables as <code>GOOGLE_SHEET_URL</code>.
              </p>
           </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setActiveFilter(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !activeFilter?.type ? 'bg-slate-200 text-slate-900 shadow-md' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {TASK_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => setActiveFilter({ type: type.value })}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeFilter?.type === type.value ? `${type.color} text-white shadow-md` : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {!isHydrated && sheetConfigured ? (
             <div className="flex justify-center py-20">
               <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
             </div>
          ) : filteredTasks.length > 0 ? (
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
            <EmptyState message={activeFilter?.type ? `No ${activeFilter.type} tasks found.` : "Your task list is empty."} />
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-12 pb-safe z-50">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleCommandSubmit} className="relative group">
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
                className="p-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </form>
          <p className="text-center text-xs text-slate-600 mt-3 font-mono">Powered by Gemini 2.5 Flash</p>
        </div>
      </div>
    </div>
  );
};

export default App;