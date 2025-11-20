
import { Teacher, Meeting, Attendance, AttendanceReportItem, TrendData, RoleStat, RecentActivityItem } from '../types';

// Keys for LocalStorage
const KEYS = {
  TEACHERS: 'dt_teachers',
  MEETINGS: 'dt_meetings',
  ATTENDANCE: 'dt_attendance',
  CLOUD_URL: 'dt_cloud_url', // Google Apps Script URL (Sync)
  GLOBAL_FORM_URL: 'dt_global_form_url', // Global Google Form URL
  FORM_ENTRY_ID: 'dt_form_entry_id', // New: Google Form Field ID for pre-filling meeting name
  SCHOOL_LOGO: 'dt_school_logo', 
  SCHOOL_NAME: 'dt_school_name',
  SCHOOL_TAGLINE: 'dt_school_tagline'
};

// Seed Data (Initial Data)
const seedData = () => {
  try {
    if (!localStorage.getItem(KEYS.TEACHERS)) {
      const teachers: Teacher[] = [
        { id: 1, nombre: 'Juan Pérez', correo: 'juan.perez@colegio.edu', cargo: 'Profesor de Matemáticas', telefono: '5551234567' },
        { id: 2, nombre: 'Maria Garcia', correo: 'maria.garcia@colegio.edu', cargo: 'Coordinadora', telefono: '5559876543' },
        { id: 3, nombre: 'Carlos López', correo: 'carlos.lopez@colegio.edu', cargo: 'Profesor de Historia' },
        { id: 4, nombre: 'Ana Rodriguez', correo: 'ana.rodriguez@colegio.edu', cargo: 'Profesora de Ciencias' },
      ];
      localStorage.setItem(KEYS.TEACHERS, JSON.stringify(teachers));
    }
    if (!localStorage.getItem(KEYS.MEETINGS)) {
      const meetings: Meeting[] = [
        { id: 1, nombre: 'Consejo Técnico Escolar', fecha: '2023-10-25', hora: '08:00', descripcion: 'Reunión mensual para revisar los avances del plan de estudios y tratar asuntos generales de la administración escolar.' },
      ];
      localStorage.setItem(KEYS.MEETINGS, JSON.stringify(meetings));
    }
    if (!localStorage.getItem(KEYS.ATTENDANCE)) {
      localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify([]));
    }
  } catch (e) {
    console.error("Error initializing storage:", e);
  }
};

// Initialize on load
seedData();

// --- Branding Configuration ---

export const getSchoolLogo = (): string => {
    return localStorage.getItem(KEYS.SCHOOL_LOGO) || '';
};

export const setSchoolLogo = (url: string): void => {
    localStorage.setItem(KEYS.SCHOOL_LOGO, url);
};

export const getSchoolName = (): string => {
    return localStorage.getItem(KEYS.SCHOOL_NAME) || 'DocenteTrack';
};

export const setSchoolName = (name: string): void => {
    localStorage.setItem(KEYS.SCHOOL_NAME, name);
};

export const getSchoolTagline = (): string => {
    return localStorage.getItem(KEYS.SCHOOL_TAGLINE) || '';
};

export const setSchoolTagline = (tagline: string): void => {
    localStorage.setItem(KEYS.SCHOOL_TAGLINE, tagline);
};

// --- Cloud Configuration ---

export const getCloudUrl = (): string => {
    return (localStorage.getItem(KEYS.CLOUD_URL) || '').trim();
};

export const setCloudUrl = (url: string): void => {
    localStorage.setItem(KEYS.CLOUD_URL, url.trim());
};

export const getGlobalFormUrl = (): string => {
    return (localStorage.getItem(KEYS.GLOBAL_FORM_URL) || '').trim();
};

export const setGlobalFormUrl = (url: string): void => {
    localStorage.setItem(KEYS.GLOBAL_FORM_URL, url.trim());
};

export const getFormEntryId = (): string => {
    return (localStorage.getItem(KEYS.FORM_ENTRY_ID) || '').trim();
};

