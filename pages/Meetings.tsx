
import React, { useState, useEffect } from 'react';
import { Meeting } from '../types';
import { getMeetings, saveMeeting, deleteMeeting, getGlobalFormUrl, getFormEntryId } from '../services/storageService';
import { PlusIcon, CalendarIcon, TrashIcon, SparklesIcon } from '../components/Icons';
import MeetingDetails from './MeetingDetails';
import MeetingCard from '../components/MeetingCard';

interface Props {
  onMeetingSelect?: (id: number | null) => void;
}

const Meetings: React.FC<Props> = ({ onMeetingSelect }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [newMeeting, setNewMeeting] = useState({ nombre: '', fecha: '', hora: '', descripcion: '', googleFormUrl: '' });
  const [globalUrl, setGlobalUrl] = useState('');
  const [hasAutoLink, setHasAutoLink] = useState(false);

  useEffect(() => {
    loadMeetings();
    const gUrl = getGlobalFormUrl();
    const entryId = getFormEntryId();
    setGlobalUrl(gUrl);
    setHasAutoLink(!!(gUrl && entryId));
  }, []);

  const loadMeetings = () => {
    const data = getMeetings().sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    setMeetings(data);
  };

  const handleSelectMeeting = (id: number | null) => {
    setSelectedMeetingId(id);
    if (onMeetingSelect) {
      onMeetingSelect(id);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMeeting.nombre || !newMeeting.fecha || !newMeeting.hora) return;
    saveMeeting(newMeeting);
    setNewMeeting({ nombre: '', fecha: '', hora: '', descripcion: '', googleFormUrl: '' });
    setShowModal(false);
    loadMeetings();
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de eliminar esta reunión y sus registros de asistencia?')) {
      deleteMeeting(id);
      if (selectedMeetingId === id) {
        handleSelectMeeting(null);
      }
      loadMeetings();
    }
  };

  if (selectedMeetingId) {
    return <MeetingDetails meetingId={selectedMeetingId} onBack={() => handleSelectMeeting(null)} />;
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4 animate-entrance">
        <div>
          <h1 className="text-4xl font-bold text-slate-800 flex items-center gap-3 tracking-tight">
            <span className="bg-indigo-100 p-2 rounded-xl text-indigo-600"><CalendarIcon className="w-8 h-8" /></span>
            Gestión de Reuniones
          </h1>
          <p className="text-slate-500 text-lg mt-2 ml-1">Programa eventos y controla la asistencia del personal.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Reunión
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {meetings.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white/50 rounded-3xl border-2 border-dashed border-slate-200 animate-scale-in">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <CalendarIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">No hay reuniones programadas</h3>
            <p className="text-slate-500 mt-2 mb-6">Comienza creando tu primer evento escolar.</p>
            <button onClick={() => setShowModal(true)} className="text-indigo-600 font-medium hover:underline">Crear ahora</button>
          </div>
        ) : (
          meetings.map((meeting, idx) => (
            <div key={meeting.id} className={`animate-entrance delay-${(idx % 5) * 100}`}>
                <MeetingCard 
                meeting={meeting}
                globalUrl={globalUrl}
                onSelect={handleSelectMeeting}
                onDelete={handleDelete}
                />
            </div>
          ))
        )}
      </div>

      {/* Modal with Backdrop Blur */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in transform transition-all">
            <div className="bg-indigo-600 px-6 py-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
              <h2 className="text-xl font-bold text-white relative z-10">Programar Reunión</h2>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre del Evento</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                  value={newMeeting.nombre}
                  onChange={(e) => setNewMeeting({ ...newMeeting, nombre: e.target.value })}
                  placeholder="Ej. Consejo Técnico"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha</label>
                    <input
                    type="date"
                    required
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                    value={newMeeting.fecha}
                    onChange={(e) => setNewMeeting({ ...newMeeting, fecha: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hora</label>
                    <input
                    type="time"
                    required
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                    value={newMeeting.hora}
                    onChange={(e) => setNewMeeting({ ...newMeeting, hora: e.target.value })}
                    />
                </div>
              </div>
              
              {/* Smart Link Section */}
              <div className={`p-4 rounded-xl border transition-all ${hasAutoLink ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                  <label className="flex justify-between items-center text-xs font-bold uppercase tracking-wider mb-1.5">
                      <span className={hasAutoLink ? 'text-green-800' : 'text-slate-500'}>Link del Formulario</span>
                      {hasAutoLink && <span className="text-[10px] bg-green-200 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">✨ Automático</span>}
                  </label>
                  <input
                    type="url"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white placeholder:text-slate-300"
                    value={newMeeting.googleFormUrl}
                    onChange={(e) => setNewMeeting({ ...newMeeting, googleFormUrl: e.target.value })}
                    placeholder={hasAutoLink ? "Déjalo vacío para usar el enlace automático" : "https://docs.google.com/forms/..."}
                  />
                  {hasAutoLink ? (
                       <p className="text-[11px] text-green-700 mt-2 font-medium flex gap-1 items-start">
                          <SparklesIcon className="w-3 h-3 mt-0.5 shrink-0" />
                          Al dejarlo vacío, el sistema generará el enlace seguro automáticamente usando tu configuración global.
                       </p>
                  ) : (
                      <p className="text-[10px] text-slate-400 mt-2">
                          Configura el "Link Maestro" en Ajustes para no tener que pegar esto cada vez.
                      </p>
                  )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descripción</label>
                <textarea
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none h-24 resize-none transition-all"
                  value={newMeeting.descripcion}
                  onChange={(e) => setNewMeeting({ ...newMeeting, descripcion: e.target.value })}
                  placeholder="Detalles adicionales..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-lg shadow-indigo-200"
                >
                  Crear Reunión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Meetings;
