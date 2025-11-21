
import React, { useState, useEffect } from 'react';
import { Teacher } from '../types';
import { getTeachers, saveTeacher, deleteTeacher, updateTeacher } from '../services/storageService';
import { PlusIcon, TrashIcon, UsersIcon, EditIcon, XIcon, CopyIcon, WhatsAppIcon, ClipboardListIcon, CheckCircleIcon, ArrowLeftIcon } from '../components/Icons';
import { useToast } from '../components/Toast';

// Lista exhaustiva de roles escolares y asignaturas
const SCHOOL_ROLES = [
  // Directivos
  "Rector(a)",
  "Coordinador(a) Académico",
  "Coordinador(a) de Convivencia",
  "Director(a) Rural",
  
  // Administrativos y Apoyo
  "Secretario(a) Académico",
  "Auxiliar Administrativo",
  "Tesorero(a) / Pagador(a)",
  "Psicoorientador(a) / Consejería",
  "Trabajador(a) Social",
  "Bibliotecario(a)",
  "Enfermero(a)",
  "Jefe de Laboratorio",
  
  // Docentes por Nivel/Área
  "Director(a) de Grupo",
  "Docente de Preescolar",
  "Docente de Primaria",
  "Docente de Matemáticas",
  "Docente de Lengua Castellana / Español",
  "Docente de Inglés / Lenguas Extranjeras",
  "Docente de Ciencias Naturales / Biología",
  "Docente de Química",
  "Docente de Física",
  "Docente de Ciencias Sociales",
  "Docente de Filosofía",
  "Docente de Ciencias Políticas / Económicas",
  "Docente de Educación Ética y Valores",
  "Docente de Educación Religiosa",
  "Docente de Educación Física, Recreación y Deportes",
  "Docente de Educación Artística / Música",
  "Docente de Tecnología e Informática",
  "Docente de Emprendimiento",
  
  // Servicios y Logística
  "Jefe de Mantenimiento",
  "Servicios Generales / Aseo",
  "Seguridad / Portería",
  "Conductor(a) de Ruta",
  "Personal de Cocina / PAE",
  
  // Otros
  "Otro / Escribir manual"
];

