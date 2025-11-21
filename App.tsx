
import React, { useState, useEffect } from 'react';
import { UsersIcon, CalendarIcon, CheckCircleIcon, ClipboardListIcon, SettingsIcon, ArrowLeftIcon, SparklesIcon, QrCodeIcon } from './components/Icons';
import { AppRoute } from './types';
import Dashboard from './pages/Dashboard';
import Teachers from './pages/Teachers';
import Meetings from './pages/Meetings';
import AttendanceForm from './pages/AttendanceForm';
import MasterAttendance from './pages/MasterAttendance';
import Settings from './pages/Settings';
import AIAssistant from './components/AIAssistant';
import { ToastProvider } from './components/Toast';
import { getSchoolLogo, getSchoolName, getSchoolTagline, getCloudUrl, syncFromCloud } from './services/storageService';

// Simple Hash Router implementation
const App: React.FC = () => {
  const [route, setRoute] = useState<string>(AppRoute.DASHBOARD);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [currentContextMeetingId, setCurrentContextMeetingId] = useState<number | null>(null);
  
  // Branding State
  const [schoolLogo, setSchoolLogo] = useState('');
  const [schoolName, setSchoolName] = useState('DocenteTrack');
  const [schoolTagline, setSchoolTagline] = useState('');
  
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashFading, setIsSplashFading] = useState(false);

  useEffect(() => {
    // Load branding initial state
    const updateBranding = () => {
        setSchoolLogo(getSchoolLogo());
        setSchoolName(getSchoolName());
        setSchoolTagline(getSchoolTagline());
    };

    updateBranding();

    // Listen for updates from Settings page
    window.addEventListener('branding-updated', updateBranding);

    // GLOBAL AUTOMATIC SYNC - CRITICAL FIX FOR RELOAD
    // 1. Immediate Sync on Mount (Delayed to prevent race conditions)
    const initialSyncTimer = setTimeout(async () => {
        if (navigator.onLine && getCloudUrl()) {
           await syncFromCloud();
        }
    }, 2000);

    // 2. FAST Interval Sync (15s)
    let isSyncInProgress = false;
    const syncInterval = setInterval(async () => {
        if (!navigator.onLine) return;

        const cloudUrl = getCloudUrl();
        
        if (!cloudUrl || isSyncInProgress) return;

        try {
            isSyncInProgress = true;
            await syncFromCloud();
        } catch (e) {
            // Silent fail for background sync
        } finally {
            isSyncInProgress = false;
        }
    }, 15000); 

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const cleanHash = hash.split('?')[0]; 

      if (cleanHash.startsWith('/attend/')) {
        const id = cleanHash.split('/')[2];
        setMeetingId(id);
        setRoute('attendance-form');
        // Don't show splash screen for direct attendance links
        setShowSplash(false);
      } else if (cleanHash === '' || cleanHash === '/') {
        setRoute(AppRoute.DASHBOARD);
        setCurrentContextMeetingId(null);
      } else {
         const routeName = cleanHash.replace(/^\//, ''); 
         setRoute(routeName);
         if (routeName !== AppRoute.MEETINGS) {
            setCurrentContextMeetingId(null);
         }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
        window.removeEventListener('hashchange', handleHashChange);
        window.removeEventListener('branding-updated', updateBranding);
        clearInterval(syncInterval);
        clearTimeout(initialSyncTimer);
    };
  }, []);

  const navigate = (r: string) => {
    window.location.hash = r;
  };

  const handleStartApp = () => {
    setIsSplashFading(true);
    setTimeout(() => {
        setShowSplash(false);
    }, 800); // Match CSS transition duration + a bit
  };

  // 1. Render Attendance Form standalone (bypasses splash screen logic inside useEffect, but safe check here)
  if (route === 'attendance-form' && meetingId) {
    return <AttendanceForm meetingId={meetingId} />;
  }

  return (
    <ToastProvider>
      {/* VISUALLY STUNNING SPLASH SCREEN */}
      {showSplash && (
        <div className={`fixed inset-0 z-[100] bg-slate-950 overflow-hidden flex flex-col items-center justify-center transition-all duration-1000 cubic-bezier(0.7, 0, 0.3, 1) ${isSplashFading ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
            
            {/* 1. Dynamic Background Effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Deep Gradient Mesh */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950"></div>

                {/* Moving Blobs */}
                <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-blob"></div>
                <div className="absolute bottom-4 right-[-10%] w-[60vw] h-[60vw] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" style={{ animationDelay: '2s' }}></div>
                <div className="absolute bottom-[20%] left-[20%] w-[50vw] h-[50vw] bg-cyan-600/10 rounded-full mix-blend-screen filter blur-[80px] animate-blob" style={{ animationDelay: '4s' }}></div>
                
                {/* Grid pattern overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBoNDBWMEgwIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgNDBoNDBWMEgwIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgNDBoNDBWMEgwIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-10"></div>
            </div>

            {/* 2. Main Content Container */}
            <div className="relative z-10 flex flex-col items-center text-center p-8 max-w-4xl w-full">
                
                {/* Logo Section with Pulsing Ring */}
                <div className="relative mb-12 animate-pop-up group cursor-pointer">
                     {/* Outer Glow Rings */}
                     <div className="absolute inset-0 -m-8 rounded-full bg-indigo-500/20 blur-3xl animate-pulse-glow"></div>
                     <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping" style={{ animationDuration: '3s' }}></div>
                     
                     {/* Logo Container */}
                     <div className="relative w-40 h-40 md:w-52 md:h-52 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl border border-white/10 shadow-2xl flex items-center justify-center transform transition-transform duration-500 hover:scale-105 hover:rotate-3 backdrop-blur-md">
                         {schoolLogo ? (
                             <img src={schoolLogo} alt="Logo" className="w-4/5 h-4/5 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                         ) : (
                             <span className="text-8xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-indigo-300 via-white to-purple-300 font-['Outfit']">
                                {schoolName.charAt(0)}
                             </span>
                         )}
                     </div>
                </div>

                {/* Text Info */}
                <div className="space-y-4 relative">
                    <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-cyan-200 tracking-tight font-['Outfit'] animate-tracking-in animate-gradient-x">
                        {schoolName}
                    </h1>
                    
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto my-6 animate-scale-in"></div>

                    {schoolTagline ? (
                        <p className="text-xl md:text-2xl text-indigo-200/80 font-light tracking-wide animate-entrance delay-200">
                            {schoolTagline}
                        </p>
                    ) : (
                        <p className="text-xl md:text-2xl text-slate-400 font-light tracking-wide animate-entrance delay-200">
                            Plataforma de Gestión Inteligente
                        </p>
                    )}
                </div>

                {/* Interactive Start Button */}
                <div className="mt-12 animate-entrance delay-500">
                    <button 
                        onClick={handleStartApp}
                        className="group relative inline-flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full backdrop-blur-md transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:border-indigo-500/50"
                    >
                        <span className="text-lg font-bold text-white tracking-wider uppercase">Ingresar al Sistema</span>
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                             <ArrowLeftIcon className="w-4 h-4 text-white rotate-180" />
                        </div>
                    </button>
                </div>
            </div>
            
            {/* Footer Version Info */}
            <div className="absolute bottom-4 flex flex-col items-center animate-entrance delay-700 gap-2">
                 <div className="flex items-center gap-2 text-slate-500 text-xs font-mono uppercase tracking-widest">
                    <SparklesIcon className="w-3 h-3 text-yellow-500" />
                    <span>DocenteTrack v2.5</span>
                </div>
                <p className="text-[10px] text-slate-600">Secure Environment • Cloud Sync Ready</p>
            </div>
        </div>
      )}

      {/* Main App Layout */}
      <div className="flex min-h-screen bg-transparent">
        {/* Sidebar with Gradient */}
        <aside className="w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-950 text-white flex-shrink-0 hidden md:flex flex-col shadow-2xl z-20 relative overflow-hidden">
          {/* Decorative glow in sidebar */}
          <div className="absolute top-0 left-0 w-full h-1/3 bg-indigo-500/10 blur-3xl pointer-events-none"></div>

          <div className="p-8 relative z-10">
            {/* Animated Logo Container */}
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="relative w-32 h-32 mb-4 animate-float">
                  {/* Backlight Glow */}
                  <div className="absolute inset-0 bg-indigo-500/30 rounded-full blur-2xl"></div>
                  
                  <div className="relative w-full h-full flex items-center justify-center">
                      {schoolLogo ? (
                          <img src={schoolLogo} alt="Logo" className="w-full h-full object-contain drop-shadow-2xl transition-transform hover:scale-105" />
                      ) : (
                          <div className="w-24 h-24 bg-slate-800 rounded-full border-2 border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
                              <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 font-['Outfit']">
                                  {schoolName.charAt(0)}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
              <div className="text-center w-full">
                  <h1 className="text-xl font-bold tracking-tight font-['Outfit'] leading-tight text-shadow">{schoolName}</h1>
                  {schoolTagline && (
                      <p className="text-[10px] font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-300 mt-1 uppercase opacity-90 animate-fade-in">
                          {schoolTagline}
                      </p>
                  )}
                  {!schoolTagline && (
                      <p className="text-xs text-slate-400 mt-1">Gestión Escolar</p>
                  )}
              </div>
            </div>
            
            <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-6"></div>
          
            <nav className="flex-1 space-y-2">
              {[
                { id: AppRoute.DASHBOARD, icon: CheckCircleIcon, label: 'Panel de Control' },
                { id: AppRoute.MEETINGS, icon: CalendarIcon, label: 'Reuniones' },
                { id: AppRoute.MASTER_ATTENDANCE, icon: ClipboardListIcon, label: 'Matriz General' },
                { id: AppRoute.TEACHERS, icon: UsersIcon, label: 'Docentes' },
                { id: AppRoute.SETTINGS, icon: SettingsIcon, label: 'Configuración' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                    route === item.id
                    ? 'text-white shadow-lg shadow-indigo-900/20' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {/* Active Background with Gradient */}
                  {route === item.id && (
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-100 rounded-xl z-0 animate-fade-in"></div>
                  )}
                  
                  <item.icon className={`w-5 h-5 relative z-10 transition-transform duration-300 ${route === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="relative z-10 font-medium">{item.label}</span>
                  
                  {/* Right active indicator */}
                  {route === item.id && (
                      <div className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full z-10 shadow-glow"></div>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6 relative z-10">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 backdrop-blur-sm">
                <p className="text-xs text-slate-300 text-center font-medium">Sistema Seguro v2.5</p>
                <p className="text-[10px] text-slate-500 text-center mt-1">Conexión Encriptada</p>
            </div>
          </div>
        </aside>

        {/* Mobile Header with Glassmorphism */}
        <div className="md:hidden fixed w-full bg-slate-900/90 backdrop-blur-md text-white z-50 px-4 py-3 flex justify-between items-center shadow-lg border-b border-slate-800">
          <div className="flex items-center gap-2">
              {schoolLogo && <img src={schoolLogo} className="w-8 h-8 object-contain" />}
              <span className="font-bold text-lg font-['Outfit']">{schoolName}</span>
          </div>
          <div className="flex gap-3">
              <button onClick={() => navigate(AppRoute.DASHBOARD)} className="p-2 hover:bg-white/10 rounded-lg"><CheckCircleIcon className="w-6 h-6" /></button>
              <button onClick={() => navigate(AppRoute.MEETINGS)} className="p-2 hover:bg-white/10 rounded-lg"><CalendarIcon className="w-6 h-6" /></button>
              <button onClick={() => navigate(AppRoute.SETTINGS)} className="p-2 hover:bg-white/10 rounded-lg"><SettingsIcon className="w-6 h-6" /></button>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto md:ml-0 mt-16 md:mt-0 relative scroll-smooth">
          {route === AppRoute.DASHBOARD && <Dashboard />}
          {route === AppRoute.TEACHERS && <Teachers />}
          {route === AppRoute.MEETINGS && <Meetings onMeetingSelect={setCurrentContextMeetingId} />}
          {route === AppRoute.MASTER_ATTENDANCE && <MasterAttendance />}
          {route === AppRoute.SETTINGS && <Settings />}
          
          <AIAssistant contextMeetingId={currentContextMeetingId} />
        </main>
      </div>
    </ToastProvider>
  );
};

export default App;
