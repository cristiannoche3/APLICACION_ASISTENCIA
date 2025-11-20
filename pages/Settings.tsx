
import React, { useState, useEffect, useRef } from 'react';
import { getCloudUrl, setCloudUrl, getGlobalFormUrl, setGlobalFormUrl, syncFromCloud, exportDatabase, importDatabase, getSchoolLogo, setSchoolLogo, getSchoolName, setSchoolName, getSchoolTagline, setSchoolTagline, getTeachers, getFormEntryId, setFormEntryId } from '../services/storageService';
import { SettingsIcon, DatabaseIcon, SparklesIcon, TrashIcon, XIcon, ClipboardListIcon, DownloadIcon, UploadIcon, EditIcon, CheckCircleIcon, FileTextIcon } from '../components/Icons';
import { useToast } from '../components/Toast';

const APPS_SCRIPT_CODE = `
// --- COPIA Y PEGA ESTO EN APPS SCRIPT ---

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // INTENTA ENCONTRAR LA HOJA DE ASISTENCIA
    // El script busca una hoja que contenga "Respuestas" o "Asistencia"
    let attendanceSheet = ss.getSheetByName('Asistencia');
    if (!attendanceSheet) {
      const sheets = ss.getSheets();
      attendanceSheet = sheets.find(s => s.getName().toLowerCase().includes('respuestas')) || sheets[0];
    }

    const data = {
      status: 'success',
      attendance: attendanceSheet ? getSheetData(attendanceSheet) : []
    };
    
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', error: e.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    lock.releaseLock();
  }
}

function getSheetData(sheet) {
  const range = sheet.getDataRange();
  const values = range.getDisplayValues(); 
  if (values.length < 2) return [];
  
  const headers = values[0];
  
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      // Normalización de cabeceras para que la App entienda
      let key = header.toLowerCase().trim();
      let val = row[index];

      if (key.includes('marca') || key.includes('timestamp') || key.includes('fecha')) key = 'Timestamp';
      if (key.includes('email') || key.includes('correo') || key.includes('dirección')) key = 'Email Address';
      if (key.includes('nombre') || key.includes('docente') || key.includes('apellido')) key = 'Nombre';
      if (key.includes('reunión') || key.includes('evento') || key.includes('asunto')) key = 'Reunión';

      obj[header] = val; 
      obj[key] = val;
    });
    return obj;
  });
}
`;

