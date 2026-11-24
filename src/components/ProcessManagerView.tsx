import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XOctagon, 
  Cpu, 
  HardDrive, 
  Layers, 
  Flame, 
  ShieldCheck, 
  ShieldAlert, 
  Filter, 
  ArrowUpDown, 
  SlidersHorizontal,
  X,
  Play,
  Pause,
  Clock,
  Sparkles,
  Bot,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OllamaAnalysisModal } from './OllamaAnalysisModal';

export interface ProcessItem {
  pid: number;
  parentPid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss: number;
  memMb: number;
  user: string;
  state: string;
  command: string;
  category: 'Navegador' | 'Desenvolvimento' | 'Jogos' | 'Comunicação' | 'Multimídia' | 'Sistema' | 'Aplicativo';
  isCritical: boolean;
  statusAlert?: 'high_cpu' | 'high_ram' | 'normal';
}

export interface ProcessStatsResponse {
  total: number;
  running: number;
  blocked: number;
  sleeping: number;
  topCpu: ProcessItem[];
  topMem: ProcessItem[];
  all: ProcessItem[];
  timestamp: string;
  totalMemMb: number;
  usedMemMb: number;
  memPercent: number;
}

export const ProcessManagerView: React.FC = () => {
  const [data, setData] = useState<ProcessStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'name' | 'pid'>('cpu');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(3);
  
  // Kill Process Modal
  const [processToKill, setProcessToKill] = useState<ProcessItem | null>(null);
  const [isKilling, setIsKilling] = useState<boolean>(false);
  const [killMessage, setKillMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Ollama Modal State
  const [ollamaOpen, setOllamaOpen] = useState<boolean>(false);
  const [ollamaMode, setOllamaMode] = useState<'processes' | 'process_explain'>('processes');
  const [selectedProcessForExplain, setSelectedProcessForExplain] = useState<ProcessItem | null>(null);

  const fetchProcesses = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetch(`/api/processes?refresh=${isManual ? 'true' : 'false'}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Error fetching process list:", err);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses(true);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchProcesses(false);
      }
    }, refreshIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalSec]);

  const handleKill = async () => {
    if (!processToKill) return;
    setIsKilling(true);
    setKillMessage(null);
    try {
      const res = await fetch('/api/processes/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: processToKill.pid })
      });
      const result = await res.json();
      if (result.success) {
        setKillMessage({ text: result.message, type: 'success' });
        setTimeout(() => {
          setProcessToKill(null);
          setKillMessage(null);
          fetchProcesses(true);
        }, 1200);
      } else {
        setKillMessage({ text: result.message || 'Falha ao encerrar processo.', type: 'error' });
      }
    } catch (err: any) {
      setKillMessage({ text: 'Erro de conexão ao tentar encerrar processo.', type: 'error' });
    } finally {
      setIsKilling(false);
    }
  };

  // Filter & Sort processes
  const filteredProcesses = (data?.all || []).filter(proc => {
    const matchesSearch = proc.name.toLowerCase().includes(search.toLowerCase()) || 
                          proc.pid.toString().includes(search) ||
                          proc.user.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'all' || proc.category === selectedCategory;
    return matchesSearch && matchesCat;
  }).sort((a, b) => {
    let comp = 0;
    if (sortBy === 'cpu') comp = b.cpu - a.cpu;
    else if (sortBy === 'mem') comp = b.memMb - a.memMb;
    else if (sortBy === 'name') comp = a.name.localeCompare(b.name);
    else if (sortBy === 'pid') comp = a.pid - b.pid;

    return sortOrder === 'desc' ? comp : -comp;
  });

  // Calculate bottlenecks
  const highCpuHogs = (data?.all || []).filter(p => p.cpu > 25);
  const highRamHogs = (data?.all || []).filter(p => p.memMb > 1500);

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'Navegador', label: 'Navegadores' },
    { id: 'Desenvolvimento', label: 'Desenvolvimento' },
    { id: 'Jogos', label: 'Jogos' },
    { id: 'Comunicação', label: 'Comunicação' },
    { id: 'Multimídia', label: 'Multimídia' },
    { id: 'Sistema', label: 'Sistema' },
    { id: 'Aplicativo', label: 'Apps Gerais' }
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
              Gerenciador de Processos & Top Consumidores
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-800">
                {data ? `${data.total} processos` : 'Carregando...'}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Monitoramento em tempo real de consumo de CPU, Memória RAM e I/O por executável
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Ollama Local AI Analysis Button */}
          <button
            onClick={() => {
              setSelectedProcessForExplain(null);
              setOllamaMode('processes');
              setOllamaOpen(true);
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
            title="Analisar consumo de processos com IA Local Ollama"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Análise IA (Ollama)</span>
          </button>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              autoRefresh 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            title={autoRefresh ? 'Pausar auto-atualização' : 'Ativar auto-atualização'}
          >
            {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoRefresh ? `Ao Vivo (${refreshIntervalSec}s)` : 'Pausado'}
          </button>

          <button
            onClick={() => fetchProcesses(true)}
            disabled={loading}
            className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Agora
          </button>
        </div>
      </div>

      {/* Bottlenecks / High Resource Consumer Alert Banner */}
      {(highCpuHogs.length > 0 || highRamHogs.length > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/90 border border-amber-200/90 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-amber-950 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-2xl shrink-0 mt-0.5">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900 flex items-center gap-2">
                Alto Consumo Detectado em Segundo Plano
              </p>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {highCpuHogs.length > 0 && (
                  <span>
                    <strong>{highCpuHogs.length} processo(s)</strong> usando &gt;25% de CPU ({highCpuHogs.map(p => `${p.name}: ${p.cpu}%`).slice(0, 3).join(', ')}).{' '}
                  </span>
                )}
                {highRamHogs.length > 0 && (
                  <span>
                    <strong>{highRamHogs.length} processo(s)</strong> ocupando mais de 1.5 GB de RAM.
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold bg-amber-200/70 text-amber-900 px-3 py-1 rounded-xl">
              Gargalo Ativo
            </span>
          </div>
        </motion.div>
      )}

      {/* Top 3 CPU & Top 3 RAM Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top CPU Card */}
        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Cpu className="w-4 h-4" />
              </div>
              Top Consumidores de Processador (CPU)
            </div>
            <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
              Maior Carga
            </span>
          </div>

          <div className="space-y-3">
            {data?.topCpu?.slice(0, 4).map((proc, index) => (
              <div key={`top-cpu-${proc.pid}-${index}`} className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-zinc-50 transition">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-zinc-800 truncate" title={proc.name}>
                      {proc.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      PID: {proc.pid} • {proc.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className={`font-mono font-bold ${(proc.cpu || 0) > 25 ? 'text-rose-600' : 'text-zinc-800'}`}>
                      {(proc.cpu ?? 0).toFixed(1)}%
                    </span>
                    <p className="text-[10px] text-zinc-400">{proc.memMb || 0} MB</p>
                  </div>
                  {!proc.isCritical && (
                    <button
                      onClick={() => setProcessToKill(proc)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Encerrar processo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top RAM Card */}
        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Layers className="w-4 h-4" />
              </div>
              Top Consumidores de Memória (RAM)
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              {data?.memPercent || 0}% Ocupado
            </span>
          </div>

          <div className="space-y-3">
            {data?.topMem?.slice(0, 4).map((proc, index) => (
              <div key={`top-mem-${proc.pid}-${index}`} className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-zinc-50 transition">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-zinc-800 truncate" title={proc.name}>
                      {proc.name}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      PID: {proc.pid} • {proc.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-mono font-bold text-indigo-600">
                      {(proc.memMb || 0) > 1024 ? `${((proc.memMb || 0) / 1024).toFixed(2)} GB` : `${proc.memMb || 0} MB`}
                    </span>
                    <p className="text-[10px] text-zinc-400">{proc.mem || 0}% RAM</p>
                  </div>
                  {!proc.isCritical && (
                    <button
                      onClick={() => setProcessToKill(proc)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Encerrar processo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Process Table Section */}
      <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm space-y-5">
        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por nome do processo, PID ou usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 hover:bg-zinc-100/80 focus:bg-white border border-black/5 rounded-2xl text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort & Counter Bar */}
        <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-100 pb-3">
          <p>
            Exibindo <strong>{filteredProcesses.length}</strong> de {data?.total || 0} processos ativos
          </p>

          <div className="flex items-center gap-3">
            <span className="text-zinc-400">Ordenar por:</span>
            <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-xl">
              <button
                onClick={() => { setSortBy('cpu'); setSortOrder(sortBy === 'cpu' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${sortBy === 'cpu' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'}`}
              >
                CPU {sortBy === 'cpu' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => { setSortBy('mem'); setSortOrder(sortBy === 'mem' && sortOrder === 'desc' ? 'asc' : 'desc'); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${sortBy === 'mem' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'}`}
              >
                RAM {sortBy === 'mem' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => { setSortBy('name'); setSortOrder(sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${sortBy === 'name' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'}`}
              >
                Nome {sortBy === 'name' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
              <button
                onClick={() => { setSortBy('pid'); setSortOrder(sortBy === 'pid' && sortOrder === 'asc' ? 'desc' : 'asc'); }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${sortBy === 'pid' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500'}`}
              >
                PID {sortBy === 'pid' && (sortOrder === 'desc' ? '↓' : '↑')}
              </button>
            </div>
          </div>
        </div>

        {/* Process Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                <th className="pb-3 pl-2">Processo / Executável</th>
                <th className="pb-3 text-center">PID</th>
                <th className="pb-3 text-center">Categoria</th>
                <th className="pb-3 text-right">Uso de CPU</th>
                <th className="pb-3 text-right">Memória (RAM)</th>
                <th className="pb-3 text-center">Estado</th>
                <th className="pb-3 text-right pr-2">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/80">
              {filteredProcesses.slice(0, 100).map((proc) => {
                const isHighCpu = proc.cpu > 25;
                const isHighRam = proc.memMb > 1500;

                return (
                  <tr 
                    key={`proc-${proc.pid}`}
                    className={`hover:bg-zinc-50/80 transition-colors ${
                      isHighCpu ? 'bg-rose-50/30' : isHighRam ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Name */}
                    <td className="py-3 pl-2 max-w-[220px]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            isHighCpu ? 'bg-rose-500 animate-ping' : isHighRam ? 'bg-amber-500' : 'bg-emerald-400'
                          }`} />
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-800 truncate" title={proc.command || proc.name}>
                              {proc.name}
                            </p>
                            <p className="text-[10px] text-zinc-400 truncate max-w-[180px]">
                              {proc.user}
                            </p>
                          </div>
                        </div>

                        {/* Explain with Ollama AI Button */}
                        <button
                          onClick={() => {
                            setSelectedProcessForExplain(proc);
                            setOllamaMode('process_explain');
                            setOllamaOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition shrink-0"
                          title="Para que serve este processo? (Explicar com IA Offline)"
                        >
                          <Bot className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* PID */}
                    <td className="py-3 text-center font-mono font-semibold text-zinc-600">
                      {proc.pid}
                    </td>

                    {/* Category */}
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        proc.category === 'Sistema' 
                          ? 'bg-zinc-100 text-zinc-700'
                          : proc.category === 'Navegador'
                          ? 'bg-blue-50 text-blue-700'
                          : proc.category === 'Desenvolvimento'
                          ? 'bg-emerald-50 text-emerald-700'
                          : proc.category === 'Jogos'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {proc.category}
                      </span>
                    </td>

                    {/* CPU */}
                    <td className="py-3 text-right font-mono">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-bold ${isHighCpu ? 'text-rose-600' : (proc.cpu || 0) > 5 ? 'text-amber-600' : 'text-zinc-700'}`}>
                          {(proc.cpu ?? 0).toFixed(1)}%
                        </span>
                        <div className="w-12 bg-zinc-100 h-1.5 rounded-full overflow-hidden shrink-0">
                          <div 
                            className={`h-full ${isHighCpu ? 'bg-rose-500' : (proc.cpu || 0) > 5 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(100, (proc.cpu || 0) * 2)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* RAM */}
                    <td className="py-3 text-right font-mono">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-bold ${isHighRam ? 'text-indigo-600' : 'text-zinc-700'}`}>
                          {(proc.memMb || 0) > 1024 ? `${((proc.memMb || 0) / 1024).toFixed(2)} GB` : `${proc.memMb || 0} MB`}
                        </span>
                        <div className="w-12 bg-zinc-100 h-1.5 rounded-full overflow-hidden shrink-0">
                          <div 
                            className={`h-full ${isHighRam ? 'bg-indigo-600' : 'bg-zinc-400'}`}
                            style={{ width: `${Math.min(100, ((proc.memMb || 0) / 4000) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* State */}
                    <td className="py-3 text-center">
                      <span className="text-[11px] text-zinc-500 capitalize">
                        {proc.state === 'running' ? 'Executando' : proc.state === 'sleeping' ? 'Em Espera' : proc.state}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 text-right pr-2">
                      {proc.isCritical ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-lg" title="Processo essencial protegido do Windows">
                          <ShieldCheck className="w-3 h-3 text-zinc-500" />
                          Sistema
                        </span>
                      ) : (
                        <button
                          onClick={() => setProcessToKill(proc)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 px-2.5 py-1 rounded-xl transition"
                        >
                          <XOctagon className="w-3 h-3" />
                          Encerrar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredProcesses.length === 0 && (
            <div className="p-12 text-center text-zinc-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Nenhum processo encontrado com os filtros atuais.</p>
            </div>
          )}
        </div>
      </div>

      {/* Kill Process Confirmation Modal */}
      <AnimatePresence>
        {processToKill && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-black/10 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-start border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600">
                    <XOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">Encerrar Processo</h3>
                    <p className="text-xs text-zinc-500">Confirmar encerramento forçado</p>
                  </div>
                </div>
                <button
                  onClick={() => { setProcessToKill(null); setKillMessage(null); }}
                  className="text-zinc-400 hover:text-zinc-600 p-1.5 rounded-xl hover:bg-zinc-100 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-zinc-600">
                <p>
                  Tem certeza que deseja finalizar a execução de <strong>{processToKill.name}</strong>?
                </p>

                <div className="bg-zinc-50 p-3.5 rounded-2xl border border-zinc-200/60 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">PID:</span>
                    <span className="font-bold text-zinc-800">{processToKill.pid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Uso Atual de CPU:</span>
                    <span className="font-bold text-rose-600">{processToKill.cpu}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Memória Liberada Estimada:</span>
                    <span className="font-bold text-indigo-600">{processToKill.memMb} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Categoria:</span>
                    <span className="font-bold text-zinc-700">{processToKill.category}</span>
                  </div>
                </div>

                {killMessage && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${
                    killMessage.type === 'success' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {killMessage.text}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setProcessToKill(null); setKillMessage(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleKill}
                  disabled={isKilling}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  {isKilling ? 'Encerrando...' : 'Finalizar Processo'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ollama Analysis Modal */}
      <OllamaAnalysisModal
        isOpen={ollamaOpen}
        onClose={() => setOllamaOpen(false)}
        page={ollamaMode}
        pageTitle="Top Consumidores & Gerenciador de Processos"
        contextData={data}
        processItem={selectedProcessForExplain}
      />
    </div>
  );
};
