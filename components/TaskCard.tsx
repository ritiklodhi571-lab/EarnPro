
import React from 'react';
import { Task, TaskStatus } from '../types';
import { APP_CONFIG } from '../constants';

interface TaskCardProps {
  task: Task;
  status?: TaskStatus;
  isSaved: boolean;
  onToggleSave: (taskId: string) => void;
  onClick: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, status, isSaved, onToggleSave, onClick }) => {
  const isCompleted = status === TaskStatus.APPROVED || status === TaskStatus.PENDING;

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSave(task.id);
  };

  return (
    <div 
      onClick={() => !isCompleted && onClick(task)}
      className={`relative bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all active:scale-[0.98] ${isCompleted ? 'opacity-70 grayscale' : 'cursor-pointer hover:border-blue-200'}`}
    >
      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 flex-shrink-0">
        <img src={task.imageUrl} alt={task.title} className="w-full h-full object-cover" />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-slate-800 text-sm truncate">{task.title}</h4>
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{task.category}</p>
        {isCompleted && (
          <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase mt-1 inline-block ${status === TaskStatus.APPROVED ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
            {status}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-green-500 text-white px-3 py-1.5 rounded-xl shadow-sm shadow-green-100">
           <span className="font-black text-sm">{APP_CONFIG.CURRENCY_SYMBOL}{task.price}</span>
        </div>
        
        <button 
          onClick={handleHeartClick}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isSaved ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-300 hover:text-rose-400'}`}
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </button>
      </div>
    </div>
  );
};

export default TaskCard;
