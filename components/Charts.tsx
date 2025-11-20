
import React from 'react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer 
} from 'recharts';
import { TrendData, RoleStat } from '../types';

interface DonutChartProps {
  present: number;
  absent: number;
  total: number;
}

const COLORS = {
  present: '#4F46E5', // Indigo 600
  absent: '#FECACA',  // Red 200
  palette: ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#6366F1', '#14B8A6']
};

export const AttendanceDonut: React.FC<DonutChartProps> = ({ present, absent, total }) => {
  if (total === 0) return null;

  const data = [
    { name: 'Presentes', value: present },
    { name: 'Ausentes', value: absent },
  ];

  const percentage = Math.round((present / total) * 100);

  return (
    <div className="h-64 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={COLORS.present} />
            <Cell fill={COLORS.absent} />
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
         <span className="text-4xl font-bold text-gray-800">{percentage}%</span>
         <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Asistencia</span>
      </div>
    </div>
  );
};

interface TrendChartProps {
  data: TrendData[];
  currentMeetingId: number;
}

export const AttendanceTrend: React.FC<TrendChartProps> = ({ data, currentMeetingId }) => {
  const formattedData = data.map(item => ({
    ...item,
    dateShort: new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-lg text-sm z-50">
          <p className="font-bold text-gray-800 mb-1">{item.meetingName}</p>
          <p className="text-indigo-600 font-semibold">{item.percentage}% Asistencia</p>
          <p className="text-xs text-gray-400 mt-1">{new Date(item.date).toLocaleDateString()}</p>
          {item.meetingId === currentMeetingId && (
             <span className="mt-2 inline-block text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                Reunión Actual
             </span>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
          <XAxis 
            dataKey="dateShort" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 10 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 10 }} 
            domain={[0, 100]}
          />
          <Tooltip cursor={{ fill: '#F9FAFB' }} content={<CustomTooltip />} />
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]} animationDuration={1500}>
            {formattedData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.meetingId === currentMeetingId ? '#4F46E5' : (entry.percentage >= 80 ? '#10B981' : '#9CA3AF')} 
                fillOpacity={entry.meetingId === currentMeetingId ? 1 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface RoleChartProps {
  data: RoleStat[];
}

export const RoleCompositionChart: React.FC<RoleChartProps> = ({ data }) => {
  const activeRoles = data.filter(d => d.present > 0);

  if (activeRoles.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm bg-gray-50 rounded-full w-48 mx-auto border border-gray-100">
            Sin Asistencia
        </div>
    );
  }

  return (
    <div className="h-56 w-full">
       <ResponsiveContainer width="100%" height="100%">
         <PieChart>
           <Pie
             data={activeRoles}
             cx="50%"
             cy="50%"
             outerRadius={80}
             dataKey="present"
             nameKey="role"
             paddingAngle={2}
             stroke="none"
           >
             {activeRoles.map((entry, index) => (
               <Cell key={`cell-${index}`} fill={COLORS.palette[index % COLORS.palette.length]} />
             ))}
           </Pie>
           <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number, name: string) => [`${value} Presentes`, name]}
           />
         </PieChart>
       </ResponsiveContainer>
    </div>
  );
};

export const AttendanceByRole: React.FC<RoleChartProps> = ({ data }) => {
  // Keeps the HTML implementation as it handles long labels better than Charts
  return (
    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
      {data.map((stat, index) => (
        <div key={index} className="group">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-gray-700 truncate pr-2" title={stat.role}>
                {stat.role}
            </span>
            <span className="text-gray-500 whitespace-nowrap">
                {stat.present}/{stat.total}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden relative">
            <div 
              className="h-2 rounded-full transition-all duration-1000 absolute top-0 left-0"
              style={{ 
                  width: `${stat.percentage}%`,
                  backgroundColor: COLORS.palette[index % COLORS.palette.length]
              }}
            ></div>
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-4">
          No hay datos de cargos disponibles.
        </div>
      )}
    </div>
  );
};
