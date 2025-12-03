import React, { useState, useEffect } from 'react';
import { Task, TaskType } from './types';
import { processUserCommand } from './services/geminiService';
import TaskCard from './components/TaskCard';
import EmptyState from './components/EmptyState';
import { TASK_TYPES } from './constants';
import { Send, Loader2, Sparkles, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  // State
  // Initialize lazily from local storage to ensure data is available on first render
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTasks = localStorage.getItem('taskmind_tasks');
        if (savedTasks) {
          return JSON.parse(savedTasks);
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
            setTasks(prev => [...prev, response.task!]);
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
          status: t.status === 'pending' ? 'done' : 'pending' as any
        };
      }
      return t;
    }));
  };

  const handleDateChange = (id: string, newDate: string) => {
    const today = new Date().toISOString().split('T')[0];
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

  const handleDelete = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
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
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Pending tasks first
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    
    // 2. If both are done, sort by date descending (most recent first)
    if (a.status === 'done') return b.due_date.localeCompare(a.due_date);

    // 3. Logic for Pending tasks:
    // Check overdue status
    const aOverdue = a.due_date < today;
    const bOverdue = b.due_date < today;

    // Prioritize overdue tasks to the top
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // 4. Finally, sort by date ascending (sooner first)
    return a.due_date.localeCompare(b.due_date);
  });

  const getPlaceholder = () => {
    if (loading) return "Thinking...";
    if (activeFilter?.type) return `Add a ${activeFilter.type} task...`;
    return "Ask me to 'Add a daily workout task'...";
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
             {tasks.filter(t => t.status === 'pending').length} pending
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