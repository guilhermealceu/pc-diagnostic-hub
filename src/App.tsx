import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  History as HistoryIcon, 
  Play, 
  Square, 
  Download, 
  Trash2, 
  Cpu, 
  Database, 
  Thermometer,
  ChevronRight,
  Clock,
  RefreshCw,
  Shield,
  Monitor,
  HardDrive,
  BatteryCharging,
  Flame,
  Zap,
  Bot,
  Settings
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { CrystalDiskView } from './components/CrystalDiskView';
import { BatteryView } from './components/BatteryView';
import { ProcessManagerView } from './components/ProcessManagerView';
import { OllamaAnalysisModal } from './components/OllamaAnalysisModal';
import { SettingsView, AppSettings, DEFAULT_SETTINGS } from './components/SettingsView';

// --- Types ---

interface DataPoint {
  id: number;
  session_id: number;
  timestamp: string;
  cpu_load: number;
  cpu_temp: number;
  gpu_load: number;
  gpu_temp: number;
  mem_used: number;
  mem_total: number;
  vram_used: number;
  vram_total: number;
}

interface Session {
  id: number;
  name: string;
  start_time: string;
  end_time: string | null;
  is_active: number;
  dataPoints?: DataPoint[];
}

interface RealTimeStats {
  cpuLoad: number;
  cpuTemp: number;
  gpuLoad: number;
  gpuTemp: number;
  memUsed: number;
  memTotal: number;
  vramUsed: number;
  vramTotal: number;
  gpuModel: string;
  timestamp: string;
}

// --- Components ---

