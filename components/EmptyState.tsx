import React from 'react';
import { Layers } from 'lucide-react';

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center px-4">
    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
      <Layers className="w-8 h-8 text-slate-500" />
    </div>
    <h3 className="text-xl font-medium text-slate-300 mb-2">No tasks found</h3>
    <p className="text-slate-500 max-w-sm">
      {message}
    </p>
  </div>
);

export default EmptyState;
