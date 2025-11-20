
import React, { useState, useEffect, useRef } from 'react';
import { Meeting, AttendanceReportItem, TrendData, RoleStat, Teacher } from '../types';
import { getMeetingById, getMeetingAttendanceReport, toggleAttendance, getMeetingTrends, getAttendanceByRole, saveAttendanceNote, getGlobalFormUrl, syncFromCloud, getCloudUrl, getFormEntryId } from '../services/storageService';
import { CheckCircleIcon, SparklesIcon, MailIcon, NoteIcon, WhatsAppIcon, VolumeIcon, StopCircleIcon, DownloadIcon, SendIcon, ArrowLeftIcon, XIcon } from '../components/Icons';
import { AttendanceDonut, AttendanceTrend } from '../components/Charts';
import { GoogleGenAI, Modality } from '@google/genai';
import { useToast } from '../components/Toast';

interface Props {
  meetingId: number;
  onBack: () => void;
}

const MeetingDetails: React.FC<Props> = ({ meetingId, onBack }) => {
  const [meeting, setMeeting] = useState<Meeting | undefined>(undefined);
  const [report, setReport] = useState<AttendanceReportItem[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [roleStats, setRoleStats] = useState<RoleStat[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'qr' | 'report'>('overview');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');

  // Notification Modal State
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifyTarget, setNotifyTarget] = useState<'absent' | 'all'>('absent');

  // Audio State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const { showToast } = useToast();
  const hasCloud = !!getCloudUrl();

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
         audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const loadMeetingData = () => {
    const m = getMeetingById(meetingId);
    if (m) {
      setMeeting(m);
      setReport(getMeetingAttendanceReport(m.id));
      setTrends(getMeetingTrends());
      setRoleStats(getAttendanceByRole(m.id));
    }
  };

  useEffect(() => {
    loadMeetingData();
    
    // Listen for global updates (e.g., from background sync)
    const handleDataUpdate = () => {
        loadMeetingData();
    };
    window.addEventListener('data-updated', handleDataUpdate);

    return () => {
      stopAudio();
      window.removeEventListener('data-updated', handleDataUpdate);
    };
  }, [meetingId]);

  const handleSync = async () => {
      setIsSyncing(true);
      const success = await syncFromCloud();
      if (success) {
          loadMeetingData();
          showToast('Datos actualizados desde Google Sheets', 'success');
      } else {
          showToast('Error de sincronización', 'error');
      }
      setIsSyncing(false);
  };

  const handleToggleAttendance = (docenteId: number) => {
    if (!meeting) return;

    // PROTECCIÓN DE EMERGENCIA:
    // Si el docente ya está marcado como presente, pedimos confirmación antes de quitarle la asistencia.
    const item = report.find(r => r.docente.id === docenteId);
    if (item && item.asistio) {
        if (!window.confirm("⚠️ ¿Modificación de Emergencia?\n\nEste docente ya marcó su asistencia. ¿Estás seguro de que deseas anularla manualmente?")) {
            return;
        }
    }

    toggleAttendance(meeting.id, docenteId);
    loadMeetingData();
  };

  const handleAddNote = (docenteId: number, currentNote: string | undefined) => {
    if (!meeting) return;
    const note = window.prompt("Ingrese el detalle o excusa para este docente:", currentNote || "");
    if (note !== null) {
        saveAttendanceNote(meeting.id, docenteId, note);
        loadMeetingData();
        showToast('Nota guardada correctamente', 'success');
    }
  };

  // Helper to format message for individual or bulk
  const formatWhatsAppUrl = (phone: string | undefined, teacherName: string, template: string) => {
      if (!phone) return null;
      
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 7) return null;

      const finalMsg = template
        .replace(/{nombre}/g, teacherName)
        .replace(/{reunion}/g, meeting?.nombre || 'Reunión');
      
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(finalMsg)}`;
  };

  const handleWhatsApp = (docente: Teacher) => {
      if (!meeting) return;
      const message = `Hola ${docente.nombre}, notamos tu inasistencia a la reunión "${meeting.nombre}". Por favor, ¿podrías indicarnos el motivo?`;
      const url = formatWhatsAppUrl(docente.telefono, docente.nombre, message);
      
      if (url) {
          window.open(url, '_blank');
          showToast('Chat de WhatsApp abierto', 'success');
      } else {
          showToast('El docente no tiene número de teléfono válido', 'error');
      }
  };

  const openNotifyModal = () => {
      setNotifyMessage(`Hola {nombre}, este es un mensaje respecto a la reunión "{reunion}".`);
      setNotifyTarget('absent');
      setShowNotifyModal(true);
  };

  if (!meeting) return <div>Reunión no encontrada</div>;

  // --- INTELLIGENT LINK GENERATION LOGIC ---
  const globalFormUrl = getGlobalFormUrl();
  const formEntryId = getFormEntryId(); 
  let finalGoogleFormUrl = meeting.googleFormUrl || globalFormUrl;
  let isAutoGenerated = false;
  
  if (!meeting.googleFormUrl && globalFormUrl && formEntryId) {
      try {
          // Use URL object for robust parameter handling
          const urlObj = new URL(globalFormUrl);
          urlObj.searchParams.set(formEntryId, meeting.nombre);
          
          // Ensure usp=pp_url is set correctly (replaces sf_link if present, which is often desired for pre-filled)
          urlObj.searchParams.set('usp', 'pp_url');
          
          finalGoogleFormUrl = urlObj.toString();
          isAutoGenerated = true;
      } catch (e) {
          // Fallback if URL is invalid (e.g. missing protocol)
          const separator = globalFormUrl.includes('?') ? '&' : '?';
          finalGoogleFormUrl = `${globalFormUrl}${separator}${formEntryId}=${encodeURIComponent(meeting.nombre)}&usp=pp_url`;
          isAutoGenerated = true;
      }
  }

  const isGoogleForm = !!finalGoogleFormUrl;
  const getBaseUrl = () => {
    const url = window.location.href.split('#')[0];
    return url.endsWith('/') ? url.slice(0, -1) : url;
  };

  const attendanceUrl = isGoogleForm 
      ? finalGoogleFormUrl
      : `${getBaseUrl()}/#/attend/${meeting.id}`;

  const downloadQR = async () => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(attendanceUrl)}`;
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_${meeting.nombre.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Código QR descargado correctamente', 'success');
    } catch (e) {
      window.open(qrUrl, '_blank');
    }
  };

  const presentCount = report.filter(r => r.asistio).length;
  const totalCount = report.length;
  const absentCount = totalCount - presentCount;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const handleSendReportEmail = () => {
    if (!meeting) return;
    const body = `REPORTE: ${meeting.nombre}\nAsistencia: ${percentage}%\nPresentes: ${presentCount}\nAusentes: ${absentCount}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(`Reporte: ${meeting.nombre}`)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, '_self');
  };

  const analyzeAttendanceWithAI = async () => {
    const apiKey = (typeof process !== 'undefined' && process?.env) ? process.env.API_KEY : undefined;
    if (!apiKey) { showToast("API Key no configurada.", "error"); return; }
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analiza asistencia: ${percentage}% (${presentCount}/${totalCount}) en reunión "${meeting.nombre}". Ausentes: ${report.filter(r => !r.asistio).map(r => r.docente.nombre).join(', ')}. Da 3 puntos clave breves.`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      setAiAnalysis(response.text || "Sin análisis.");
      showToast('Análisis completado', 'success');
    } catch (error) {
      setAiAnalysis("Error de conexión IA.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playAudioData = async (base64String: string, audioCtx: AudioContext) => {
    try {
      const binaryString = atob(base64String);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const audioBuffer = audioCtx.createBuffer(1, frameCount, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) { channelData[i] = dataInt16[i] / 32768.0; }
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlayingAudio(false);
      sourceNodeRef.current = source;
      source.start();
      setIsPlayingAudio(true);
    } catch (e) { setIsPlayingAudio(false); }
  };

  const handleGenerateSpeech = async () => {
    const apiKey = (typeof process !== 'undefined' && process?.env) ? process.env.API_KEY : undefined;
    if (!apiKey) return;
    if (isPlayingAudio) { stopAudio(); return; }
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = audioCtx;
    setIsGeneratingAudio(true);
    try {
       const ai = new GoogleGenAI({ apiKey });
       const text = `Resumen de asistencia para ${meeting.nombre}. Participación del ${percentage} por ciento. ${presentCount} presentes y ${absentCount} ausentes.`;
       const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: text }] }],
          config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
       });
       const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
       if (audio) await playAudioData(audio, audioCtx);
    } catch (e) { console.error(e); } finally { setIsGeneratingAudio(false); }
  };

  const filteredReport = report.filter(item => 
      item.docente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.docente.cargo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Notification list based on selection
  const notificationList = notifyTarget === 'absent' 
      ? report.filter(r => !r.asistio) 
      : report;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={onBack} className="text-gray-500 hover:text-indigo-600 mb-6 flex items-center gap-2 transition-colors font-medium group">
        <span className="bg-white p-1 rounded-full border border-gray-200 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors"><ArrowLeftIcon className="w-4 h-4" /></span> Volver
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
          <div className="flex-1 pr-8">
            <h1 className="text-3xl font-bold text-gray-900">{meeting.nombre}</h1>
            <div className="flex gap-4 mt-2 text-gray-600 mb-4">
              <span>📅 {new Date(meeting.fecha).toLocaleDateString()}</span>
              <span>⏰ {meeting.hora}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right shrink-0">
                <div className="text-4xl font-bold text-indigo-600">{percentage}%</div>
                <div className="text-sm text-gray-500">Asistencia</div>
            </div>
            {hasCloud && (
                <button onClick={handleSync} disabled={isSyncing} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded transition-colors disabled:opacity-50">
                    {isSyncing ? '...' : '↻'} {isSyncing ? 'Sync...' : 'Sync'}
                </button>
            )}
          </div>
        </div>

        <div className="flex border-b border-gray-200 overflow-x-auto">
          {['overview', 'qr', 'report'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-3 font-medium text-sm capitalize ${activeTab === tab ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}>
                {tab === 'overview' ? 'Panel Visual' : tab === 'qr' ? 'Código QR' : 'Lista Detallada'}
             </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                  <span className="text-gray-500 text-sm">Total</span><br/><span className="text-3xl font-bold text-gray-800">{totalCount}</span>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                  <span className="text-green-600 text-sm">Presentes</span><br/><span className="text-3xl font-bold text-green-700">{presentCount}</span>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                  <span className="text-red-600 text-sm">Ausentes</span><br/><span className="text-3xl font-bold text-red-700">{absentCount}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-center font-semibold mb-4">Estado Actual</h3>
                  <AttendanceDonut present={presentCount} absent={absentCount} total={totalCount} />
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-center font-semibold mb-4">Tendencia</h3>
                  <AttendanceTrend data={trends} currentMeetingId={meeting.id} />
                </div>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100">
                 <div className="flex justify-between items-center mb-3">
                     <h3 className="font-bold text-indigo-900 flex gap-2"><SparklesIcon className="w-5 h-5" /> IA Analysis</h3>
                     <button onClick={handleGenerateSpeech} disabled={isGeneratingAudio} className="p-2 bg-white rounded-full text-indigo-600 shadow-sm hover:bg-indigo-50">
                        {isPlayingAudio ? <StopCircleIcon className="w-5 h-5"/> : <VolumeIcon className="w-5 h-5"/>}
                     </button>
                 </div>
                 {!aiAnalysis ? (
                    <button onClick={analyzeAttendanceWithAI} disabled={isAnalyzing} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm shadow-sm hover:bg-indigo-700 w-full">
                        {isAnalyzing ? 'Analizando...' : 'Generar Análisis'}
                    </button>
                 ) : (
                    <div className="bg-white/90 p-4 rounded-lg text-sm text-indigo-900 border border-indigo-100 h-32 overflow-y-auto">
                        {aiAnalysis}
                    </div>
                 )}
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
              <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex flex-col items-center relative">
                
                {isAutoGenerated && (
                    <div className="absolute -top-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1">
                        <SparklesIcon className="w-3 h-3" /> Enlace Automático
                    </div>
                )}
                
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(attendanceUrl)}`} 
                  alt="QR" 
                  className="w-64 h-64 mb-4"
                />
                <button onClick={downloadQR} className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors">
                    <DownloadIcon className="w-4 h-4" /> Descargar
                </button>
              </div>
              
              <div className="mt-8 max-w-lg text-center w-full">
                 <p className="text-gray-800 font-bold mb-2 text-sm uppercase tracking-wider">Link de Registro</p>
                 <a href={attendanceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-sm break-all bg-indigo-50 p-3 rounded block border border-indigo-100 hover:bg-indigo-100 mb-4">
                  {attendanceUrl}
                 </a>
              </div>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="animate-fade-in">
               <div className="flex justify-between items-center mb-4 gap-4">
                   <input 
                        type="text" 
                        placeholder="Buscar..." 
                        className="border p-2 rounded-lg text-sm w-full max-w-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                   />
                   <div className="flex gap-2">
                       <button onClick={openNotifyModal} className="bg-[#25D366] border border-green-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-green-600 font-bold flex items-center gap-1 shadow-sm transition-colors">
                            <WhatsAppIcon className="w-4 h-4"/> Notificar
                       </button>
                       <button onClick={handleSendReportEmail} className="bg-white border px-3 py-2 rounded-lg text-xs hover:bg-gray-50"><SendIcon className="w-4 h-4 inline mr-1"/> Reporte Email</button>
                   </div>
               </div>
               <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">#</th>
                            <th className="px-4 py-3">Docente</th>
                            <th className="px-4 py-3 text-center">Estado</th>
                            <th className="px-4 py-3">Detalle</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredReport.map(item => (
                            <tr key={item.docente.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-center">
                                    <input type="checkbox" checked={item.asistio} onChange={() => handleToggleAttendance(item.docente.id)} className="rounded text-indigo-600 focus:ring-indigo-500"/>
                                </td>
                                <td className="px-4 py-3 font-medium">
                                    {item.docente.nombre}
                                    <div className="text-xs text-gray-500 font-normal">{item.docente.cargo}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    {item.asistio 
                                        ? <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Presente</span>
                                        : <span className="bg-red-50 text-red-600 px-2 py-1 rounded-full text-xs">Ausente</span>
                                    }
                                </td>
                                <td className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-gray-500 text-xs truncate max-w-[150px]">{item.nota || (item.asistio ? item.hora_llegada?.split('T')[1]?.substring(0,5) : '-')}</span>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => handleWhatsApp(item.docente)} 
                                            className="text-[#25D366] hover:bg-green-50 p-1 rounded"
                                            title={item.docente.telefono ? "Enviar mensaje WhatsApp" : "Sin teléfono registrado"}
                                        >
                                            <WhatsAppIcon className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => handleAddNote(item.docente.id, item.nota)} className="text-gray-400 hover:text-indigo-600 p-1"><NoteIcon className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* WhatsApp Notification Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-[#25D366] px-6 py-4 flex justify-between items-center text-white">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <WhatsAppIcon className="w-6 h-6" />
                        Centro de Mensajería WhatsApp
                    </h2>
                    <button onClick={() => setShowNotifyModal(false)} className="hover:bg-black/10 p-1 rounded"><XIcon className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Destinatarios</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => { setNotifyTarget('absent'); setNotifyMessage(`Hola {nombre}, notamos tu inasistencia a la reunión "{reunion}". Por favor contáctanos.`); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${notifyTarget === 'absent' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-500'}`}
                            >
                                Ausentes ({report.filter(r => !r.asistio).length})
                            </button>
                            <button 
                                onClick={() => { setNotifyTarget('all'); setNotifyMessage(`Hola {nombre}, gracias por asistir a "{reunion}".`); }}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${notifyTarget === 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500'}`}
                            >
                                Todos ({report.length})
                            </button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Plantilla del Mensaje</label>
                        <textarea 
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                            value={notifyMessage}
                            onChange={(e) => setNotifyMessage(e.target.value)}
                        ></textarea>
                        <p className="text-xs text-gray-400 mt-1">Variables dinámicas: <code>{`{nombre}`}</code>, <code>{`{reunion}`}</code></p>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Lista de Envíos</label>
                        <p className="text-[10px] text-gray-400 mb-2">Haz clic en el botón verde para abrir WhatsApp Web con cada persona.</p>
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {notificationList.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No hay destinatarios en esta lista.</p>
                            ) : (
                                notificationList.map((item, idx) => {
                                    const url = formatWhatsAppUrl(item.docente.telefono, item.docente.nombre, notifyMessage);
                                    return (
                                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 hover:bg-gray-100">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-700">{item.docente.nombre}</span>
                                                <span className="text-[10px] text-gray-400">{item.docente.telefono || 'Sin Teléfono'}</span>
                                            </div>
                                            {url ? (
                                                <a 
                                                    href={url} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    onClick={() => showToast('Chat de WhatsApp abierto', 'success')}
                                                    className="bg-[#25D366] text-white p-2 rounded-full hover:bg-green-600 transition-colors shadow-sm"
                                                >
                                                    <WhatsAppIcon className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-300 px-2">No disponible</span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MeetingDetails;