export const setFormEntryId = (id: string): void => {
    localStorage.setItem(KEYS.FORM_ENTRY_ID, id.trim());
};

// --- Sync Logic ---

// Helper for text normalization (removes accents, lowercase)
const normalizeText = (text: string) => {
    return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
};

export const syncFromCloud = async (): Promise<boolean> => {
    let url = getCloudUrl();
    if (!url) return false;

    // 1. VALIDATION & SANITIZATION
    // Fix missing protocol which causes "Failed to fetch" or Invalid URL errors
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    if (!url.includes('script.google.com')) {
        console.warn("Sync aborted: Invalid Google Script URL");
        return false;
    }

    // 2. CLEANING: Fix common copy-paste errors
    url = url.trim();
    // Remove query params to rebuild them cleanly
    if (url.includes('?')) url = url.split('?')[0];
    
    // Remove suffixes often copied from browser address bar
    if (url.endsWith('/edit')) url = url.slice(0, -5);
    else if (url.endsWith('/copy')) url = url.slice(0, -5);
    else if (url.endsWith('/dev')) url = url.slice(0, -4);
    else if (url.endsWith('/')) url = url.slice(0, -1);
    
    // Ensure endpoint is /exec for production deployment
    if (!url.endsWith('/exec')) url += '/exec';
    
    try {
        // 3. FETCH: Simple GET with anti-caching
        // We use URL object to safely append parameters
        const fetchUrl = new URL(url);
        fetchUrl.searchParams.set('_t', Date.now().toString());
        
        // Longer timeout for cold-starts of Apps Script
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(fetchUrl.toString(), {
            method: 'GET',
            // 'omit' prevents sending cookies, which is good for CORS to simple endpoints
            credentials: 'omit',
            // 'follow' is required because Google Scripts redirect
            redirect: 'follow',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.error(`Sync failed: Server responded with ${response.status}`);
            return false;
        }

        const textData = await response.text();
        let data;
        
        try {
            data = JSON.parse(textData);
        } catch (e) {
            console.error("Sync failed: Invalid JSON response. Check if script is deployed as 'Anyone'.", textData.substring(0, 100));
            return false;
        }

        if (data.status === 'error') {
            console.error("Sync error from script:", data.error);
            return false;
        }

        let hasChanges = false;

        // SYNC LOGIC - PRIORITIZING EMAIL
        if (data.attendance && Array.isArray(data.attendance) && data.attendance.length > 0) {
             const teachers = getTeachers();
             const meetings = getMeetings();

             // 1. Create Lookup Maps for Performance
             // PRIMARY KEY: EMAIL (Normalized)
             const teacherEmailMap = new Map<string, Teacher>();
             // Fallback Key: Name
             const teacherNameMap = new Map<string, Teacher>();
             
             teachers.forEach(t => {
                 if (t.correo) teacherEmailMap.set(normalizeText(t.correo), t);
                 if (t.nombre) teacherNameMap.set(normalizeText(t.nombre), t);
             });

             // Meeting Maps
             const meetingMap = new Map<string, Meeting>();
             const meetingDateMap = new Map<string, Meeting>(); 
             
             meetings.forEach(m => {
                 if (m.nombre) meetingMap.set(normalizeText(m.nombre), m);
                 if (m.fecha) meetingDateMap.set(m.fecha, m);
             });

             const processedRecords: Attendance[] = [];
             const existingAttendance = getAttendance();
             
             // Create a quick lookup set for existing records to avoid duplicates O(1)
             const existingSet = new Set(existingAttendance.map(a => `${a.id_reunion}-${a.id_docente}`));

             // 2. Loop through Sheets Data
             for (const row of data.attendance) {
                 // If it's already an app record (unlikely from sheets, but possible if exported back), skip or merge
                 if (row.id_docente && row.id_reunion) {
                     continue;
                 }

                 // Extract Data from Sheet Row with Fallbacks
                 const emailInput = row['Email Address'] || row['Correo electrónico'] || row['email'] || row['Dirección de correo electrónico'] || row['Correo'];
                 const nameInput = row['Nombre'] || row['Nombre Completo'] || row['Docente'] || row['Apellidos y Nombres'];
                 const timestamp = row['Marca temporal'] || row['Timestamp'] || row['Fecha'] || row['Fecha y Hora'];
                 
                 if (!timestamp) continue;

                 // --- STEP A: FIND TEACHER (EMAIL PRIORITY) ---
                 let teacher: Teacher | undefined;

                 // 1. Try strict Email match first (Highest Reliability)
                 if (emailInput) {
                     const cleanEmail = normalizeText(String(emailInput));
                     teacher = teacherEmailMap.get(cleanEmail);
                     // Try partial email match if exact fails
                     if (!teacher) {
                        for (const [emailKey, t] of teacherEmailMap.entries()) {
                            if (cleanEmail.includes(emailKey) || emailKey.includes(cleanEmail)) {
                                teacher = t;
                                break;
                            }
                        }
                     }
                 }

                 // 2. If no email match, try Name match (Fallback)
                 if (!teacher && nameInput) {
                     teacher = teacherNameMap.get(normalizeText(String(nameInput)));
                 }

                 if (!teacher) continue; // Docente not identified, skip

                 // --- STEP B: FIND MEETING ---
                 let matchedMeeting: Meeting | undefined;
                 const meetingNameInput = row['Reunión'] || row['Evento'] || row['Nombre de la Reunión'] || row['Nombre del Evento'];

                 if (meetingNameInput) {
                     const normInput = normalizeText(String(meetingNameInput));
                     matchedMeeting = meetingMap.get(normInput);
                     
                     // Fuzzy match fallback
                     if (!matchedMeeting) {
                         for (const [key, m] of meetingMap.entries()) {
                             if (key.includes(normInput) || normInput.includes(key)) {
                                 matchedMeeting = m;
                                 break;
                             }
                         }
                     }
                 }

                 // Fallback to Date Match if Meeting Name not found or not precise
                 if (!matchedMeeting) {
                     let dateStr = "";
                     if (timestamp.includes('T')) dateStr = timestamp.split('T')[0];
                     else dateStr = timestamp.split(' ')[0]; // Handle "25/10/2023 8:00:00"
                     
                     // Try standard ISO first
                     if (meetingDateMap.has(dateStr)) {
                        matchedMeeting = meetingDateMap.get(dateStr);
                     } else {
                         // Try parsing DD/MM/YYYY
                         const parts = dateStr.split(/[-/]/);
                         if (parts.length === 3) {
                             let y, m, d;
                             // Detect format YYYY-MM-DD vs DD-MM-YYYY
                             if (parseInt(parts[0]) > 1000) { y=parts[0]; m=parts[1]; d=parts[2]; }
                             else { d=parts[0]; m=parts[1]; y=parts[2]; }
                             
                             m = m.padStart(2, '0');
                             d = d.padStart(2, '0');
                             const isoDate = `${y}-${m}-${d}`;
                             matchedMeeting = meetingDateMap.get(isoDate);
                         }
                     }
                 }

                 // If we found both Teacher and Meeting, create the record
                 if (matchedMeeting && teacher) {
                     const key = `${matchedMeeting.id}-${teacher.id}`;
                     if (!existingSet.has(key)) {
                         const newRecord: Attendance = {
                             id: Date.now() + Math.random(),
                             id_docente: teacher.id,
                             id_reunion: matchedMeeting.id,
                             fecha_asistencia: timestamp,
                             asistio: true,
                             nota: 'Sincronizado desde Google Sheets'
                         };
                         processedRecords.push(newRecord);
                         existingSet.add(key); 
                     }
                 }
             }

             if (processedRecords.length > 0) {
                 // Merge new records with existing ones
                 const merged = [...existingAttendance, ...processedRecords];
                 localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(merged));
                 hasChanges = true;
             }
        }
        
        if (hasChanges) {
             window.dispatchEvent(new Event('data-updated'));
        }
        return true;
    } catch (e) {
        console.error("Sync exception:", e);
        return false;
    }
};

