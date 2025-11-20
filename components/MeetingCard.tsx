
import React from 'react';
import { Meeting } from '../types';
import { TrashIcon } from './Icons';

interface MeetingCardProps {
  meeting: Meeting;
  globalUrl: string;
  onSelect: (id: number) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({ meeting, globalUrl, onSelect, onDelete }) => {
  const hasGlobal = !meeting.googleFormUrl && globalUrl;
  const dateObj = new Date(meeting.fecha);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
  const year = dateObj.getFullYear();

  return (
    <div 
      onClick={() => onSelect(meeting.id)}
      className="group relative bg-white rounded-2xl shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full hover:-translate-y-1"
    >
      {/* Colored top accent */}
      <div className="h-2 w-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>

      <div className="p-6 flex flex-col h-full relative">
        {/* Delete Button (Hover Only) */}
        <button
            onClick={(e) => onDelete(e, meeting.id)}
            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
            title="Eliminar Reunión"
        >
            <TrashIcon className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 mb-4">
            {/* Date Box */}
            <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-2 min-w-[60px] shadow-inner">
                <span className="text-xs font-bold text-slate-400">{month}</span>
                <span className="text-2xl font-bold text-indigo-600 leading-none my-0.5">{day}</span>
                <span className="text-[10px] text-slate-400">{year}</span>
            </div>
            
            <div className="flex-1 min-w-0 pt-1">
                <h3 className="font-bold text-lg text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                    {meeting.nombre}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                     <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200 flex items-center gap-1">
                        ⏰ {meeting.hora}
                     </span>
                     {(meeting.googleFormUrl || hasGlobal) && (
                        <span className={`w-2 h-2 rounded-full ${meeting.googleFormUrl ? 'bg-green-500' : 'bg-blue-400'}`} title="Formulario vinculado"></span>
                     )}
                </div>
            </div>
        </div>
      
        {meeting.descripcion && (
            <p className="text-slate-500 text-sm mb-6 line-clamp-2 leading-relaxed flex-grow">
            {meeting.descripcion}
            </p>
        )}

        <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center">
            <div className="text-xs text-slate-400 font-medium">
               {meeting.googleFormUrl ? 'Link Personalizado' : 'Link Estándar'}
            </div>
            <span className="text-indigo-600 text-sm font-semibold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                Gestionar <span className="text-lg leading-none">›</span>
            </span>
        </div>
      </div>
    </div>
  );
};

export default MeetingCard;
