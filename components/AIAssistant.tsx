
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageCircleIcon, SendIcon, XIcon, SparklesIcon } from './Icons';
import { exportDatabase, getMeetingById, getMeetingAttendanceReport, getAttendanceByRole, getMeetingTrends } from '../services/storageService';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface Props {
  contextMeetingId?: number | null;
}

const AIAssistant: React.FC<Props> = ({ contextMeetingId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: '¡Hola! Soy el asistente de DocenteTrack. ¿En qué puedo ayudarte hoy con las reuniones o asistencia?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Safe access to API KEY to prevent runtime crashes
  const apiKey = (typeof process !== 'undefined' && process?.env) ? process.env.API_KEY : undefined;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !apiKey) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      // Get full app context
      const fullContext = exportDatabase();
      
      // Build dynamic context string
      let specificContextInstruction = "";
      
      if (contextMeetingId) {
        const meeting = getMeetingById(contextMeetingId);
        if (meeting) {
            const report = getMeetingAttendanceReport(meeting.id);
            const roleStats = getAttendanceByRole(meeting.id);
            const trends = getMeetingTrends();

            const present = report.filter(r => r.asistio).length;
            const total = report.length;
            const percentage = total > 0 ? Math.round((present/total)*100) : 0;
            
            // Trend Analysis
            const avgAttendance = trends.length > 0 
                 ? Math.round(trends.reduce((sum, t) => sum + t.percentage, 0) / trends.length)
                 : percentage;
            
            const trendText = percentage >= avgAttendance ? "Positiva (Sobre el promedio)" : "Negativa (Bajo el promedio)";

            const absentList = report
                .filter(r => !r.asistio)
                .map(r => `- ${r.docente.nombre} (${r.docente.cargo}): ${r.nota || 'Sin excusa'}`)
                .join('\n');
            
            const roleSummary = roleStats.map(r => `${r.role}: ${r.present}/${r.total} (${r.percentage}%)`).join('\n');

            specificContextInstruction = `
            ============================================================
            CONTEXTO DE VISUALIZACIÓN ACTUAL (PRIORIDAD ALTA):
            El usuario está mirando ahora mismo los detalles de la reunión: "${meeting.nombre}".
            
            DATOS DE LA REUNIÓN ACTUAL:
            - Fecha y Hora: ${meeting.fecha} a las ${meeting.hora}
            - Tema/Descripción: ${meeting.descripcion || 'No especificada'}
            - Resumen de Asistencia: ${present} asistentes de ${total} convocados (${percentage}%).
            - Tendencia: ${trendText} vs Promedio histórico (${avgAttendance}%).
            
            DESGLOSE POR CARGO:
            ${roleSummary}
            
            LISTA DE AUSENTES:
            ${absentList || 'Ninguno (Asistencia perfecta)'}
            
            INSTRUCCIÓN DE CONTEXTO: Si el usuario pregunta "¿quién faltó?", "¿cómo estuvo la asistencia?" o "¿qué pasó en la reunión?" sin especificar nombre, REFIÉRETE A ESTA REUNIÓN ACTUAL.
            ============================================================
            `;
        }
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstruction = `
        Eres el asistente inteligente "DocenteTrack". Tu trabajo es ayudar a directivos a gestionar la asistencia escolar.
        
        ${specificContextInstruction}

        INSTRUCCIONES GENERALES:
        1. Tienes acceso a la base de datos completa del sistema en JSON al final de este prompt.
        2. Si hay un "CONTEXTO DE VISUALIZACIÓN ACTUAL", úsalo como fuente primaria para preguntas sobre "esta reunión".
        3. Si la pregunta es general (ej. "¿Quién falta más en todo el año?"), usa la base de datos JSON para calcular la respuesta.
        4. Sé conciso, profesional y directo. Usa formato Markdown (listas, negritas) para que sea legible.
        
        BASE DE DATOS COMPLETA (JSON):
        ${fullContext}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMsg,
        config: {
            systemInstruction: systemInstruction,
        }
      });

      const text = response.text || "Lo siento, no pude procesar la respuesta.";
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Tuve un problema conectando con el servidor. Por favor verifica tu API Key." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!apiKey) return null; // Don't show if no API key

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-xl transition-all duration-300 z-50 ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100 bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
        title="Asistente IA"
      >
        <MessageCircleIcon className="w-7 h-7" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 z-50 ${
          isOpen 
            ? 'opacity-100 translate-y-0 h-[500px]' 
            : 'opacity-0 translate-y-10 pointer-events-none h-0'
        }`}
      >
        {/* Header */}
        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5" />
            <div>
                <h3 className="font-bold leading-none">Asistente Virtual</h3>
                {contextMeetingId && <span className="text-[10px] opacity-80 font-normal">Viendo reunión actual</span>}
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-500 p-1 rounded">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 p-3 rounded-2xl rounded-bl-none flex gap-1 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms'}}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={contextMeetingId ? "Pregunta sobre esta reunión..." : "Pregunta algo..."}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </>
  );
};

export default AIAssistant;
