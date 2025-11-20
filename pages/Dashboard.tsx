
import React, { useEffect, useState } from 'react';
import { getTeachers, getMeetings, getAttendance, getCloudUrl, getRecentActivity, syncFromCloud } from '../services/storageService';
import { UsersIcon, CalendarIcon, CheckCircleIcon, SparklesIcon, SettingsIcon } from '../components/Icons';
import { useToast } from '../components/Toast';
import { AppRoute, RecentActivityItem } from '../types';

const CountUp: React.FC<{ end: number; duration?: number }> = ({ end, duration = 1500 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(ease * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count}</span>;
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ teachers: 0, meetings: 0, attendanceRate: 0 });
  const [activity, setActivity] = useState<RecentActivityItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const { showToast } = useToast();
  const [cloudUrl, setCloudUrl] = useState('');

  useEffect(() => {
    // Initial Load
    loadStats();
    const url = getCloudUrl();
    setCloudUrl(url);

    // Event Listener for Real-time updates from App.tsx global sync
    const handleDataUpdate = () => {
        setIsSyncing(false); // Stop spinner when done
        setLastUpdate(new Date());
        loadStats();
    };
    
    window.addEventListener('data-updated', handleDataUpdate);

    return () => window.removeEventListener('data-updated', handleDataUpdate);
  }, []);

  const loadStats = () => {
    const teachers = getTeachers();
    const meetings = getMeetings();
    const attendance = getAttendance();
    const recent = getRecentActivity(4);

    const totalPossibleAttendance = meetings.length * teachers.length;
    const rate = totalPossibleAttendance > 0 
      ? Math.round((attendance.length / totalPossibleAttendance) * 100) 
      : 0;

    setStats({ teachers: teachers.length, meetings: meetings.length, attendanceRate: rate });
    setActivity(recent);
  };

  const isSystemOnline = !!cloudUrl;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto relative min-h-screen">
      {/* Header Section with decorative bg */}
      <div className="flex justify-between items-end mb-10 animate-entrance">
        <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2 tracking-tight">Panel de Control</h1>
            <p className="text-slate-500 text-lg">Visión general del sistema DocenteTrack.</p>
        </div>
        <div className="hidden md:block text-right">
             <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border shadow-sm transition-colors ${
                 isSystemOnline 
                 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                 : 'bg-slate-50 border-slate-200 text-slate-600'
             }`}>
                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isSystemOnline ? 'bg-emerald-500' : 'bg-slate-400'} ${isSyncing ? 'animate-ping' : ''}`}></div>
                <span>{isSystemOnline ? 'Nube Conectada' : 'Modo Local'}</span>
            </div>
            {isSystemOnline && (
                <div className="text-[10px] text-slate-400 mt-1 pr-2">
                    Actualizado: {lastUpdate.toLocaleTimeString()}
                </div>
            )}
        </div>
      </div>

      {!isSystemOnline && (
          <div className="mb-8 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-5 flex items-center gap-4 animate-scale-in shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.hash = AppRoute.SETTINGS}>
              <div className="bg-orange-100 p-3 rounded-xl text-orange-600 shrink-0 shadow-inner">
                  <SparklesIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                  <h3 className="text-orange-900 font-bold text-base">Sincronización Pendiente</h3>
                  <p className="text-orange-800/80 text-sm">
                      Configura Google Apps Script para habilitar la asistencia en tiempo real desde Formularios.
                  </p>
              </div>
              <div className="bg-white/50 p-2 rounded-full text-orange-400">→</div>
          </div>
      )}

      {/* Stats Grid with PREMIUM Design */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Card 1: Docentes */}
        <div className="group relative bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_-4px_rgba(59,130,246,0.2)] hover:border-blue-100 transition-all duration-500 ease-out hover:-translate-y-1 overflow-hidden animate-entrance delay-100">
           
           {/* Background Gradient Blob */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 via-indigo-50 to-transparent rounded-bl-[100px] opacity-60 transition-transform duration-700 group-hover:scale-125"></div>

           <div className="relative z-10 flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-200 group-hover:shadow-blue-400/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-4 ring-blue-50">
                <UsersIcon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">Personal</p>
                <h3 className="text-4xl font-extrabold text-slate-800 tracking-tight">
                    <CountUp end={stats.teachers} />
                </h3>
              </div>
           </div>
        </div>

        {/* Card 2: Reuniones */}
        <div className="group relative bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_-4px_rgba(139,92,246,0.2)] hover:border-violet-100 transition-all duration-500 ease-out hover:-translate-y-1 overflow-hidden animate-entrance delay-200">
           
           {/* Background Gradient Blob */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-transparent rounded-bl-[100px] opacity-60 transition-transform duration-700 group-hover:scale-125"></div>

           <div className="relative z-10 flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-200 group-hover:shadow-violet-400/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-4 ring-violet-50">
                <CalendarIcon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-violet-600 transition-colors">Reuniones</p>
                <h3 className="text-4xl font-extrabold text-slate-800 tracking-tight">
                    <CountUp end={stats.meetings} />
                </h3>
              </div>
           </div>
        </div>

        {/* Card 3: Asistencia */}
        <div className="group relative bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_-4px_rgba(16,185,129,0.2)] hover:border-emerald-100 transition-all duration-500 ease-out hover:-translate-y-1 overflow-hidden animate-entrance delay-300">
           
           {/* Background Gradient Blob */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-50 via-teal-50 to-transparent rounded-bl-[100px] opacity-60 transition-transform duration-700 group-hover:scale-125"></div>

           <div className="relative z-10 flex items-center gap-5">
              <div className="p-4 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200 group-hover:shadow-emerald-400/50 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ring-4 ring-emerald-50">
                <CheckCircleIcon className="w-7 h-7" />
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-emerald-600 transition-colors">Asistencia Global</p>
                <h3 className="text-4xl font-extrabold text-slate-800 tracking-tight flex items-baseline gap-1">
                    <CountUp end={stats.attendanceRate} />
                    <span className="text-lg font-semibold text-slate-300">%</span>
                </h3>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Shortcuts */}
          <div className="lg:col-span-2 space-y-8 animate-entrance delay-200">
             
             {/* Shortcut to Settings - Modern Glass Look */}
             <div 
                onClick={() => window.location.hash = AppRoute.SETTINGS}
                className="relative group overflow-hidden rounded-2xl p-8 cursor-pointer transition-all duration-300 border border-slate-200 bg-white hover:shadow-xl hover:border-indigo-200"
            >
                {/* Background Gradient Blob */}
                <div className="absolute -right-10 -top-10 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                            <SettingsIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Configuración Avanzada</h3>
                            <p className="text-sm text-slate-500 mt-1">Integración Forms, Copias de Seguridad y Reset.</p>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        →
                    </div>
                </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 text-sm text-blue-900 flex items-start gap-3 shadow-sm">
                <div className="bg-white p-2 rounded-full text-blue-600 shadow-sm mt-0.5">ℹ️</div>
                <div>
                    <p className="font-bold mb-1 text-lg">¿Archivos de Respaldo?</p>
                    <p className="opacity-80 leading-relaxed">
                        Ahora puedes encontrar las opciones de importar y exportar en el módulo de
                        <button onClick={() => window.location.hash = AppRoute.SETTINGS} className="font-bold underline ml-1 hover:text-blue-600">Configuración</button>.
                    </p>
                </div>
            </div>
          </div>

          {/* Right Column: Live Feed */}
          <div className="lg:col-span-1 animate-entrance delay-300">
             <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 h-full overflow-hidden flex flex-col">
                 <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                     <h3 className="font-bold text-slate-800 flex items-center gap-2">
                         <span className="relative flex h-3 w-3">
                            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isSystemOnline ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${isSystemOnline ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                        </span>
                        Actividad en Vivo
                     </h3>
                     {isSyncing && <span className="text-[10px] text-indigo-500 font-medium animate-pulse">Buscando...</span>}
                 </div>
                 <div className="p-4 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar space-y-3">
                     {activity.length === 0 ? (
                         <div className="h-40 flex flex-col items-center justify-center text-slate-300 text-center p-4 border-2 border-dashed border-slate-100 rounded-xl m-2">
                             <CalendarIcon className="w-8 h-8 mb-2 opacity-50" />
                             <p className="text-sm font-medium">Sin registros recientes</p>
                         </div>
                     ) : (
                         activity.map((item, idx) => (
                             <div key={idx} className="p-4 rounded-xl bg-white border border-slate-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:border-indigo-200 hover:shadow-md transition-all group animate-fade-in">
                                 <div className="flex justify-between items-start mb-1">
                                     <p className="font-bold text-slate-700 text-sm group-hover:text-indigo-700 transition-colors">{item.teacherName}</p>
                                     <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                         {new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                     </span>
                                 </div>
                                 <p className="text-xs text-slate-500 flex items-center gap-1">
                                     <CheckCircleIcon className="w-3 h-3 text-emerald-500" />
                                     {item.meetingName}
                                 </p>
                             </div>
                         ))
                     )}
                 </div>
                 <button onClick={async () => { setIsSyncing(true); await syncFromCloud(); }} className="p-3 text-xs text-center text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors border-t border-slate-50 font-medium uppercase tracking-wide">
                     {isSyncing ? 'Sincronizando...' : 'Forzar Sincronización Ahora'}
                 </button>
             </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