const Teachers: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form States
  const [formData, setFormData] = useState({ nombre: '', correo: '', cargo: '', telefono: '' });
  const [selectedRole, setSelectedRole] = useState(SCHOOL_ROLES[15]); // Default to Math teacher
  const [customRole, setCustomRole] = useState('');

  // Import States
  const [importStep, setImportStep] = useState<'input' | 'review'>('input');
  const [csvContent, setCsvContent] = useState('');
  const [parsedTeachers, setParsedTeachers] = useState<{tempId: number, nombre: string, correo: string, telefono: string, cargo: string}[]>([]);
  const [bulkRole, setBulkRole] = useState(SCHOOL_ROLES[15]);

  const { showToast } = useToast();

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = () => {
    setTeachers(getTeachers());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine final role
    let finalRole = selectedRole;
    if (selectedRole === "Otro / Escribir manual") {
        if (!customRole.trim()) {
            showToast('Por favor escribe el nombre del cargo manual', 'error');
            return;
        }
        finalRole = customRole.trim();
    }

    if (!formData.nombre || !finalRole) return;
    
    const teacherData = { ...formData, cargo: finalRole };

    if (editingId) {
      updateTeacher({ ...teacherData, id: editingId });
      showToast('Personal actualizado correctamente', 'success');
    } else {
      saveTeacher(teacherData);
      showToast('Personal agregado correctamente', 'success');
    }
    
    resetForm();
    loadTeachers();
  };

  const handleAnalyzeImport = () => {
      if (!csvContent.trim()) return;

      const lines = csvContent.split('\n');
      const parsed = lines.map((line, index) => {
          // Remove quotes if present
          const cleanLine = line.replace(/"/g, '');
          // Split by Tab (\t) or comma
          const parts = cleanLine.includes('\t') ? cleanLine.split('\t') : cleanLine.split(',');
          
          if (parts.length >= 1 && parts[0].trim()) {
              // Check if Column 4 (Cargo) exists
              const importedRole = parts[3] ? parts[3].trim() : null;
              const defaultRole = importedRole || SCHOOL_ROLES[15]; // Default if not provided

              return {
                  tempId: Date.now() + index,
                  nombre: parts[0].trim(),
                  correo: parts[1] ? parts[1].trim() : '',
                  telefono: parts[2] ? parts[2].trim() : '',
                  cargo: defaultRole
              };
          }
          return null;
      }).filter((item): item is {tempId: number, nombre: string, correo: string, telefono: string, cargo: string} => item !== null);

      if (parsed.length === 0) {
          showToast('No se detectaron datos válidos', 'error');
          return;
      }

      setParsedTeachers(parsed);
      setImportStep('review');
  };

  const handleFinalImport = () => {
      let successCount = 0;
      parsedTeachers.forEach(t => {
          saveTeacher({ 
              nombre: t.nombre, 
              correo: t.correo, 
              cargo: t.cargo, 
              telefono: t.telefono 
          });
          successCount++;
      });

      showToast(`Importación finalizada. ${successCount} registros creados.`, 'success');
      
      // Reset
      setCsvContent('');
      setParsedTeachers([]);
      setImportStep('input');
      setShowImportModal(false);
      loadTeachers();
  };

  const updateParsedRole = (tempId: number, newRole: string) => {
      setParsedTeachers(prev => prev.map(p => p.tempId === tempId ? { ...p, cargo: newRole } : p));
  };

  const handleBulkApply = () => {
      if (window.confirm(`¿Asignar "${bulkRole}" a todos los docentes de la lista?`)) {
          setParsedTeachers(prev => prev.map(p => ({ ...p, cargo: bulkRole })));
      }
  };

  const handleCopyForForm = () => {
    if (teachers.length === 0) {
        showToast('No hay docentes para copiar', 'error');
        return;
    }
    const names = teachers.map(t => t.nombre).join('\n');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(names)
            .then(() => showToast('¡Lista copiada! Pégala en las opciones de tu Google Form', 'success'))
            .catch(err => {
                console.error(err);
                showToast('Error al acceder al portapapeles', 'error');
            });
    } else {
        // Fallback
        try {
            const textArea = document.createElement("textarea");
            textArea.value = names;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('¡Lista copiada! Pégala en las opciones de tu Google Form', 'success');
        } catch (err) {
            showToast('No se pudo copiar automáticamente.', 'error');
        }
    }
  };

  const handleWhatsApp = (teacher: Teacher) => {
      if (!teacher.telefono) {
          showToast('Este docente no tiene teléfono registrado', 'error');
          return;
      }
      const phone = teacher.telefono.replace(/\D/g, '');
      const url = `https://api.whatsapp.com/send?phone=${phone}`;
      window.open(url, '_blank');
  };

  const handleEdit = (teacher: Teacher) => {
    setFormData({
      nombre: teacher.nombre,
      correo: teacher.correo || '',
      cargo: teacher.cargo,
      telefono: teacher.telefono || ''
    });
    
    if (SCHOOL_ROLES.includes(teacher.cargo)) {
        setSelectedRole(teacher.cargo);
        setCustomRole('');
    } else {
        setSelectedRole("Otro / Escribir manual");
        setCustomRole(teacher.cargo);
    }

    setEditingId(teacher.id);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('¿Estás seguro de eliminar este registro?')) {
      deleteTeacher(id);
      loadTeachers();
    }
  };

  const resetForm = () => {
    setFormData({ nombre: '', correo: '', cargo: '', telefono: '' });
    setSelectedRole(SCHOOL_ROLES[15]);
    setCustomRole('');
    setEditingId(null);
    setShowModal(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 animate-entrance">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-indigo-600" />
            Gestión de Personal
          </h1>
          <p className="text-gray-500 mt-1">Administra docentes, directivos y personal del colegio.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end w-full md:w-auto">
            <button
            onClick={handleCopyForForm}
            className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium text-sm"
            title="Copiar lista de nombres para pegar en Google Forms"
            >
            <CopyIcon className="w-4 h-4" />
            Copiar Nombres
            </button>
            <button
            onClick={() => { setImportStep('input'); setShowImportModal(true); }}
            className="bg-green-600 text-white border border-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium text-sm"
            >
            <ClipboardListIcon className="w-4 h-4" />
            Pegar desde Excel
            </button>
            <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium text-sm"
            >
            <PlusIcon className="w-4 h-4" />
            Nuevo Personal
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in delay-100">
        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                <th className="px-6 py-4 font-semibold text-gray-600 w-1/3">Nombre</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Cargo / Asignatura</th>
                <th className="px-6 py-4 font-semibold text-gray-600">Contacto</th>
                <th className="px-6 py-4 font-semibold text-gray-600 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {teachers.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                        <UsersIcon className="w-12 h-12 text-gray-300 mb-2" />
                        <p>No hay personal registrado.</p>
                        <button onClick={() => setShowModal(true)} className="text-indigo-600 hover:underline text-sm mt-2">Agregar el primero</button>
                    </div>
                    </td>
                </tr>
                ) : (
                teachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                        {teacher.nombre}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold border border-indigo-100 inline-block uppercase tracking-wide">
                        {teacher.cargo}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                        <div className="flex flex-col gap-1">
                            {teacher.correo ? (
                                <span className="text-sm text-gray-700 flex items-center gap-1">
                                    ✉️ {teacher.correo}
                                </span>
                            ) : (
                                <span className="text-xs text-gray-300 italic">Sin correo</span>
                            )}
                            {teacher.telefono && (
                                <span className="text-xs text-gray-500">📞 {teacher.telefono}</span>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                            <button
                            onClick={() => handleWhatsApp(teacher)}
                            className={`p-2 rounded-full transition-colors border ${teacher.telefono ? 'text-[#25D366] hover:bg-green-50 border-transparent hover:border-green-200' : 'text-gray-300 cursor-not-allowed'}`}
                            title="Enviar WhatsApp"
                            disabled={!teacher.telefono}
                            >
                            <WhatsAppIcon className="w-5 h-5" />
                            </button>
                            <button
                            onClick={() => handleEdit(teacher)}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-full transition-colors"
                            title="Editar"
                            >
                            <EditIcon className="w-5 h-5" />
                            </button>
                            <button
                            onClick={() => handleDelete(teacher.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-full transition-colors"
                            title="Eliminar"
                            >
                            <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </td>
                    </tr>
                ))
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* Import Modal (Excel Paste) */}
      {showImportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className={`bg-white rounded-xl shadow-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scale-in transition-all ${importStep === 'review' ? 'max-w-5xl' : 'max-w-3xl'}`}>
                <div className="bg-green-600 text-white px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ClipboardListIcon className="w-6 h-6" />
                        {importStep === 'input' ? 'Importar desde Excel' : 'Revisar y Asignar Roles'}
                    </h2>
                    <button onClick={() => setShowImportModal(false)} className="hover:bg-green-700 p-1 rounded"><XIcon className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    
                    {/* STEP 1: INPUT */}
                    {importStep === 'input' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-bold text-gray-700 mb-2">1. Copia y pega las columnas de Excel</label>
                            <p className="text-sm text-gray-500 mb-3">
                                Selecciona las columnas en tu archivo Excel (Nombre, Correo, Teléfono y opcionalmente Cargo) y pégalas aquí.
                            </p>

                            {/* Excel Visual Guide */}
                            <div className="flex mb-2 text-xs font-mono font-bold text-gray-500 border-b-2 border-gray-300 pb-1 bg-gray-100 rounded-t-md">
                                <div className="w-1/4 px-2 py-1 border-r border-gray-300">A: Nombre</div>
                                <div className="w-1/4 px-2 py-1 border-r border-gray-300">B: Correo</div>
                                <div className="w-1/4 px-2 py-1 border-r border-gray-300">C: Teléfono</div>
                                <div className="w-1/4 px-2 py-1">D: Cargo (Opcional)</div>
                            </div>
                            
                            <textarea 
                                className="w-full h-64 border border-gray-300 rounded-b-lg p-3 font-mono text-sm focus:ring-2 focus:ring-green-500 outline-none whitespace-pre"
                                placeholder={`Juan Perez\tjuan@email.com\t3001234567\tDocente de Matemáticas\nMaria Lopez\tmaria@email.com\t3109876543\tCoordinadora`}
                                value={csvContent}
                                onChange={(e) => setCsvContent(e.target.value)}
                                autoFocus
                            />
                            <p className="text-xs text-gray-400 mt-1 text-right">
                                * El sistema detecta automáticamente las tabulaciones de Excel. Si incluyes el Cargo, se asignará automáticamente.
                            </p>
                        </div>
                    )}

                    {/* STEP 2: REVIEW */}
                    {importStep === 'review' && (
                        <div className="animate-fade-in flex flex-col h-full">
                            {/* Bulk Action Header */}
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 mb-4 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-green-800 uppercase">Asignación Rápida:</span>
                                    <select 
                                        value={bulkRole} 
                                        onChange={(e) => setBulkRole(e.target.value)}
                                        className="border border-green-300 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-green-500 outline-none"
                                    >
                                        {SCHOOL_ROLES.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                    <button 
                                        onClick={handleBulkApply}
                                        className="bg-green-600 text-white px-3 py-1 rounded-md text-xs font-bold hover:bg-green-700"
                                    >
                                        Aplicar a Todos
                                    </button>
                                </div>
                                <span className="text-xs text-gray-500">Total: <strong>{parsedTeachers.length}</strong> registros</span>
                            </div>

                            {/* Scrollable List */}
                            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg custom-scrollbar max-h-[50vh]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-bold sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-2 border-b">Nombre</th>
                                            <th className="px-4 py-2 border-b w-1/3">Cargo (Editable)</th>
                                            <th className="px-4 py-2 border-b">Contacto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {parsedTeachers.map((t) => (
                                            <tr key={t.tempId} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 font-medium">{t.nombre}</td>
                                                <td className="px-4 py-2">
                                                    <select 
                                                        value={t.cargo} 
                                                        onChange={(e) => updateParsedRole(t.tempId, e.target.value)}
                                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                                                    >
                                                        {SCHOOL_ROLES.map(role => (
                                                            <option key={role} value={role}>{role}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2 text-gray-500 text-xs">
                                                    {t.correo && <div>{t.correo}</div>}
                                                    {t.telefono && <div>{t.telefono}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-4 flex justify-between border-t border-gray-200">
                    {importStep === 'input' ? (
                        <>
                            <button 
                                onClick={() => setShowImportModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleAnalyzeImport}
                                disabled={!csvContent.trim()}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 shadow-md font-bold flex items-center gap-2"
                            >
                                Revisar y Asignar Roles →
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => setImportStep('input')}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors font-medium flex items-center gap-2"
                            >
                                <ArrowLeftIcon className="w-4 h-4" /> Volver
                            </button>
                            <button 
                                onClick={handleFinalImport}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md font-bold flex items-center gap-2"
                            >
                                <CheckCircleIcon className="w-4 h-4" />
                                Confirmar e Importar
                            </button>
                        </>
                    )}
                </div>
            </div>
          </div>
      )}

      {/* Add/Edit Teacher Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                {editingId ? 'Editar Información' : 'Nuevo Registro'}
              </h2>
              <button onClick={resetForm} className="text-white/80 hover:bg-white/10 p-1 rounded"><XIcon className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Pepito Pérez"
                />
              </div>

              {/* Role Dropdown */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Cargo / Asignatura</label>
                <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all cursor-pointer text-sm"
                    value={selectedRole}
                    onChange={(e) => {
                        setSelectedRole(e.target.value);
                        if (e.target.value !== "Otro / Escribir manual") {
                            setCustomRole('');
                        }
                    }}
                >
                    {SCHOOL_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>

                {selectedRole === "Otro / Escribir manual" && (
                    <div className="mt-2 animate-fade-in">
                         <input
                            type="text"
                            required
                            autoFocus
                            className="w-full border border-indigo-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50 text-indigo-900 placeholder-indigo-300 text-sm"
                            value={customRole}
                            onChange={(e) => setCustomRole(e.target.value)}
                            placeholder="Escribe el nombre del cargo..."
                        />
                    </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <div className="flex justify-between">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                        <span className="text-[10px] text-gray-400 uppercase font-bold mt-1">Opcional</span>
                    </div>
                    <input
                      type="email"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="usuario@colegio.edu"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (WhatsApp)</label>
                    <input
                      type="tel"
                      placeholder="300 123 4567"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md hover:shadow-lg"
                >
                  {editingId ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teachers;
