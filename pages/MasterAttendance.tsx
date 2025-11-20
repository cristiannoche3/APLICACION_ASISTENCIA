
import React, { useState, useEffect } from 'react';
import { getTeachers, getMeetings, getAttendance, toggleAttendance, saveAttendanceNote, syncFromCloud, getCloudUrl, markAttendance } from '../services/storageService';
import { Teacher, Meeting, Attendance } from '../types';
import { ClipboardListIcon, DownloadIcon, SparklesIcon, SearchIcon, FilterIcon, WhatsAppIcon, CheckCircleIcon, XIcon, NoteIcon, MailIcon } from '../components/Icons';
import { useToast } from '../components/Toast';

const MasterAttendance: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useToast();
  const cloudUrl = getCloudUrl();
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  
  // UI State for Popover
  const [activeCell, setActiveCell] = useState<{ tId: number; mId: number; x: number; y: number } | null>(null);
  
  // UI State for Note Modal
  const [noteModal, setNoteModal] = useState<{ tId: number; mId: number; currentNote: string; teacherName: string; meetingName: string } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, selectedRole, statusFilter]);

  // Close popover on scroll or resize
  useEffect(() => {
      const handleScroll = () => {
          if (activeCell) setActiveCell(null);
      };
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      return () => {
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('resize', handleScroll);
      };
  }, [activeCell]);

  // Close popover on click outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (activeCell && !(event.target as Element).closest('.attendance-menu-popover')) {
              setActiveCell(null);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeCell]);

  const loadData = () => {
    setTeachers(getTeachers());
    setMeetings(getMeetings().sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()));
    setAttendance(getAttendance());
  };

  const handleSync = async () => {
      if (!cloudUrl) {
          showToast('Configura la conexión con Google en Ajustes primero', 'info');
          return;
      }
      setIsSyncing(true);
      const success = await syncFromCloud();
      if (success) {
          loadData();
          showToast('Sincronizado con Google Sheets', 'success');
      } else {
          showToast('Error al sincronizar. Verifica tu conexión', 'error');
      }
      setIsSyncing(false);
  };

  const getRecord = (meetingId: number, teacherId: number) => {
    return attendance.find(a => a.id_reunion === meetingId && a.id_docente === teacherId);
  };

  const handleSetStatus = (meetingId: number, teacherId: number, status: 'present' | 'absent' | 'excused') => {
      const currentRecord = getRecord(meetingId, teacherId);
      const isPresent = currentRecord?.asistio;

      // PROTECCIÓN DE EMERGENCIA:
      // Si el docente ya marcó asistencia (está presente) y el administrador intenta cambiarlo,
      // pedimos confirmación para evitar cambios accidentales.
      if (isPresent && (status === 'absent' || status === 'excused')) {
          if (!window.confirm("⚠️ ¿Modificación de Emergencia?\n\nEste docente ya tiene asistencia registrada. ¿Estás seguro de que deseas modificar/anular este registro manualmente?")) {
             setActiveCell(null);
             return;
          }
      }

      if (status === 'present') {
          markAttendance(meetingId, teacherId);
          saveAttendanceNote(meetingId, teacherId, ''); 
          setAttendance(getAttendance());
          setActiveCell(null);
      } else if (status === 'absent') {
          const rec = getRecord(meetingId, teacherId);
          if (rec && rec.asistio) {
             toggleAttendance(meetingId, teacherId);
          }
          saveAttendanceNote(meetingId, teacherId, '');
          setAttendance(getAttendance());
          setActiveCell(null);
      } else if (status === 'excused') {
          const rec = getRecord(meetingId, teacherId);
          const currentNote = rec?.nota || '';
          const t = teachers.find(t => t.id === teacherId);
          const m = meetings.find(m => m.id === meetingId);

          setNoteModal({
              tId: teacherId,
              mId: meetingId,
              currentNote,
              teacherName: t?.nombre || 'Docente',
              meetingName: m?.nombre || 'Reunión'
          });
          setActiveCell(null);
      }
  };

  const handleSaveNote = () => {
      if (!noteModal) return;
      const { mId, tId, currentNote } = noteModal;
      
      const rec = getRecord(mId, tId);
      // If marking as excused (with note), ensure they are not marked as "Present" (attended=true)
      if (rec && rec.asistio) {
          toggleAttendance(mId, tId);
      }
      
      saveAttendanceNote(mId, tId, currentNote);
      setAttendance(getAttendance());
      setNoteModal(null);
      showToast('Estado actualizado', 'success');
  };

  const getTeacherStats = (teacherId: number) => {
    if (meetings.length === 0) return 0;
    const presentCount = attendance.filter(a => a.id_docente === teacherId && a.asistio).length;
    return Math.round((presentCount / meetings.length) * 100);
  };

  const handleNotify = (type: 'wa' | 'email', teacher: Teacher) => {
      const absences = meetings.filter(m => {
          const rec = getRecord(m.id, teacher.id);
          return !rec?.asistio && !rec?.nota;
      });

      if (absences.length === 0) {
          showToast(`¡${teacher.nombre} no tiene faltas injustificadas!`, 'success');
          return;
      }

      const meetingList = absences.map(m => `• ${m.nombre} (${new Date(m.fecha).toLocaleDateString()})`).join('\n');
      const text = `Hola ${teacher.nombre}, le informamos que registra inasistencias pendientes de justificación en las siguientes reuniones:\n\n${meetingList}\n\nPor favor, póngase en contacto para regularizar su situación.`;

      if (type === 'wa') {
          if (!teacher.telefono) {
              showToast('El docente no tiene teléfono registrado', 'error');
              return;
          }
          const url = `https://api.whatsapp.com/send?phone=${teacher.telefono.replace(/\D/g, '')}&text=${encodeURIComponent(text)}`;
          window.open(url, '_blank');
      } else {
           if (!teacher.correo) {
              showToast('El docente no tiene correo registrado', 'error');
              return;
          }
          const subject = `Aviso de Inasistencias - ${teacher.nombre}`;
          const mailto = `mailto:${teacher.correo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
          window.open(mailto, '_self');
      }
  };

  const downloadCSV = () => {
    if (meetings.length === 0 || teachers.length === 0) {
      alert("No hay datos suficientes para exportar.");
      return;
    }

    const header = ['ID Docente', 'Nombre', 'Cargo', 'Correo', '% Asistencia', ...meetings.map(m => `${m.nombre} (${m.fecha})`)];
    
    const rows = filteredTeachers.map(t => {
        const percent = getTeacherStats(t.id);
        const meetingAttendance = meetings.map(m => {
            const rec = getRecord(m.id, t.id);
            if (rec?.asistio) return 'SI';
            if (rec?.nota) return `EXCUSA: ${rec.nota}`;
            return 'NO';
        });
        return [
            t.id,
            `"${t.nombre}"`,
            `"${t.cargo}"`,
            t.correo,
            `${percent}%`,
            ...meetingAttendance
        ];
    });

    const csvContent = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Control_Asistencia_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueRoles = Array.from(new Set(teachers.map(t => t.cargo))).sort((a, b) => String(a).localeCompare(String(b)));

  const filteredTeachers = teachers.filter(t => {
      if (searchTerm && !t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) && !t.cargo.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // Allow partial match for selectedRole input
      if (selectedRole && !t.cargo.toLowerCase().includes(selectedRole.toLowerCase())) return false;
      
      if (statusFilter !== 'todos') {
          const percent = getTeacherStats(t.id);
          if (statusFilter === 'perfect' && percent < 100) return false; 
          if (statusFilter === 'absent' && percent === 100) return false; 
          if (statusFilter === 'critical' && percent >= 50) return false; 
          if (statusFilter === 'excused') {
              const hasExcuses = meetings.some(m => getRecord(m.id, t.id)?.nota);
              if (!hasExcuses) return false;
          }
      }
      return true;
  });

  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  const currentTeachers = filteredTeachers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrint = () => {
      window.print();
  };

  const renderMenu = () => {
      if (!activeCell) return null;
      const record = getRecord(activeCell.mId, activeCell.tId);
      const hasNote = !!record?.nota;
      
      return (
        <div 
            className="attendance-menu-popover fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-300 p-1 flex flex-col gap-0.5 animate-fade-in-up origin-top no-print min-w-[160px]"
            style={{ 
                top: activeCell.y + 4, 
                left: activeCell.x,
                transform: 'translateX(-50%)'
            }}
        >
            <button 
                onClick={() => handleSetStatus(activeCell.mId, activeCell.tId, 'present')}
                className="flex items-center gap-3 p-3 hover:bg-green-50 rounded text-xs font-bold text-gray-600 hover:text-green-700 text-left transition-colors"
            >
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"><CheckCircleIcon className="w-3 h-3" /></div>
                Presente
            </button>

            <button 
                onClick={() => handleSetStatus(activeCell.mId, activeCell.tId, 'absent')}
                className="flex items-center gap-3 p-3 hover:bg-red-50 rounded text-xs font-bold text-gray-600 hover:text-red-700 text-left transition-colors"
            >
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center"><XIcon className="w-3 h-3" /></div>
                Ausente
            </button>

            <button 
                onClick={() => handleSetStatus(activeCell.mId, activeCell.tId, 'excused')}
                className="flex items-center gap-3 p-3 hover:bg-orange-50 rounded text-xs font-bold text-gray-600 hover:text-orange-700 text-left transition-colors"
            >
                <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center"><NoteIcon className="w-3 h-3" /></div>
                Excusa / Nota
            </button>
            
            {hasNote && (
                <div className="mt-1 pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic text-center px-2 break-words max-w-[180px]">
                    "{record?.nota}"
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="p-6 h-[calc(100vh-64px)] flex flex-col bg-gray-50/50 print:p-0 print:h-auto print:bg-white">
      <style>{`
        @media print {
            @page { size: landscape; margin: 5mm; }
            body { -webkit-print-color-adjust: exact; }
            .no-print, header, aside { display: none !important; }
            .print-visible { display: block !important; overflow: visible !important; }
            .attendance-table-container { overflow: visible !important; box-shadow: none !important; border: none !important; }
            table { width: auto !important; } 
            .vertical-text { color: #000 !important; }
        }
      `}</style>

      <div className="mb-6 flex-shrink-0 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <ClipboardListIcon className="w-8 h-8 text-indigo-600" />
                    Control General
                </h1>
                <p className="text-gray-500 mt-1">Matriz de asistencia y gestión de estados.</p>
            </div>
            <div className="flex gap-2">
                 {cloudUrl && (
                    <button 
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-white border border-green-200 text-green-700 px-3 py-2 rounded-lg hover:bg-green-50 transition-all shadow-sm text-xs font-bold active:scale-95 disabled:opacity-50"
                    >
                        {isSyncing ? (
                            <span className="animate-spin w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full"></span>
                        ) : (
                            <SparklesIcon className="w-3 h-3" />
                        )}
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                )}
                <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-all shadow-md text-sm font-bold active:scale-95"
                >
                <span className="text-lg">🖨️</span>
                Imprimir
                </button>
                <button 
                onClick={downloadCSV}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-all shadow-md text-sm font-bold active:scale-95"
                >
                <DownloadIcon className="w-4 h-4" />
                Exportar
                </button>
            </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center animate-fade-in">
            <div className="relative flex-1 w-full md:w-auto">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar docente o cargo..." 
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50 focus:bg-white transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <div className="relative min-w-[160px]">
                    <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                    <input 
                        list="roles-options"
                        type="text"
                        placeholder="Filtrar Cargo..."
                        className="w-full pl-8 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-gray-500"
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                    />
                    <datalist id="roles-options">
                        {uniqueRoles.map(role => (
                            <option key={role} value={role} />
                        ))}
                    </datalist>
                </div>

                <div className="relative min-w-[180px]">
                    <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                    <select 
                        className="w-full pl-8 pr-8 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-gray-50"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="todos">Cualquier Estado</option>
                        <option value="perfect">🟢 Asistencia Perfecta (100%)</option>
                        <option value="absent">🔴 Con Inasistencias &lt;100%</option>
                        <option value="critical">⚠️ Riesgo Crítico &lt;50%</option>
                        <option value="excused">📝 Con Justificaciones</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px]">▼</div>
                </div>
            </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6 mb-4 px-2 text-xs animate-fade-in justify-center md:justify-start no-print">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
              <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <CheckCircleIcon className="w-3 h-3" />
              </div>
              <span className="font-medium text-gray-600">Presente</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
              <div className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                  <XIcon className="w-3 h-3" />
              </div>
              <span className="font-medium text-gray-600">Ausente</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
              <div className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <NoteIcon className="w-3 h-3" />
              </div>
              <span className="font-medium text-gray-600">Excusa</span>
          </div>
      </div>

      <div className="attendance-table-container flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col relative animate-fade-in">
        
        {filteredTeachers.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <SearchIcon className="w-12 h-12 mb-3 opacity-20" />
                <p className="mb-2 font-medium">No se encontraron resultados.</p>
                <button 
                    onClick={() => { setSearchTerm(''); setSelectedRole(''); setStatusFilter('todos'); }}
                    className="mt-4 text-indigo-600 text-sm font-medium hover:underline"
                >
                    Limpiar filtros
                </button>
             </div>
        ) : (
        <div className="flex-1 overflow-auto w-full custom-scrollbar print-visible">
            <table className="min-w-max border-collapse w-auto table-fixed">
              <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th scope="col" className="sticky left-0 top-0 z-30 bg-gray-50 px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 w-64 md:w-80 h-32 align-bottom shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col justify-end pb-1 h-full">
                        <span>Docente</span>
                    </div>
                  </th>
                  
                  <th scope="col" className="sticky top-0 z-20 bg-gray-50 px-1 py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200 w-12 h-32 align-bottom">
                    <div className="[writing-mode:vertical-rl] rotate-180 flex items-center justify-center w-full h-full pb-2 mx-auto vertical-text">
                        Total %
                    </div>
                  </th>

                  {meetings.map((meeting) => {
                    const dateObj = new Date(meeting.fecha + 'T12:00:00');
                    const day = dateObj.getDate();
                    const month = dateObj.toLocaleDateString('es-ES', { month: 'short' }).replace('.','').toUpperCase();
                    
                    return (
                        <th key={meeting.id} scope="col" className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 w-10 max-w-[40px] h-32 align-bottom hover:bg-gray-100 transition-colors p-0">
                        <div className="w-full h-full relative group/header overflow-hidden">
                            <div className="absolute inset-0 flex items-end justify-center pb-2 pt-9">
                                <div className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-bold text-gray-700 whitespace-nowrap truncate max-h-[85px] vertical-text" title={meeting.nombre}>
                                    {meeting.nombre}
                                </div>
                            </div>
                            <div className="absolute top-0 left-0 w-full bg-indigo-50/90 backdrop-blur-sm border-b border-indigo-100 text-center py-1 z-10 shadow-sm">
                                <div className="text-[12px] font-black text-indigo-800 leading-none">{day}</div>
                                <div className="text-[9px] font-bold text-indigo-500 uppercase leading-none mt-0.5">{month}</div>
                            </div>
                        </div>
                        </th>
                    );
                  })}
                </tr>
              </thead>
              
              <tbody className="bg-white divide-y divide-gray-100">
                  {currentTeachers.map((teacher) => {
                    const percent = getTeacherStats(teacher.id);
                    const hasAbsences = percent < 100;

                    return (
                      <tr key={teacher.id} className="group hover:bg-indigo-50/30 transition-colors duration-150 ease-in-out">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/50 px-4 py-3 border-r border-gray-200 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.05)] transition-colors truncate">
                          <div className="flex flex-col justify-center h-full">
                            <div className="flex justify-between items-center">
                                <span className="text-base md:text-lg font-bold text-gray-900 group-hover:text-indigo-900 transition-colors block truncate">{teacher.nombre}</span>
                            </div>
                            <span className="text-xs text-gray-500 font-normal truncate mt-0.5" title={teacher.cargo}>{teacher.cargo}</span>
                            
                            {hasAbsences && (
                                <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 no-print">
                                    <button onClick={() => handleNotify('wa', teacher)} className="bg-[#25D366] text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-green-600 transition-colors flex items-center gap-1" title="WhatsApp">
                                        <WhatsAppIcon className="w-3 h-3" /> WhatsApp
                                    </button>
                                    <button onClick={() => handleNotify('email', teacher)} className="bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] font-bold hover:bg-blue-600 transition-colors flex items-center gap-1" title="Enviar Correo">
                                        <MailIcon className="w-3 h-3" /> Email
                                    </button>
                                </div>
                            )}
                          </div>
                        </td>

                        <td className="px-0.5 py-1 whitespace-nowrap text-center border-r border-gray-100 bg-gray-50/30">
                          <span className={`inline-block text-[11px] font-bold px-1.5 py-0.5 rounded ${
                            percent >= 85 ? 'text-green-700' : percent >= 50 ? 'text-yellow-700' : 'text-red-700'
                          }`}>
                            {percent}%
                          </span>
                        </td>

                        {meetings.map((meeting) => {
                          const record = getRecord(meeting.id, teacher.id);
                          const attended = record?.asistio || false;
                          const hasNote = !!record?.nota;
                          const isActive = activeCell?.tId === teacher.id && activeCell?.mId === meeting.id;

                          return (
                            <td key={`${teacher.id}-${meeting.id}`} className="px-0 py-1 text-center relative attendance-cell-container border border-gray-100">
                                <div className="flex justify-center items-center h-full">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setActiveCell({ 
                                                tId: teacher.id, 
                                                mId: meeting.id,
                                                x: rect.left + (rect.width / 2),
                                                y: rect.bottom
                                            });
                                        }}
                                        className={`
                                            w-6 h-6 rounded-full flex items-center justify-center transition-all duration-100
                                            hover:scale-110 focus:outline-none
                                            ${attended 
                                                ? 'text-green-500 hover:bg-green-50 print-green' 
                                                : hasNote 
                                                    ? 'text-orange-500 hover:bg-orange-50 print-orange' 
                                                    : 'text-red-400 hover:bg-red-50 hover:text-red-600 print-red'
                                            }
                                            ${isActive ? 'ring-2 ring-indigo-300 scale-110' : ''}
                                        `}
                                        title={attended ? "Presente" : hasNote ? `Justificado: ${record?.nota}` : "Ausente"}
                                    >
                                        {attended ? (
                                            <CheckCircleIcon className="w-4 h-4" />
                                        ) : hasNote ? (
                                            <NoteIcon className="w-4 h-4" />
                                        ) : (
                                            <XIcon className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
        </div>
        )}
        
        <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex flex-col md:flex-row justify-between items-center flex-shrink-0 gap-3 no-print">
            <div className="flex items-center gap-3">
                <span className="font-medium bg-white border border-gray-200 px-2 py-1 rounded shadow-sm">Total: {filteredTeachers.length} docentes</span>
            </div>
            
            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-white transition-colors font-medium"
                  >
                    Anterior
                  </button>
                  <span className="font-medium text-gray-700 mx-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-indigo-50 disabled:opacity-50 disabled:hover:bg-white transition-colors font-medium"
                  >
                    Siguiente
                  </button>
                </div>
            )}
        </div>
      </div>
      
      {renderMenu()}

      {noteModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] animate-fade-in p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                  <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-orange-800 font-bold">
                          <NoteIcon className="w-5 h-5" />
                          <span>Gestionar Justificación</span>
                      </div>
                      <button onClick={() => setNoteModal(null)} className="text-orange-400 hover:bg-orange-100 p-1 rounded"><XIcon className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6">
                      <div className="mb-4 text-sm text-gray-600">
                          <div className="flex justify-between mb-1">
                              <span className="font-medium">Docente:</span>
                              <span>{noteModal.teacherName}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="font-medium">Reunión:</span>
                              <span>{noteModal.meetingName}</span>
                          </div>
                      </div>

                      <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Motivo o Excusa</label>
                      <textarea 
                          autoFocus
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none h-32 resize-none"
                          placeholder="Escribe aquí el motivo de la inasistencia (ej. Incapacidad médica)..."
                          value={noteModal.currentNote}
                          onChange={(e) => setNoteModal(prev => prev ? { ...prev, currentNote: e.target.value } : null)}
                      ></textarea>
                      <p className="text-xs text-gray-400 mt-2">
                          * Dejar vacío eliminará la justificación.
                      </p>
                  </div>
                  
                  <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                      <button onClick={() => setNoteModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">Cancelar</button>
                      <button 
                        onClick={handleSaveNote}
                        className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-lg font-bold shadow-md transition-transform active:scale-95"
                      >
                          Guardar Estado
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default MasterAttendance;
