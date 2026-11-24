import React, { useState, useEffect } from 'react';
import { 
  Battery, 
  BatteryCharging, 
  BatteryWarning, 
  BatteryMedium,
  Zap, 
  RefreshCw, 
  FileText, 
  ShieldCheck, 
  AlertTriangle, 
  TrendingDown, 
  Sliders, 
  Laptop, 
  Monitor, 
  CheckCircle2, 
  Info,
  Clock,
  Flame,
  Cpu,
  Power,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OllamaAnalysisModal } from './OllamaAnalysisModal';

interface BatteryData {
  hasBattery: boolean;
  isRealHardware: boolean;
  source: string;
  isCharging: boolean;
  percent: number;
  healthPercent: number;
  wearLevelPercent: number;
  designCapacity: number;
  maxCapacity: number;
  currentCapacity: number;
  capacityUnit: string;
  voltage: number;
  chargeRateWatts: number;
  cycleCount: number;
  timeRemainingMinutes: number;
  technology: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  powerSource: 'AC' | 'Battery';
  acConnected: boolean;
  powerPlan: string;
  temperatureC: number | null;
  statusText: 'Excelente' | 'Bom' | 'Desgastada' | 'Crítica' | 'Desconhecida';
  tips: string[];
}

export const BatteryView: React.FC = () => {
  const [data, setData] = useState<BatteryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeMode, setActiveMode] = useState<'system' | 'simulator'>('system');
  const [downloadingReport, setDownloadingReport] = useState<boolean>(false);
  const [ollamaOpen, setOllamaOpen] = useState<boolean>(false);

  // Simulator State
  const [simDesignWh, setSimDesignWh] = useState<number>(56);
  const [simCycles, setSimCycles] = useState<number>(140);
  const [simChargePercent, setSimChargePercent] = useState<number>(85);
  const [simIsCharging, setSimIsCharging] = useState<boolean>(true);
  const [simProfile, setSimProfile] = useState<'light' | 'normal' | 'gaming'>('normal');

  const fetchBatteryData = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await fetch('/api/battery');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error("Error fetching battery data:", e);
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatteryData(true);
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchBatteryData(false);
      }
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await fetch('/api/battery/report');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-bateria-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download report", err);
    } finally {
      setDownloadingReport(false);
    }
  };

  // Calculate simulated values
  const simWearPct = Math.min(45, Math.round((simCycles / 500) * 20));
  const simHealthPct = 100 - simWearPct;
  const simMaxWh = Number(((simDesignWh * simHealthPct) / 100).toFixed(1));
  const simCurrentWh = Number(((simMaxWh * simChargePercent) / 100).toFixed(1));
  
  const powerDrainW = simProfile === 'light' ? 8 : simProfile === 'normal' ? 15 : 45;
  const simTimeMinutes = simIsCharging 
    ? Math.round(((simMaxWh - simCurrentWh) / 30) * 60)
    : Math.round((simCurrentWh / powerDrainW) * 60);

  // Active view data
  const currentData = activeMode === 'simulator' ? {
    hasBattery: true,
    isRealHardware: false,
    source: 'Simulador Interativo de Notebook',
    isCharging: simIsCharging,
    percent: simChargePercent,
    healthPercent: simHealthPct,
    wearLevelPercent: simWearPct,
    designCapacity: simDesignWh * 1000,
    maxCapacity: simMaxWh * 1000,
    currentCapacity: simCurrentWh * 1000,
    capacityUnit: 'mWh',
    voltage: 11.4,
    chargeRateWatts: simIsCharging ? 28.5 : -1 * powerDrainW,
    cycleCount: simCycles,
    timeRemainingMinutes: simTimeMinutes,
    technology: 'Polímero de Lítio (Li-Po 3-Células)',
    manufacturer: 'Simulated OEM Power Unit',
    model: `Notebook Pro Battery ${simDesignWh}Wh`,
    serialNumber: `SIM-BAT-${simCycles}C`,
    powerSource: simIsCharging ? ('AC' as const) : ('Battery' as const),
    acConnected: simIsCharging,
    powerPlan: 'Equilibrado (Windows 11)',
    temperatureC: simIsCharging ? 34 : 29,
    statusText: (simHealthPct >= 90 ? 'Excelente' : simHealthPct >= 75 ? 'Bom' : 'Desgastada') as BatteryData['statusText'],
    tips: [
      simHealthPct >= 85 ? "Bateria simulada em excelente estado com retenção superior a 85%." : "Apresenta desgaste perceptível devido à contagem de ciclos.",
      "Para maior vida útil, configure o limite de carga em 80% quando usar na tomada direto.",
      `Autonomia simulada em uso ${simProfile === 'light' ? 'Leve' : simProfile === 'normal' ? 'Normal' : 'Pesado/Jogos'}: ~${Math.floor(simTimeMinutes / 60)}h ${simTimeMinutes % 60}min.`
    ]
  } : data;

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-black/5 shadow-sm">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-semibold text-zinc-600">Lendo sensores de energia e bateria do sistema...</p>
      </div>
    );
  }

  const isDesktopNoBattery = !currentData?.hasBattery;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
              <BatteryCharging className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
                Saúde da Bateria & Energia
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                  {currentData?.hasBattery ? `${currentData.healthPercent}% Saúde` : 'Desktop AC'}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {currentData?.source || 'Sensores do subsistema de energia em tempo real'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Ollama Local AI Analysis Button */}
          <button
            onClick={() => setOllamaOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
            title="Analisar saúde da bateria e ciclos com IA Local Ollama"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Análise IA (Ollama)</span>
          </button>

          {/* Mode Switcher */}
          <div className="bg-zinc-100 p-1 rounded-2xl flex items-center gap-1">
            <button
              onClick={() => setActiveMode('system')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'system' 
                  ? 'bg-white text-zinc-900 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Hardware Real
            </button>
            <button
              onClick={() => setActiveMode('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeMode === 'simulator' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Simulador / Notebook
            </button>
          </div>

          <button
            onClick={() => fetchBatteryData(true)}
            disabled={loading}
            className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
            title="Atualizar leituras"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={downloadingReport}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-95 shadow-sm transition"
          >
            <FileText className="w-3.5 h-3.5" />
            {downloadingReport ? 'Gerando...' : 'Exportar Relatório HTML'}
          </button>
        </div>
      </div>

      {/* Notice for Desktop vs Laptop */}
      {isDesktopNoBattery && activeMode === 'system' && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl">
              <Monitor className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">
                Computador Desktop Detectado (Alimentação Direta AC da Rede Elétrica)
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Esta máquina está conectada diretamente na tomada através da fonte de alimentação ATX. 
                Para testar os recursos de saúde de bateria e autonomia de notebook, ative o <strong>Simulador</strong> no botão acima!
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveMode('simulator')}
            className="text-xs font-bold text-amber-900 underline hover:text-amber-950 whitespace-nowrap"
          >
            Abrir Simulador &rarr;
          </button>
        </div>
      )}

      {/* Simulator Controls Bar if active */}
      {activeMode === 'simulator' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-50/60 border border-indigo-100 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Controles do Simulador de Bateria
            </h3>
            <span className="text-xs font-medium text-indigo-700 bg-indigo-100/70 px-2.5 py-1 rounded-lg">
              Ajuste os parâmetros para testar cenários de desgaste
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 space-y-2">
              <div className="flex justify-between font-semibold text-zinc-700">
                <span>Capacidade Original</span>
                <span className="text-indigo-600 font-bold">{simDesignWh} Wh</span>
              </div>
              <input 
                type="range" 
                min="35" 
                max="99" 
                value={simDesignWh} 
                onChange={(e) => setSimDesignWh(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <p className="text-[10px] text-zinc-400">Capacidade de fábrica (35Wh a 99Wh)</p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 space-y-2">
              <div className="flex justify-between font-semibold text-zinc-700">
                <span>Ciclos de Carga</span>
                <span className="text-indigo-600 font-bold">{simCycles} ciclos</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="800" 
                value={simCycles} 
                onChange={(e) => setSimCycles(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <p className="text-[10px] text-zinc-400">Degradação estimada: {simWearPct}%</p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 space-y-2">
              <div className="flex justify-between font-semibold text-zinc-700">
                <span>Nível de Carga</span>
                <span className="text-indigo-600 font-bold">{simChargePercent}%</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="100" 
                value={simChargePercent} 
                onChange={(e) => setSimChargePercent(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex items-center justify-between text-[10px]">
                <button 
                  onClick={() => setSimIsCharging(!simIsCharging)}
                  className={`px-2 py-0.5 rounded font-bold ${simIsCharging ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-700'}`}
                >
                  {simIsCharging ? '⚡ Na Tomada' : '🔋 Na Bateria'}
                </button>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 space-y-2">
              <div className="flex justify-between font-semibold text-zinc-700">
                <span>Perfil de Uso</span>
                <span className="text-indigo-600 font-bold uppercase">{simProfile}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1">
                <button
                  onClick={() => setSimProfile('light')}
                  className={`py-1 rounded text-[11px] font-bold ${simProfile === 'light' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  Leve
                </button>
                <button
                  onClick={() => setSimProfile('normal')}
                  className={`py-1 rounded text-[11px] font-bold ${simProfile === 'normal' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  Médio
                </button>
                <button
                  onClick={() => setSimProfile('gaming')}
                  className={`py-1 rounded text-[11px] font-bold ${simProfile === 'gaming' ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  Jogos
                </button>
              </div>
              <p className="text-[10px] text-zinc-400">Consumo: ~{powerDrainW} Watts</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Charge Level & Power Flow */}
        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Nível de Carga</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
              currentData?.isCharging 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-zinc-100 text-zinc-700'
            }`}>
              {currentData?.isCharging ? (
                <>
                  <Zap className="w-3 h-3 text-emerald-600 animate-pulse" />
                  Carregando (AC)
                </>
              ) : (
                <>
                  <Battery className="w-3 h-3 text-zinc-600" />
                  Descarregando
                </>
              )}
            </span>
          </div>

          <div className="my-3 flex items-center gap-6">
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-zinc-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={currentData?.percent && currentData.percent < 20 ? 'text-rose-500' : currentData?.percent && currentData.percent < 50 ? 'text-amber-500' : 'text-emerald-500'}
                  strokeDasharray={`${currentData?.percent || 100}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-zinc-900 tracking-tight">
                  {currentData?.percent}%
                </span>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Carga</span>
              </div>
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Fluxo de Energia</span>
                <span className={`font-bold font-mono ${
                  (currentData?.chargeRateWatts || 0) > 0 ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {(currentData?.chargeRateWatts || 0) > 0 ? `+${currentData?.chargeRateWatts} W` : `${currentData?.chargeRateWatts || 0} W`}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Autonomia / Tempo</span>
                <span className="font-bold text-zinc-800">
                  {currentData?.timeRemainingMinutes && currentData.timeRemainingMinutes > 0
                    ? `${Math.floor(currentData.timeRemainingMinutes / 60)}h ${currentData.timeRemainingMinutes % 60}m`
                    : currentData?.isCharging ? 'Conectado à rede' : 'Calculando...'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Tensão Atual</span>
                <span className="font-semibold text-zinc-800 font-mono">
                  {currentData?.voltage ? `${currentData.voltage} V` : '120 V (AC)'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Fonte de Energia:</span>
            <span className="font-bold text-zinc-800">{currentData?.powerSource === 'AC' ? 'Tomada AC (Rede Elétrica)' : 'Bateria Interna'}</span>
          </div>
        </div>

        {/* Card 2: Battery Health & Wear Level */}
        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Saúde & Degradação</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              (currentData?.healthPercent || 100) >= 85 
                ? 'bg-emerald-100 text-emerald-800' 
                : (currentData?.healthPercent || 100) >= 70 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-rose-100 text-rose-800'
            }`}>
              {currentData?.statusText || 'Excelente'}
            </span>
          </div>

          <div className="my-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-zinc-900 tracking-tight">
                {currentData?.healthPercent}%
              </span>
              <span className="text-xs font-bold text-zinc-400">Capacidade Retida</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Desgaste acumulado das células: <strong className="text-rose-600 font-bold">{currentData?.wearLevelPercent}%</strong>
            </p>

            {/* Health Bar */}
            <div className="w-full bg-zinc-100 h-3 rounded-full overflow-hidden mt-4 flex">
              <div 
                className={`h-full transition-all duration-500 ${
                  (currentData?.healthPercent || 100) >= 85 ? 'bg-emerald-500' : (currentData?.healthPercent || 100) >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${currentData?.healthPercent || 100}%` }}
              />
              <div 
                className="h-full bg-rose-200 transition-all duration-500"
                style={{ width: `${currentData?.wearLevelPercent || 0}%` }}
                title="Desgaste acumulado"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Ciclos Registrados:</span>
            <span className="font-bold text-zinc-800 font-mono">
              {currentData?.cycleCount ? `${currentData.cycleCount} ciclos` : 'N/A (Desktop)'}
            </span>
          </div>
        </div>

        {/* Card 3: Capacity Comparison (Design vs Full Charge) */}
        <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Capacidade Energética</span>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
              {currentData?.capacityUnit || 'mWh'}
            </span>
          </div>

          <div className="space-y-3.5 my-1">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">Capacidade de Projeto (Design)</span>
                <span className="font-bold text-zinc-900 font-mono">
                  {currentData?.designCapacity ? `${(currentData.designCapacity / 1000).toFixed(1)} Wh` : 'N/A (AC)'}
                </span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div className="bg-zinc-400 h-full w-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">Capacidade Carga Completa</span>
                <span className="font-bold text-emerald-600 font-mono">
                  {currentData?.maxCapacity ? `${(currentData.maxCapacity / 1000).toFixed(1)} Wh` : 'N/A (AC)'}
                </span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all" 
                  style={{ width: `${currentData?.healthPercent || 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-500">Carga Armazenada Agora</span>
                <span className="font-bold text-indigo-600 font-mono">
                  {currentData?.currentCapacity ? `${(currentData.currentCapacity / 1000).toFixed(1)} Wh` : 'Alimentado por AC'}
                </span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all" 
                  style={{ width: `${currentData?.percent || 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Plano de Energia Windows:</span>
            <span className="font-bold text-zinc-800 truncate max-w-[150px]" title={currentData?.powerPlan}>
              {currentData?.powerPlan || 'Equilibrado'}
            </span>
          </div>
        </div>

      </div>

      {/* Details & Specs Table */}
      <div className="bg-white rounded-3xl p-8 border border-black/5 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">Especificações Técnicas da Bateria</h3>
            <p className="text-xs text-zinc-500">Dados do controlador de carga, fabricante e química de silício</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 bg-zinc-100 text-zinc-700 rounded-xl">
              Tecnologia: {currentData?.technology}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-xs text-zinc-400">Modelo da Bateria</p>
            <p className="font-bold text-zinc-900 mt-1 font-mono text-xs truncate" title={currentData?.model}>
              {currentData?.model}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Fabricante / Fornecedor</p>
            <p className="font-bold text-zinc-900 mt-1 text-xs truncate" title={currentData?.manufacturer}>
              {currentData?.manufacturer}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Número de Série</p>
            <p className="font-bold text-zinc-900 mt-1 font-mono text-xs truncate" title={currentData?.serialNumber}>
              {currentData?.serialNumber}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Química das Células</p>
            <p className="font-bold text-zinc-900 mt-1 text-xs">
              {currentData?.technology}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Tensão Nominal / Operacional</p>
            <p className="font-bold text-zinc-900 mt-1 font-mono text-xs">
              {currentData?.voltage ? `${currentData.voltage} Volts` : '120V AC'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Temperatura Estimada</p>
            <p className="font-bold text-zinc-900 mt-1 text-xs flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              {currentData?.temperatureC ? `${currentData.temperatureC}°C (Normal)` : 'Ambiente'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Contagem de Ciclos</p>
            <p className="font-bold text-zinc-900 mt-1 font-mono text-xs">
              {currentData?.cycleCount ? `${currentData.cycleCount} ciclos completos` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Estado de Carga AC</p>
            <p className="font-bold text-emerald-600 mt-1 text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {currentData?.acConnected ? 'Conectado à Tomada' : 'Desconectado'}
            </p>
          </div>
        </div>

        {/* Tips Box */}
        <div className="p-5 rounded-2xl bg-indigo-50/80 border border-indigo-100 space-y-2.5">
          <p className="text-xs font-bold text-indigo-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Dicas para Maximizar a Vida Útil da Bateria:
          </p>
          <ul className="space-y-1.5 text-xs text-indigo-900">
            {currentData?.tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-indigo-600 font-bold">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Ollama Analysis Modal */}
      <OllamaAnalysisModal
        isOpen={ollamaOpen}
        onClose={() => setOllamaOpen(false)}
        page="battery"
        pageTitle="Saúde da Bateria & Gestão de Energia"
        contextData={currentData}
      />
    </div>
  );
};