export const sendAttendanceToCloud = async (id_reunion: number, id_docente: number): Promise<boolean> => {
    let url = getCloudUrl();
    if (!url) return false;

    if (!url.startsWith('http')) url = 'https://' + url;

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            credentials: 'omit',
            redirect: 'follow',
            body: JSON.stringify({
                action: 'register_attendance',
                id_reunion,
                id_docente,
                timestamp: new Date().toISOString()
            })
        });
        return true;
    } catch (e) {
        console.error("Error posting attendance:", e);
        return false;
    }
};


// --- Getters ---
export const getTeachers = (): Teacher[] => {
  try {
    const data = localStorage.getItem(KEYS.TEACHERS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getMeetings = (): Meeting[] => {
  try {
    const data = localStorage.getItem(KEYS.MEETINGS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getAttendance = (): Attendance[] => {
  try {
    const data = localStorage.getItem(KEYS.ATTENDANCE);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getMeetingById = (id: number): Meeting | undefined => {
  return getMeetings().find(m => m.id === id);
};

// --- Teachers Actions ---

export const saveTeacher = (teacher: Omit<Teacher, 'id'>): Teacher => {
  const teachers = getTeachers();
  const newTeacher = { ...teacher, id: Date.now() };
  teachers.push(newTeacher);
  localStorage.setItem(KEYS.TEACHERS, JSON.stringify(teachers));
  return newTeacher;
};

export const updateTeacher = (teacher: Teacher): void => {
  const teachers = getTeachers().map(t => t.id === teacher.id ? teacher : t);
  localStorage.setItem(KEYS.TEACHERS, JSON.stringify(teachers));
};

export const deleteTeacher = (id: number): void => {
  const teachers = getTeachers().filter(t => t.id !== id);
  localStorage.setItem(KEYS.TEACHERS, JSON.stringify(teachers));
};

// --- Meetings Actions ---

export const saveMeeting = (meeting: Omit<Meeting, 'id'>): Meeting => {
  const meetings = getMeetings();
  const newMeeting = { ...meeting, id: Date.now() };
  meetings.push(newMeeting);
  localStorage.setItem(KEYS.MEETINGS, JSON.stringify(meetings));
  return newMeeting;
};

export const updateMeeting = (meeting: Meeting): void => {
  const meetings = getMeetings().map(m => m.id === meeting.id ? meeting : m);
  localStorage.setItem(KEYS.MEETINGS, JSON.stringify(meetings));
};

export const deleteMeeting = (id: number): void => {
  const meetings = getMeetings().filter(m => m.id !== id);
  localStorage.setItem(KEYS.MEETINGS, JSON.stringify(meetings));
  const attendance = getAttendance().filter(a => a.id_reunion !== id);
  localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(attendance));
};

// --- Attendance Actions ---

export const markAttendance = (id_reunion: number, id_docente: number): boolean => {
  const allAttendance = getAttendance();
  const existingRecord = allAttendance.find(a => a.id_reunion === id_reunion && a.id_docente === id_docente);
  
  if (existingRecord) {
    if (!existingRecord.asistio) {
        existingRecord.asistio = true;
        localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(allAttendance));
        return true;
    }
    return false;
  }

  const newRecord: Attendance = {
    id: Date.now(),
    id_reunion,
    id_docente,
    fecha_asistencia: new Date().toISOString(),
    asistio: true
  };
  
  allAttendance.push(newRecord);
  localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(allAttendance));
  return true;
};

export const toggleAttendance = (id_reunion: number, id_docente: number): boolean => {
  const allAttendance = getAttendance();
  const index = allAttendance.findIndex(a => a.id_reunion === id_reunion && a.id_docente === id_docente);
  
  if (index >= 0) {
    const record = allAttendance[index];
    if (record.asistio) {
        if (record.nota) {
            record.asistio = false;
        } else {
            allAttendance.splice(index, 1);
        }
        localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(allAttendance));
        return false;
    } else {
        record.asistio = true;
        localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(allAttendance));
        return true;
    }
  } else {
    const newRecord: Attendance = {
      id: Date.now(),
      id_reunion,
      id_docente,
      fecha_asistencia: new Date().toISOString(),
      asistio: true
    };
    allAttendance.push(newRecord);
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(allAttendance));
    return true; 
  }
};

export const saveAttendanceNote = (id_reunion: number, id_docente: number, nota: string): void => {
    const allAttendance = getAttendance();
    const record = allAttendance.find(a => a.id_reunion === id_reunion && a.id_docente === id_docente);

    if (record) {
        record.nota = nota;
        if (!nota && !record.asistio) {
            const index = allAttendance.indexOf(record);
            allAttendance.splice(index, 1);
        }
    } else {
        if (nota) {
            allAttendance.push({
                id: Date.now(),
                id_reunion,
                id_docente,
                fecha_asistencia: new Date().toISOString(),
                asistio: false,
                nota: nota
            });
        }
    }
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(allAttendance));
};

export const getMeetingAttendanceReport = (id_reunion: number): AttendanceReportItem[] => {
  const teachers = getTeachers();
  const attendance = getAttendance().filter(a => a.id_reunion === id_reunion);
  
  return teachers.map(t => {
    const record = attendance.find(a => a.id_docente === t.id);
    return {
      docente: t,
      asistio: record ? record.asistio : false,
      hora_llegada: (record && record.asistio) ? record.fecha_asistencia : undefined,
      nota: record ? record.nota : undefined
    };
  });
};

export const getMeetingTrends = (limit: number = 5): TrendData[] => {
  const meetings = getMeetings();
  const allAttendance = getAttendance();
  const teacherCount = getTeachers().length;

  if (teacherCount === 0) return [];

  const sortedMeetings = meetings.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const recentMeetings = sortedMeetings.slice(-limit);

  return recentMeetings.map(m => {
    const meetingAttendanceCount = allAttendance.filter(a => a.id_reunion === m.id && a.asistio).length;
    const percentage = Math.round((meetingAttendanceCount / teacherCount) * 100);
    return {
      meetingId: m.id,
      meetingName: m.nombre,
      date: m.fecha,
      percentage: percentage
    };
  });
};

export const getAttendanceByRole = (id_reunion: number): RoleStat[] => {
  const teachers = getTeachers();
  const attendance = getAttendance().filter(a => a.id_reunion === id_reunion);
  
  const stats: Record<string, { present: number, total: number }> = {};

  teachers.forEach(t => {
    const role = t.cargo || 'General';
    if (!stats[role]) stats[role] = { present: 0, total: 0 };
    
    stats[role].total++;
    if (attendance.some(a => a.id_docente === t.id && a.asistio)) {
      stats[role].present++;
    }
  });

  return Object.entries(stats).map(([role, data]) => ({
    role,
    present: data.present,
    total: data.total,
    percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
  })).sort((a, b) => b.percentage - a.percentage);
};

export const getRecentActivity = (limit: number = 5): RecentActivityItem[] => {
    const attendance = getAttendance().filter(a => a.asistio).sort((a, b) => b.id - a.id);
    const teachers = getTeachers();
    const meetings = getMeetings();
    
    return attendance.slice(0, limit).map(a => {
        const t = teachers.find(te => te.id === a.id_docente);
        const m = meetings.find(me => me.id === a.id_reunion);
        return {
            teacherName: t ? t.nombre : 'Desconocido',
            meetingName: m ? m.nombre : 'Reunión',
            timestamp: a.fecha_asistencia
        };
    });
};

export const exportDatabase = (): string => {
    const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        teachers: getTeachers(),
        meetings: getMeetings(),
        attendance: getAttendance(),
    };
    return JSON.stringify(data, null, 2);
};

export const importDatabase = (jsonString: string): boolean => {
    try {
        const data = JSON.parse(jsonString);
        if (!data.teachers || !data.meetings || !data.attendance) {
            throw new Error("Formato de archivo inválido");
        }
        
        localStorage.setItem(KEYS.TEACHERS, JSON.stringify(data.teachers));
        localStorage.setItem(KEYS.MEETINGS, JSON.stringify(data.meetings));
        localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(data.attendance));
        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
};
