
import React, { useState, useEffect } from 'react';
import { Teacher, Meeting } from '../types';
import { getTeachers, getMeetingById, markAttendance, sendAttendanceToCloud, getAttendance, getCloudUrl, getSchoolLogo, getSchoolName, getSchoolTagline } from '../services/storageService';
import { CheckCircleIcon, CalendarIcon, MailIcon, XIcon } from '../components/Icons';

interface Props {
  meetingId: string;
}

const AttendanceForm: React.FC<Props> = ({ meetingId }) => {
  const [step, setStep] = useState<'input' | 'success'>('input');
  const [meeting, setMeeting] = useState<Meeting | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  const [schoolLogo, setSchoolLogo] = useState('');
  const [schoolName, setSchoolName] = useState('DocenteTrack');
  const [schoolTagline, setSchoolTagline] = useState('');

  useEffect(() => {
    const updateBranding = () => {
        setSchoolLogo(getSchoolLogo());
        setSchoolName(getSchoolName());
        setSchoolTagline(getSchoolTagline());
    };
    
    updateBranding();
    window.addEventListener('branding-updated', updateBranding);

    const mId = parseInt(meetingId);
    const m = getMeetingById(mId);
    
    if (!m) {
      setError('Reunión no encontrada o enlace caducado.');
      return;
    }
    setMeeting(m);

    // Try to load saved email from local device
    const savedEmail = localStorage.getItem('dt_saved_email');
    if (savedEmail) {
        setEmail(savedEmail);
    }

    return () => window.removeEventListener('branding-updated', updateBranding);
  }, [meetingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !meeting) return;
    
    setError(null);
    setIsLoading(true);

    // 1. Validate Email Format
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
        setError('Por favor ingresa un correo válido.');
        setIsLoading(false);
        return;
    }

    // 2. Find Teacher by Email (Security Check)
    const allTeachers = getTeachers();
    const teacher = allTeachers.find(t => t.correo.toLowerCase() === cleanEmail);

    if (!teacher) {
        setError('Este correo no está registrado en la base de datos de docentes. Verifica que esté escrito correctamente.');
        setIsLoading(false);
        return;
    }

    // 3. Check for Duplicate Attendance (Uniqueness Check)
    const allAttendance = getAttendance();
    const alreadyAttended = allAttendance.some(a => a.id_reunion === meeting.id && a.id_docente === teacher.id && a.asistio);

    if (alreadyAttended) {
        setError(`Hola ${teacher.nombre}, tu asistencia ya fue registrada anteriormente para esta reunión.`);
        setIsLoading(false);
        return;
    }

    // 4. Save preference
    if (rememberMe) {
        localStorage.setItem('dt_saved_email', cleanEmail);
    } else {
        localStorage.removeItem('dt_saved_email');
    }
    
    // 5. Process Attendance
    // Mark locally
    const localSuccess = markAttendance(meeting.id, teacher.id);
    
    // Send to Cloud if configured
    const cloudUrl = getCloudUrl();
    if (cloudUrl) {
        await sendAttendanceToCloud(meeting.id, teacher.id);
    }

    setTimeout(() => {
        if (localSuccess || cloudUrl) {
            setStep('success');
        } else {
            // Should be caught by step 3, but failsafe
            setError('Error al registrar. Intente nuevamente.');
        }
        setIsLoading(false);
    }, 800);
  };

  const handleBackToAdmin = () => {
      window.location.hash = '';
  };

  // Error Screen for invalid Meeting ID
  if (error && !meeting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 relative">
        <button 
            onClick={handleBackToAdmin}
            className="absolute top-4 left-4 text-gray-500 hover:text-indigo-600 text-sm flex items-center gap-1 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200"
        >
            ← Volver al Panel
        </button>
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-gray-100">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Enlace Inválido</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Success Screen
  if (step === 'success') {
    // Find teacher name again for display
    const teacherName = getTeachers().find(t => t.correo.toLowerCase() === email.trim().toLowerCase())?.nombre;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-6 relative">
        <button 
            onClick={handleBackToAdmin}
            className="absolute top-4 left-4 text-gray-500 hover:text-indigo-600 text-sm flex items-center gap-1 bg-white/80 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-gray-200 hover:bg-white transition-all"
        >
            ← Volver al Panel
        </button>

        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full border border-green-100 animate-fade-in-up relative overflow-hidden">
          <div className="mx-auto w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner relative z-10">
            <CheckCircleIcon className="w-12 h-12" />
          </div>
          
          {schoolLogo && (
              <div className="absolute top-0 right-0 opacity-10 w-32 h-32 pointer-events-none">
                  <img src={schoolLogo} alt="" className="object-contain w-full h-full" />
              </div>
          )}

          <h2 className="text-3xl font-bold text-gray-900 mb-3">¡Asistencia Confirmada!</h2>
          <p className="text-gray-700 text-lg mb-2">
             ¡Gracias por confirmar tu asistencia, <strong>{teacherName}</strong>!
          </p>
          <p className="text-gray-500 mb-8 text-sm">
             Tu registro para la reunión <strong>{meeting?.nombre}</strong> ha sido guardado correctamente.
          </p>
          
          <div className="bg-green-50 rounded-xl p-4 mb-6 border border-green-100">
            <p className="text-xs text-green-800 font-medium uppercase tracking-wider">Comprobante Digital</p>
            <p className="text-sm text-green-700 mt-1">
              {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
          </div>

          <p className="text-sm text-gray-400">Ya puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  // Input Screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 font-sans relative">
        <button 
            onClick={handleBackToAdmin}
            className="absolute top-4 left-4 text-gray-500 hover:text-indigo-600 text-sm flex items-center gap-1 bg-white/80 backdrop-blur px-3 py-2 rounded-lg shadow-sm border border-gray-200 hover:bg-white transition-all z-10"
        >
            ← Volver
        </button>

        {/* School Brand on Form */}
        <div className="mb-8 text-center animate-fade-in w-full">
            {schoolLogo ? (
                <div className="w-32 h-32 mx-auto mb-2 animate-float relative">
                    {/* Soft ambient glow behind logo */}
                    <div className="absolute inset-0 bg-indigo-200/30 blur-xl rounded-full"></div>
                    <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain drop-shadow-xl relative z-10" />
                </div>
            ) : (
                <div className="w-16 h-16 mx-auto bg-indigo-600 rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-2xl mb-4">
                    {schoolName.charAt(0)}
                </div>
            )}
            <h2 className="text-gray-500 font-semibold text-sm uppercase tracking-wider mt-2">{schoolName}</h2>
            {schoolTagline && (
                <p className="text-xs font-bold tracking-widest text-indigo-500 uppercase mt-1 opacity-80">{schoolTagline}</p>
            )}
        </div>

        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 z-0 animate-scale-in">
            {/* Header */}
            <div className="bg-indigo-600 p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-white opacity-10 transform -skew-y-6 origin-top-left"></div>
                <CalendarIcon className="w-10 h-10 text-indigo-200 mx-auto mb-3 relative z-10" />
                <h1 className="text-xl font-bold text-white mb-2 relative z-10 px-2">{meeting?.nombre}</h1>
                <div className="flex items-center justify-center gap-2 text-indigo-100 text-xs relative z-10 font-medium">
                    <span className="bg-indigo-700/50 px-2 py-1 rounded">📅 {meeting && new Date(meeting.fecha).toLocaleDateString()}</span>
                    <span className="bg-indigo-700/50 px-2 py-1 rounded">⏰ {meeting?.hora}</span>
                </div>
            </div>
            
            {/* Form */}
            <div className="p-8">
                <div className="mb-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-800">Validación de Identidad</h3>
                    <p className="text-gray-500 text-sm">Ingresa tu correo institucional para registrarte.</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100 flex items-start gap-2 animate-fade-in">
                        <XIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                                <MailIcon className="w-5 h-5" />
                            </div>
                            <input 
                                type="email"
                                required
                                placeholder="ejemplo@colegio.edu.co"
                                className="w-full p-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex items-center mb-4">
                        <input 
                            id="remember-me" 
                            type="checkbox" 
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-500 cursor-pointer">
                            Recordar mi correo en este dispositivo
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={!email || isLoading}
                        className={`w-full py-3.5 px-6 rounded-xl font-bold text-base shadow-lg transform transition-all duration-200 flex items-center justify-center gap-2
                            ${!email || isLoading 
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:-translate-y-1 hover:shadow-xl active:scale-95'
                            }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Verificando...
                            </span>
                        ) : (
                            <>
                                <CheckCircleIcon className="w-5 h-5" />
                                <span>Registrar Asistencia</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                <p className="text-xs text-gray-400">Sistema Seguro • {schoolName}</p>
            </div>
        </div>
    </div>
  );
};

export default AttendanceForm;
