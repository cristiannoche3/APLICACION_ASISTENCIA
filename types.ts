
export interface Teacher {
  id: number;
  nombre: string;
  correo?: string; // Optional now
  cargo: string;
  telefono?: string;
}

export interface Meeting {
  id: number;
  nombre: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm
  descripcion?: string;
  googleFormUrl?: string; // New: Link to external Google Form
}

export interface Attendance {
  id: number;
  id_docente: number;
  id_reunion: number;
  fecha_asistencia: string; // ISO Date string with time
  asistio: boolean;
  nota?: string; // Excusa o detalle
}

export interface AttendanceReportItem {
  docente: Teacher;
  asistio: boolean;
  hora_llegada?: string;
  nota?: string;
}

export interface TrendData {
  meetingId: number;
  meetingName: string;
  date: string;
  percentage: number;
}

export interface RoleStat {
  role: string;
  present: number;
  total: number;
  percentage: number;
}

export interface RecentActivityItem {
  teacherName: string;
  meetingName: string;
  timestamp: string;
}

export enum AppRoute {
  DASHBOARD = 'dashboard',
  TEACHERS = 'teachers',
  MEETINGS = 'meetings',
  ATTENDANCE = 'attendance',
  MASTER_ATTENDANCE = 'master-attendance',
  SETTINGS = 'settings',
}