const StatCard = ({ icon: Icon, label, value, unit, color }: any) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 shrink-0`}>
      <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider truncate">{label}</p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-2xl font-bold text-zinc-900">{value}</span>
        {unit && <span className="text-xs font-medium text-zinc-400">{unit}</span>}
      </div>
    </div>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'diagnostic' | 'processes' | 'disks' | 'battery' | 'history' | 'updates' | 'settings'>('diagnostic');
  const [stats, setStats] = useState<RealTimeStats | null>(null);
  const [statsHistory, setStatsHistory] = useState<any[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [ollamaOpen, setOllamaOpen] = useState(false);

  // App Centralized Settings State
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('pc_diagnostic_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const handleUpdateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newPartial };
      try {
        localStorage.setItem('pc_diagnostic_settings', JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save settings to localStorage", err);
      }
      return updated;
    });
  };

  const handleResetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem('pc_diagnostic_settings');
    } catch (err) {
      console.error("Failed to reset settings in localStorage", err);
    }
  };

  // Fetch real-time stats (optimized: only poll when active tab is diagnostic & tab is visible)
  useEffect(() => {
    let isMounted = true;

    const fetchCurrent = async () => {
      // Don't poll if browser tab is hidden or user is on another view
      if (document.hidden || activeTab !== 'diagnostic') return;
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        setStats(data);
        setStatsHistory(prev => {
          const newPoint = { ...data, time: new Date(data.timestamp).toLocaleTimeString() };
          const newHistory = [...prev, newPoint];
          return newHistory.slice(-settings.graphHistoryLimit);
        });
      } catch (err) {
        // Silent catch for background polling
      }
    };

    fetchCurrent();
    const interval = setInterval(fetchCurrent, settings.telemetryInterval || 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTab, settings.telemetryInterval, settings.graphHistoryLimit]);

  // Fetch sessions
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data);
      const active = data.find((s: Session) => s.is_active === 1);
      setActiveSession(active || null);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const startDiagnostic = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Diagnóstico ${new Date().toLocaleString()}` })
      });
      const data = await res.json();
      if (data.id) {
        fetchSessions();
      }
    } catch (err) {
      console.error("Error starting diagnostic:", err);
    } finally {
      setLoading(false);
    }
  };

  const stopDiagnostic = async () => {
    setLoading(true);
    try {
      await fetch('/api/sessions/stop', { method: 'POST' });
      fetchSessions();
    } catch (err) {
      console.error("Error stopping diagnostic:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta sessão?")) return;
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      fetchSessions();
      if (selectedSession?.id === id) setSelectedSession(null);
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  };

  const viewSession = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error("Failed to fetch session");
      const data = await res.json();
      setSelectedSession(data);
      setActiveTab('history');
    } catch (err) {
      console.error("Error viewing session:", err);
      alert("Erro ao carregar os dados da sessão.");
    } finally {
      setLoading(false);
    }
  };

  const checkUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const res = await fetch('/api/updates');
      const data = await res.json();
      setUpdateInfo(data);
    } catch (err) {
      console.error("Error checking updates:", err);
    } finally {
      setCheckingUpdates(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'updates' && !updateInfo) {
      checkUpdates();
    }
  }, [activeTab]);

  const exportSession = (session: Session) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `diagnostic_${session.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className={`min-h-screen bg-zinc-50 text-zinc-900 font-sans ${settings.flatMode ? 'flat-mode' : ''}`}>
      {/* Sidebar / Nav */}
      <nav className="fixed left-0 top-0 h-full w-20 bg-white border-r border-black/5 flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <Activity className="w-6 h-6" />
        </div>
        
        <div className="flex flex-col gap-4 mt-8">
          <button 
            onClick={() => setActiveTab('diagnostic')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'diagnostic' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
            title="Diagnóstico de Hardware"
          >
            <Activity className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('processes')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'processes' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
            title="Top Consumidores & Gerenciador de Processos"
          >
            <Flame className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('disks')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'disks' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
            title="Saúde dos Discos (Rune Projects)"
          >
            <HardDrive className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('battery')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'battery' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
            title="Saúde da Bateria & Energia"
          >
            <BatteryCharging className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
            title="Histórico de Sessões"
          >
            <HistoryIcon className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setActiveTab('updates')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'updates' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
            title="Atualizações do Sistema"
          >
            <RefreshCw className={`w-6 h-6 ${checkingUpdates ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
            title="Painel de Configurações"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </nav>


      {/* Main Content */}
      <main className="pl-20 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-6">
          
          <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">PC Diagnostic Hub</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Monitoramento de hardware e análise de desempenho em tempo real.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Ollama Local AI Analysis Button for Active Tab */}
              <button
                onClick={() => setOllamaOpen(true)}
                className="flex items-center gap-2 bg-white text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 border border-indigo-200 transition-all shadow-sm"
                title="Analisar dados da aba atual com IA Local Ollama"
              >
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>Análise IA (Ollama)</span>
              </button>

              {activeSession ? (
                <button 
                  onClick={stopDiagnostic}
                  disabled={loading}
                  className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-red-100 transition-colors border border-red-200"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  Parar Diagnóstico
                </button>
              ) : (
                <button 
                  onClick={startDiagnostic}
                  disabled={loading}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Iniciar Diagnóstico
                </button>
              )}
            </div>
          </header>

          <AnimatePresence mode="wait">
            {activeTab === 'diagnostic' && (
              <motion.div 
                key="diagnostic"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Real-time Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    icon={Cpu} 
                    label="Carga da CPU" 
                    value={typeof stats?.cpuLoad === 'number' && !isNaN(stats.cpuLoad) ? stats.cpuLoad.toFixed(1) : '0'} 
                    unit="%" 
                    color="bg-blue-500" 
                  />
                  <StatCard 
                    icon={Thermometer} 
                    label="Temp. CPU" 
                    value={typeof stats?.cpuTemp === 'number' && stats.cpuTemp > 0 ? stats.cpuTemp.toFixed(1) : '--'} 
                    unit={typeof stats?.cpuTemp === 'number' && stats.cpuTemp > 0 ? "°C" : "°C (Requer Admin)"} 
                    color="bg-orange-500" 
                  />
                  <StatCard 
                    icon={Activity} 
                    label="Carga da GPU" 
                    value={typeof stats?.gpuLoad === 'number' && !isNaN(stats.gpuLoad) ? stats.gpuLoad.toFixed(1) : '0'} 
                    unit="%" 
                    color="bg-indigo-500" 
                  />
                  <StatCard 
                    icon={Thermometer} 
                    label="Temp. GPU" 
                    value={typeof stats?.gpuTemp === 'number' && stats.gpuTemp > 0 ? stats.gpuTemp.toFixed(1) : '--'} 
                    unit={typeof stats?.gpuTemp === 'number' && stats.gpuTemp > 0 ? "°C" : "°C (Sem sensor iGPU/NVIDIA)"} 
                    color="bg-red-500" 
                  />
                  <StatCard 
                    icon={Database} 
                    label="Memória RAM" 
                    value={(((stats?.memUsed || 0)) / 1024 / 1024 / 1024).toFixed(1)} 
                    unit={`/ ${(((stats?.memTotal || 0)) / 1024 / 1024 / 1024).toFixed(0)} GB`} 
                    color="bg-emerald-500" 
                  />
                  <StatCard 
                    icon={Database} 
                    label="Memória VRAM" 
                    value={(((stats?.vramUsed || 0)) / 1024 / 1024 / 1024).toFixed(1)} 
                    unit={`/ ${(((stats?.vramTotal || 0)) / 1024 / 1024 / 1024).toFixed(1)} GB`} 
                    color="bg-purple-500" 
                  />
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex items-center gap-4 lg:col-span-2">
                    <div className="p-3 rounded-xl bg-zinc-100">
                      <Cpu className="w-6 h-6 text-zinc-600" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">GPU Detectada</p>
                      <p className="text-lg font-bold text-zinc-900 truncate">{stats?.gpuModel || 'Detectando...'}</p>
                    </div>
                  </div>
                </div>

                {/* Real-time Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-indigo-600" />
                      Uso de Processadores (CPU & GPU)
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={statsHistory}>
                          <defs>
                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorGpu" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="time" hide />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Area type="monotone" dataKey="cpuLoad" name="CPU Load" stroke="#4f46e5" fillOpacity={1} fill="url(#colorCpu)" strokeWidth={2} />
                          <Area type="monotone" dataKey="gpuLoad" name="GPU Load" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorGpu)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Thermometer className="w-5 h-5 text-orange-600" />
                      Temperaturas em Tempo Real (°C)
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={statsHistory}>
                          <defs>
                            <linearGradient id="colorCpuTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorGpuTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="time" hide />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="cpuTemp" name="CPU Temp" stroke="#f97316" fillOpacity={1} fill="url(#colorCpuTemp)" strokeWidth={2} />
                          <Area type="monotone" dataKey="gpuTemp" name="GPU Temp" stroke="#ef4444" fillOpacity={1} fill="url(#colorGpuTemp)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Active Session Info */}
                {activeSession && (
                  <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl shadow-indigo-200 flex justify-between items-center">
                    <div>
                      <p className="text-indigo-100 text-sm font-medium uppercase tracking-widest mb-1">Sessão em Andamento</p>
                      <h2 className="text-2xl font-bold">{activeSession.name}</h2>
                      <div className="flex gap-6 mt-4">
                        <div className="flex items-center gap-2 text-indigo-100">
                          <Clock className="w-4 h-4" />
                          <span>Iniciada em: {new Date(activeSession.start_time).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="animate-pulse flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                      <span className="text-sm font-bold">Gravando dados...</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Top Consumers & Process Manager Tab */}
            {activeTab === 'processes' && (
              <motion.div
                key="processes"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ProcessManagerView />
              </motion.div>
            )}

            {/* Rune Projects & SMART Tab */}
            {activeTab === 'disks' && (
              <motion.div
                key="disks"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <CrystalDiskView />
              </motion.div>
            )}

            {/* Battery & Power Tab */}
            {activeTab === 'battery' && (
              <motion.div
                key="battery"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <BatteryView />
              </motion.div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Session List */}
                <div className="lg:col-span-1 space-y-4">
                  <h2 className="text-xl font-bold mb-4">Histórico de Sessões</h2>
                  {sessions.length === 0 ? (
                    <div className="bg-white p-8 rounded-3xl border border-dashed border-zinc-300 text-center text-zinc-400">
                      Nenhuma sessão encontrada.
                    </div>
                  ) : (
                    sessions.map(session => (
                      <button
                        key={session.id}
                        onClick={() => viewSession(session.id)}
                        className={`w-full text-left p-5 rounded-2xl border transition-all flex items-center justify-between group ${selectedSession?.id === session.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-black/5 hover:border-indigo-200'}`}
                      >
                        <div>
                          <p className={`font-bold ${selectedSession?.id === session.id ? 'text-white' : 'text-zinc-900'}`}>{session.name}</p>
                          <p className={`text-xs mt-1 ${selectedSession?.id === session.id ? 'text-indigo-100' : 'text-zinc-400'}`}>
                            {new Date(session.start_time).toLocaleString()}
                          </p>
                        </div>
                        <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${selectedSession?.id === session.id ? 'text-white' : 'text-zinc-300'}`} />
                      </button>
                    ))
                  )}
                </div>

                {/* Session Detail */}
                <div className="lg:col-span-2">
                  {selectedSession ? (
                    <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-8">
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-2xl font-bold">{selectedSession.name}</h2>
                          <div className="flex gap-4 mt-2 text-sm text-zinc-400">
                            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(selectedSession.start_time).toLocaleString()}</span>
                            {selectedSession.end_time && (
                              <span className="flex items-center gap-1">Até {new Date(selectedSession.end_time).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => exportSession(selectedSession)}
                            className="p-3 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                            title="Exportar JSON"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => deleteSession(selectedSession.id)}
                            className="p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {selectedSession.dataPoints && selectedSession.dataPoints.length > 0 ? (
                        <div className="space-y-8">
                          <div className="h-80">
                            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Histórico de Carga da CPU (%)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedSession.dataPoints.map(dp => ({ ...dp, time: new Date(dp.timestamp).toLocaleTimeString() }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Line type="monotone" dataKey="cpu_load" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="h-80">
                            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Histórico de Carga da GPU (%)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedSession.dataPoints.map(dp => ({ ...dp, time: new Date(dp.timestamp).toLocaleTimeString() }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" />
                                <YAxis domain={[0, 100]} />
                                <Tooltip />
                                <Line type="monotone" dataKey="gpu_load" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="h-80">
                            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Histórico de Memória RAM & VRAM (GB)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedSession.dataPoints.map(dp => ({ 
                                ...dp, 
                                time: new Date(dp.timestamp).toLocaleTimeString(), 
                                mem_gb: dp.mem_used / 1024 / 1024 / 1024,
                                vram_gb: dp.vram_used / 1024 / 1024 / 1024
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip formatter={(value: any) => typeof value === 'number' && !isNaN(value) ? value.toFixed(2) + ' GB' : '-- GB'} />
                                <Line type="monotone" dataKey="mem_gb" name="RAM" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="vram_gb" name="VRAM" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, fill: '#a855f7' }} activeDot={{ r: 6 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-zinc-100">
                            <div className="text-center">
                              <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest">Pontos de Dados</p>
                              <p className="text-2xl font-bold mt-1">{selectedSession.dataPoints.length}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest">CPU Média</p>
                              <p className="text-2xl font-bold mt-1">
                                {selectedSession.dataPoints.length > 0 
                                  ? (selectedSession.dataPoints.reduce((acc, curr) => acc + (curr?.cpu_load || 0), 0) / selectedSession.dataPoints.length).toFixed(1)
                                  : '0.0'}%
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest">GPU Média</p>
                              <p className="text-2xl font-bold mt-1">
                                {selectedSession.dataPoints.length > 0 
                                  ? (selectedSession.dataPoints.reduce((acc, curr) => acc + (curr?.gpu_load || 0), 0) / selectedSession.dataPoints.length).toFixed(1)
                                  : '0.0'}%
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest">RAM Média</p>
                              <p className="text-2xl font-bold mt-1">
                                {selectedSession.dataPoints.length > 0 
                                  ? (selectedSession.dataPoints.reduce((acc, curr) => acc + ((curr?.mem_used || 0) / 1024 / 1024 / 1024), 0) / selectedSession.dataPoints.length).toFixed(1)
                                  : '0.0'} GB
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-50 p-12 rounded-3xl text-center text-zinc-400">
                          Nenhum dado coletado nesta sessão ainda.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 bg-white rounded-3xl border border-black/5 border-dashed p-12">
                      <HistoryIcon className="w-12 h-12 mb-4 opacity-20" />
                      <p>Selecione uma sessão para visualizar os detalhes.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {/* Updates Tab */}
            {activeTab === 'updates' && (
              <motion.div 
                key="updates"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-indigo-600" />
                    Atualizações e Sistema
                  </h2>
                  <button 
                    onClick={checkUpdates}
                    disabled={checkingUpdates}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${checkingUpdates ? 'animate-spin' : ''}`} />
                    {checkingUpdates ? 'Verificando...' : 'Verificar Agora'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Windows Update */}
                  <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-blue-50 rounded-2xl">
                        <Shield className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Windows Update</h3>
                        <p className="text-sm text-zinc-500">Estado do sistema operacional</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between py-3 border-b border-zinc-50">
                        <span className="text-zinc-500">Versão</span>
                        <span className="font-medium">{updateInfo?.os?.distro} {updateInfo?.os?.release}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-zinc-50">
                        <span className="text-zinc-500">Build</span>
                        <span className="font-medium">{updateInfo?.os?.build}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-zinc-50">
                        <span className="text-zinc-500">Arquitetura</span>
                        <span className="font-medium">{updateInfo?.os?.arch}</span>
                      </div>
                      <div className="mt-6 p-4 rounded-2xl bg-zinc-50 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">Atualizações Pendentes</p>
                          <p className="text-xs text-zinc-500">
                            {updateInfo?.updateError || (updateInfo?.pendingUpdates === 0 ? 'Seu sistema está atualizado.' : `${updateInfo?.pendingUpdates} atualizações encontradas.`)}
                          </p>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${updateInfo?.pendingUpdates > 0 ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                      </div>
                    </div>
                  </div>

                  {/* GPU Drivers */}
                  <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-purple-50 rounded-2xl">
                        <Monitor className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">Drivers de Vídeo</h3>
                        <p className="text-sm text-zinc-500">Status da placa gráfica</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {updateInfo?.gpu?.map((g: any, i: number) => (
                        <div key={i} className="space-y-4">
                          <div className="flex justify-between py-3 border-b border-zinc-50">
                            <span className="text-zinc-500">Modelo</span>
                            <span className="font-medium">{g.model}</span>
                          </div>
                          <div className="flex justify-between py-3 border-b border-zinc-50">
                            <span className="text-zinc-500">Versão do Driver</span>
                            <span className="font-medium">{g.driverVersion}</span>
                          </div>
                          <div className="flex justify-between py-3 border-b border-zinc-50">
                            <span className="text-zinc-500">Fabricante</span>
                            <span className="font-medium">{g.vendor}</span>
                          </div>
                        </div>
                      ))}
                      <div className="mt-6 p-4 rounded-2xl bg-indigo-50 text-indigo-700 text-sm">
                        <p className="font-bold mb-1">Dica de Desempenho</p>
                        Mantenha seus drivers atualizados para garantir a melhor performance em jogos e aplicações 3D.
                      </div>
                    </div>
                  </div>

                  {/* BIOS Info */}
                  <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm md:col-span-2">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-zinc-100 rounded-2xl">
                        <Cpu className="w-6 h-6 text-zinc-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">BIOS / Firmware</h3>
                        <p className="text-sm text-zinc-500">Informações da placa-mãe</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest mb-1">Fabricante</p>
                        <p className="text-lg font-bold">{updateInfo?.bios?.vendor}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest mb-1">Versão</p>
                        <p className="text-lg font-bold">{updateInfo?.bios?.version}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest mb-1">Data de Lançamento</p>
                        <p className="text-lg font-bold">{updateInfo?.bios?.releaseDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <SettingsView
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onResetSettings={handleResetSettings}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Global Ollama Local AI Analysis Modal */}
      <OllamaAnalysisModal
        isOpen={ollamaOpen}
        onClose={() => setOllamaOpen(false)}
        page={activeTab === 'history' ? 'history' : 'diagnostic'}
        pageTitle={
          activeTab === 'history' ? 'Histórico de Sessões' :
          activeTab === 'updates' ? 'Atualizações e Firmware' :
          activeTab === 'settings' ? 'Painel de Configurações' :
          'Diagnóstico do Sistema & Telemetria'
        }
        contextData={{
          activeTab,
          stats,
          statsHistory: statsHistory.slice(-15),
          activeSession,
          totalSessions: sessions.length,
          updateInfo,
          settings
        }}
        initialEndpoint={settings.ollamaHost}
        initialModel={settings.ollamaModel}
        initialSearchProvider={settings.searchProvider}
        initialSearxngUrl={settings.searxngUrl}
        initialOllamaApiKey={settings.ollamaApiKey}
      />
    </div>
  );
}