const Settings: React.FC = () => {
  const [cloudUrl, setCloudUrlState] = useState('');
  const [globalFormUrl, setGlobalFormUrlState] = useState('');
  const [formEntryId, setFormEntryIdState] = useState('');
  
  const [brandingName, setBrandingName] = useState('');
  const [brandingLogo, setBrandingLogo] = useState('');
  const [brandingTagline, setBrandingTagline] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [testLink, setTestLink] = useState('');
  const [guideStep, setGuideStep] = useState<1 | 2 | 3 | 4>(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    setCloudUrlState(getCloudUrl());
    setGlobalFormUrlState(getGlobalFormUrl());
    setFormEntryIdState(getFormEntryId());
    setBrandingName(getSchoolName());
    setBrandingLogo(getSchoolLogo());
    setBrandingTagline(getSchoolTagline());
  }, []);

  const handleSaveCloudUrl = () => {
    let cleanUrl = cloudUrl.trim();
    if (!cleanUrl) {
        showToast('La URL no puede estar vacía', 'error');
        return;
    }
    if (cleanUrl.includes('/edit')) {
        cleanUrl = cleanUrl.replace(/\/edit.*$/, '/exec');
        setCloudUrlState(cleanUrl);
    }
    setCloudUrl(cleanUrl);
    showToast('URL de Sincronización guardada', 'success');
  };

  const handleSaveGlobalFormUrl = () => {
    setGlobalFormUrl(globalFormUrl);
    setFormEntryId(formEntryId);
    showToast('Configuración del Formulario guardada', 'success');
    setTestLink(''); // Reset test
  };

  const handleSaveBranding = () => {
      setSchoolName(brandingName);
      setSchoolLogo(brandingLogo);
      setSchoolTagline(brandingTagline);
      showToast('Identidad institucional actualizada', 'success');
      window.dispatchEvent(new Event('branding-updated'));
  };

  const handleSync = async () => {
    if(!cloudUrl) {
        showToast('Primero configura la URL de Google Apps Script', 'info');
        return;
    }
    setIsSyncing(true);
    const success = await syncFromCloud();
    if (success) {
        showToast('¡Conexión exitosa! Datos sincronizados.', 'success');
        window.dispatchEvent(new Event('branding-updated'));
    } else {
        showToast('Error de conexión. Verifica la URL y permisos.', 'error');
    }
    setIsSyncing(false);
  };

  const handleResetApp = () => {
      if (window.confirm('¡PELIGRO! ¿Borrar TODOS los datos locales?')) {
          const confirmText = window.prompt('Escribe "BORRAR" para confirmar:');
          if (confirmText === 'BORRAR') {
              localStorage.clear();
              window.location.reload();
          }
      }
  };

  const handleExport = () => {
    const jsonString = exportDatabase();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `docentetrack_backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content && window.confirm('¿Restaurar datos? Esto sobrescribirá lo actual.')) {
             if (importDatabase(content)) {
                showToast('Restauración exitosa', 'success');
                window.dispatchEvent(new Event('branding-updated'));
             }
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copiado al portapapeles', 'success');
  };

  const generateTestLink = () => {
      if (!globalFormUrl || !formEntryId) {
          showToast('Guarda primero el Link y el ID', 'error');
          return;
      }
      
      try {
          const url = new URL(globalFormUrl);
          url.searchParams.set(formEntryId, 'PRUEBA_EXITOSA');
          url.searchParams.set('usp', 'pp_url');
          setTestLink(url.toString());
      } catch (e) {
          // Fallback
          const separator = globalFormUrl.includes('?') ? '&' : '?';
          const link = `${globalFormUrl}${separator}${formEntryId}=PRUEBA_EXITOSA&usp=pp_url`;
          setTestLink(link);
      }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-indigo-600" />
          Configuración del Sistema
        </h1>
      </div>

      <div className="space-y-8">
        {/* Branding */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700"><EditIcon className="w-5 h-5" /></div>
                <h2 className="text-xl font-bold text-gray-800">Identidad Institucional</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Nombre</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={brandingName} onChange={(e) => setBrandingName(e.target.value)} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Logo URL</label>
                    <input type="url" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={brandingLogo} onChange={(e) => setBrandingLogo(e.target.value)} />
                </div>
            </div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Lema</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={brandingTagline} onChange={(e) => setBrandingTagline(e.target.value)} />
            <div className="mt-4 text-right">
                 <button onClick={handleSaveBranding} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 font-medium">Guardar</button>
            </div>
        </div>
        
        {/* Backup */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700"><DatabaseIcon className="w-5 h-5" /></div>
                <h2 className="text-xl font-bold text-gray-800">Respaldo de Datos</h2>
            </div>
            <div className="flex gap-4">
                <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-medium border border-gray-200">
                    <DownloadIcon className="w-4 h-4" /> Descargar JSON
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-3 rounded-lg font-medium border border-indigo-100">
                    <UploadIcon className="w-4 h-4" /> Restaurar JSON
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
            </div>
        </div>

        {/* Integration */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-700"><SparklesIcon className="w-5 h-5" /></div>
                    <h2 className="text-xl font-bold text-gray-800">Conexión Google Forms</h2>
                </div>
                <button onClick={() => { setGuideStep(1); setShowScriptModal(true); }} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 flex items-center gap-1 shadow-sm animate-pulse">
                    <SparklesIcon className="w-3 h-3" /> Ver Guía Paso a Paso (IMPORTANTE)
                </button>
            </div>
            
            <div className="space-y-6">
                {/* Step 1: Form URL */}
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                         <ClipboardListIcon className="w-20 h-20" />
                    </div>
                    
                    <div className="relative z-10">
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">1. Link "Enviar" del Formulario</label>
                        <input 
                            type="url" 
                            placeholder="Ej: https://docs.google.com/forms/d/e/1FAIpQLSe.../viewform"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-4 bg-white"
                            value={globalFormUrl}
                            onChange={(e) => setGlobalFormUrlState(e.target.value)}
                        />
                        
                        <div className="flex items-center gap-2 mb-2 mt-4">
                            <label className="text-xs font-bold text-indigo-800 uppercase tracking-wider">
                                2. ID de la Pregunta "Nombre de la Reunión"
                            </label>
                            <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">Modo Automático</span>
                        </div>
                        
                        <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                            Pega aquí el <strong>"Vínculo Prellenado"</strong> completo que copiaste de Google Forms (ver guía arriba).
                            El sistema buscará y extraerá el código <code>entry.xxxx</code> automáticamente.
                        </p>
                        
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                placeholder="Pega aquí el enlace larguísimo que copiaste..."
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono text-gray-600"
                                value={formEntryId}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Extract entry.xxxx from full url if pasted
                                    const match = val.match(/entry\.\d+/);
                                    if (match) {
                                        setFormEntryIdState(match[0]);
                                        showToast('¡Código extraído! ' + match[0], 'success');
                                    } else {
                                        setFormEntryIdState(val);
                                    }
                                }}
                            />
                            <button onClick={handleSaveGlobalFormUrl} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 font-medium shadow-sm">
                                Guardar
                            </button>
                        </div>

                        {globalFormUrl && formEntryId && (
                            <div className="bg-white rounded-lg border border-green-200 p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Configuración Activa</span>
                                    <button onClick={generateTestLink} className="text-xs text-indigo-600 hover:underline">Probar Link Generado</button>
                                </div>
                                {testLink && (
                                    <div className="text-xs bg-gray-50 p-2 rounded border border-gray-100 break-all">
                                        <a href={testLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{testLink}</a>
                                        <p className="text-[10px] text-gray-400 mt-1">Click para verificar que el formulario abre con "PRUEBA_EXITOSA" escrito.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Step 2: Script URL */}
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">3. URL del Script (Apps Script)</label>
                    <div className="flex gap-2">
                        <input 
                            type="url" 
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={cloudUrl}
                            onChange={(e) => setCloudUrlState(e.target.value)}
                            placeholder="https://script.google.com/macros/s/..."
                        />
                        <button onClick={handleSaveCloudUrl} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 font-medium shadow-sm">Guardar</button>
                    </div>
                    <button onClick={handleSync} disabled={isSyncing} className="mt-3 text-sm text-green-700 font-medium hover:underline flex items-center gap-1">
                        {isSyncing ? 'Sincronizando...' : '🔄 Probar Conexión'}
                    </button>
                </div>
            </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-50 rounded-xl p-8 shadow-sm border border-red-100">
            <h2 className="text-xl font-bold text-red-800 mb-2">Zona de Peligro</h2>
            <button onClick={handleResetApp} className="flex items-center gap-2 bg-white border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-600 hover:text-white transition-colors font-medium text-sm shadow-sm">
                <TrashIcon className="w-4 h-4" /> Borrar Todo
            </button>
        </div>
      </div>

      {/* Interactive Guide Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] overflow-hidden flex flex-col">
                
                {/* Modal Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900 font-bold">
                            {guideStep}
                        </div>
                        <h2 className="text-lg font-bold">Configuración Maestra Paso a Paso</h2>
                    </div>
                    <button onClick={() => setShowScriptModal(false)} className="hover:bg-slate-800 p-2 rounded-full transition-colors"><XIcon className="w-6 h-6" /></button>
                </div>
                
                {/* Modal Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8">
                    
                    {/* STEP 1: FORM STRUCTURE */}
                    {guideStep === 1 && (
                        <div className="animate-fade-in space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-slate-800">1. Anatomía del Formulario</h3>
                                <p className="text-slate-500">Tu Google Form debe verse EXACTAMENTE así para que funcione.</p>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
                                {/* Form Header Sim */}
                                <div className="border-t-8 border-purple-600 rounded-t-lg mb-6 pt-4 px-4">
                                    <h4 className="text-3xl font-normal text-black mb-2">Control de Asistencia</h4>
                                    <p className="text-sm text-gray-600">Registro automático de docentes.</p>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Question 1 */}
                                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-medium">Correo electrónico</span>
                                            <span className="text-xs text-red-500">* Obligatorio</span>
                                        </div>
                                        <input type="text" disabled placeholder="juan.perez@colegio.edu" className="w-full border-b border-gray-300 py-1 bg-transparent" />
                                    </div>

                                    {/* Question 2 - CORRECTED to Dropdown */}
                                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative">
                                        <div className="absolute top-2 right-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">
                                            RECOMENDADO
                                        </div>
                                        <div className="mb-2 font-medium">Nombre del Docente</div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-xs bg-gray-200 px-2 py-1 rounded font-mono flex items-center gap-1">
                                                <span>▼</span> Lista Desplegable
                                            </div>
                                        </div>
                                        <div className="border border-gray-300 rounded p-2 bg-gray-50 text-sm text-gray-500 flex justify-between items-center cursor-not-allowed">
                                            <span>Seleccionar nombre...</span>
                                            <span className="text-xs">▼</span>
                                        </div>
                                        <div className="mt-3 text-xs text-gray-500 bg-blue-50 p-2 rounded border border-blue-100">
                                            <strong>💡 Tip Pro:</strong> Copia la lista de nombres de la sección "Docentes" de esta App y pégala en las opciones del formulario para evitar errores de escritura.
                                        </div>
                                    </div>

                                    {/* Question 3 - CRITICAL */}
                                    <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-400 shadow-md relative">
                                        <div className="absolute -right-2 -top-2 bg-red-500 text-white text-xs px-2 py-1 rounded font-bold shadow-sm">¡CLAVE!</div>
                                        <div className="mb-2 font-bold text-gray-800">Nombre de la Reunión</div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-xs bg-gray-200 px-2 py-1 rounded font-mono">Respuesta corta</div>
                                            <span className="text-xs text-red-600 font-bold">← NO usar "Desplegable" aquí</span>
                                        </div>
                                        <input type="text" disabled placeholder="El sistema llenará esto automáticamente" className="w-full border-b border-gray-300 py-1 bg-transparent italic text-gray-500" />
                                        <div className="mt-1 text-[10px] text-gray-400">
                                            * El NOMBRE DEL DOCENTE debe ser <strong>Desplegable</strong>.<br/>
                                            * El NOMBRE DE LA REUNIÓN debe ser <strong>Respuesta Corta</strong>.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: GET PRE-FILLED LINK */}
                    {guideStep === 2 && (
                        <div className="animate-fade-in space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-slate-800">2. El Truco del Vínculo</h3>
                                <p className="text-slate-500">Cómo obtener el "ID Mágico" (entry.xxxx) para que la App escriba por ti.</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <span className="bg-indigo-100 text-indigo-700 font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
                                        <p className="text-sm text-gray-700">En tu Formulario (modo edición), clic en los <strong>3 puntos verticales (⋮)</strong> arriba a la derecha.</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="bg-indigo-100 text-indigo-700 font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
                                        <p className="text-sm text-gray-700">Selecciona <strong>"Obtener vínculo prellenado"</strong> (Get pre-filled link).</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="bg-indigo-100 text-indigo-700 font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
                                        <p className="text-sm text-gray-700">Se abrirá una pestaña nueva. En la pregunta "Nombre de la Reunión", escribe: <strong className="bg-yellow-200 px-1">PRUEBA</strong>.</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="bg-indigo-100 text-indigo-700 font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">4</span>
                                        <p className="text-sm text-gray-700">Baja al final, clic en <strong>"Obtener vínculo"</strong> y luego en <strong>"Copiar vínculo"</strong>.</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="bg-indigo-100 text-indigo-700 font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">5</span>
                                        <p className="text-sm text-gray-700">Pega ese link larguísimo en la casilla de Configuración de esta App.</p>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-100 p-6 rounded-xl flex flex-col items-center justify-center text-center border border-gray-200">
                                    <ClipboardListIcon className="w-16 h-16 text-indigo-300 mb-4" />
                                    <p className="font-bold text-gray-700">¿Qué hace la App?</p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        La App buscará dentro del link algo como:<br/>
                                        <code className="bg-white px-1 py-0.5 rounded border border-gray-300 text-red-500 font-mono mt-1 inline-block">...&entry.192837=PRUEBA</code>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Y guardará solo el número <strong>entry.192837</strong> para usarlo en el futuro.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: GOOGLE SHEET */}
                    {guideStep === 3 && (
                        <div className="animate-fade-in space-y-6">
                             <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold text-slate-800">3. La Hoja de Cálculo (Sheet)</h3>
                                <p className="text-slate-500">Asegúrate de que las respuestas lleguen a un Sheet y se vea así.</p>
                            </div>
                            
                            <div className="overflow-x-auto bg-white rounded-lg border border-green-300 shadow-sm max-w-3xl mx-auto">
                                <div className="bg-green-50 p-2 border-b border-green-200 flex items-center gap-2">
                                    <div className="w-4 h-4 bg-green-600 rounded text-white flex items-center justify-center text-[10px]">✝</div>
                                    <span className="text-sm font-bold text-green-800">Respuestas de formulario 1</span>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-bold">
                                        <tr>
                                            <th className="px-4 py-2 border-r border-gray-200 bg-gray-100 w-10"></th>
                                            <th className="px-4 py-2 border-r border-gray-200">A</th>
                                            <th className="px-4 py-2 border-r border-gray-200">B</th>
                                            <th className="px-4 py-2 border-r border-gray-200">C</th>
                                            <th className="px-4 py-2">D</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-gray-100">
                                            <td className="bg-gray-50 font-bold text-center border-r border-gray-200 text-xs">1</td>
                                            <td className="px-4 py-2 border-r border-gray-200 font-bold">Marca temporal</td>
                                            <td className="px-4 py-2 border-r border-gray-200 font-bold">Correo electrónico</td>
                                            <td className="px-4 py-2 border-r border-gray-200 font-bold">Nombre del Docente</td>
                                            <td className="px-4 py-2 font-bold bg-yellow-50">Nombre de la Reunión</td>
                                        </tr>
                                        <tr>
                                            <td className="bg-gray-50 font-bold text-center border-r border-gray-200 text-xs">2</td>
                                            <td className="px-4 py-2 border-r border-gray-200 text-gray-500">25/10/2023 8:00:00</td>
                                            <td className="px-4 py-2 border-r border-gray-200 text-gray-500">juan@cole...</td>
                                            <td className="px-4 py-2 border-r border-gray-200 text-gray-500">Juan Perez</td>
                                            <td className="px-4 py-2 text-gray-500">Consejo Técnico</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="max-w-2xl mx-auto text-center mt-4 text-sm text-gray-500">
                                <p>El nombre de la hoja (pestaña de abajo) debe ser <strong>"Respuestas de formulario 1"</strong> o simplemente <strong>"Asistencia"</strong>.</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: APPS SCRIPT */}
                    {guideStep === 4 && (
                        <div className="animate-fade-in space-y-6">
                             <div className="text-center mb-4">
                                <h3 className="text-2xl font-bold text-slate-800">4. El Conector (Script)</h3>
                                <p className="text-slate-500">El paso final para que la App "lea" tu Sheet.</p>
                            </div>

                            <div className="bg-gray-900 rounded-xl p-4 relative group mb-6">
                                <div className="absolute top-3 right-3">
                                    <button onClick={() => copyToClipboard(APPS_SCRIPT_CODE)} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs transition-colors">
                                        Copiar Código
                                    </button>
                                </div>
                                <pre className="text-green-400 font-mono text-xs overflow-x-auto h-48 custom-scrollbar p-2">{APPS_SCRIPT_CODE}</pre>
                            </div>

                            <div className="bg-white rounded-xl border border-indigo-100 p-6 shadow-sm">
                                <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><UploadIcon className="w-5 h-5"/> Cómo desplegar (Deploy) sin errores:</h4>
                                <ol className="space-y-3 text-sm text-gray-700 list-decimal ml-5">
                                    <li>En tu Google Sheet, ve a <strong>Extensiones {'>'} Apps Script</strong>.</li>
                                    <li>Borra cualquier código que haya y <strong>PEGA</strong> el código de arriba.</li>
                                    <li>Haz clic en el botón azul <strong>"Implementar"</strong> (Deploy) {'>'} <strong>"Nueva implementación"</strong>.</li>
                                    <li>
                                        <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded text-orange-800">
                                            <strong>⚠️ CONFIGURACIÓN CRÍTICA:</strong><br/>
                                            - Tipo: <strong>Aplicación web</strong><br/>
                                            - Ejecutar como: <strong>Yo</strong> (Tu email)<br/>
                                            - Quién tiene acceso: <strong>Cualquiera (Anyone)</strong> ← ¡Fundamental!
                                        </div>
                                    </li>
                                    <li>Copia la <strong>URL de la aplicación web</strong> que te da al final y pégala en la Configuración de la App (Campo 3).</li>
                                </ol>
                            </div>
                        </div>
                    )}

                </div>

                {/* Modal Footer (Navigation) */}
                <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-t border-gray-200 shrink-0">
                    <button 
                        onClick={() => setGuideStep(prev => Math.max(prev - 1, 1) as any)}
                        disabled={guideStep === 1}
                        className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                        Anterior
                    </button>
                    
                    <div className="flex gap-2">
                        {[1, 2, 3, 4].map(step => (
                            <div key={step} className={`w-2.5 h-2.5 rounded-full transition-colors ${guideStep === step ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                        ))}
                    </div>

                    {guideStep < 4 ? (
                        <button 
                            onClick={() => setGuideStep(prev => Math.min(prev + 1, 4) as any)}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-transform active:scale-95"
                        >
                            Siguiente
                        </button>
                    ) : (
                         <button 
                            onClick={() => setShowScriptModal(false)}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md transition-transform active:scale-95 font-bold flex items-center gap-2"
                        >
                            <CheckCircleIcon className="w-4 h-4" /> Finalizar
                        </button>
                    )}
                </div>

            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
