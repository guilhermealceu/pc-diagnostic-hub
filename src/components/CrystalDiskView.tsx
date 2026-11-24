import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Disc, 
  Thermometer, 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  RefreshCw, 
  FileText, 
  Gauge, 
  Zap, 
  Copy, 
  Check, 
  Info,
  Play,
  Flame,
  Search,
  Sparkles,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OllamaAnalysisModal } from './OllamaAnalysisModal';

export interface SmartAttribute {
  id: string;
  idHex: string;
  name: string;
  current: number;
  worst: number;
  threshold: number;
  rawValue: string;
  rawNumeric: number;
  status: 'good' | 'warning' | 'bad';
  description: string;
}

export interface DiskDriveInfo {
  id: string;
  name: string;
  model: string;
  vendor: string;
  serialNum: string;
  firmwareRevision: string;
  type: 'NVMe' | 'SSD' | 'HDD' | 'USB' | 'Virtual';
  interfaceType: string;
  transferMode: string;
  standard: string;
  size: number;
  sizeFormatted: string;
  driveLetters: string[];
  mountPoints: string[];
  usedSpace: number;
  freeSpace: number;
  usedPercentage: number;
  healthStatus: 'Saudável' | 'Alerta' | 'Crítico';
  healthPercentage: number;
  temperature: number;
  temperatureF: number;
  rotationRate: string;
  powerOnHours: number;
  powerOnDays: number;
  powerOnCount: number;
  totalHostReadsTB: number;
  totalHostWritesTB: number;
  features: {
    smart: boolean;
    trim: boolean;
    ncq: boolean;
    volatileWriteCache: boolean;
    devSleep: boolean;
    gpl: boolean;
    apm: boolean;
    aam: boolean;
  };
  smartAttributes: SmartAttribute[];
  isRealData: boolean;
}

interface BenchmarkResult {
  sequentialWriteMBps: number;
  sequentialReadMBps: number;
  randomWriteIOPS: number;
  randomReadIOPS: number;
  latencyMs: number;
  testSizeMB: number;
}

export const CrystalDiskView: React.FC = () => {
  const [drives, setDrives] = useState<DiskDriveInfo[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isWindows, setIsWindows] = useState<boolean>(false);
  const [isRealHardware, setIsRealHardware] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<string>('');
  const [showLocalGuide, setShowLocalGuide] = useState<boolean>(false);
  const [copiedSerial, setCopiedSerial] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  
  // Benchmark modal state
  const [showBenchmark, setShowBenchmark] = useState<boolean>(false);
  const [benchmarking, setBenchmarking] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [benchmarkSize, setBenchmarkSize] = useState<number>(64);

  // Report modal
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportText, setReportText] = useState<string>('');
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Ollama Modal
  const [ollamaOpen, setOllamaOpen] = useState<boolean>(false);

  const fetchDrives = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/disks');
      if (!res.ok) throw new Error('Falha ao carregar discos');
      const data = await res.json();
      setDrives(data.drives || []);
      setIsWindows(!!data.isWindows);
      setIsRealHardware(!!data.isRealHardware);
      setDataSource(data.source || (data.isRealHardware ? 'Hardware Físico Real' : 'Ambiente Sandbox'));
      if (data.drives && data.drives.length > 0) {
        if (!selectedDriveId || !data.drives.find((d: DiskDriveInfo) => d.id === selectedDriveId)) {
          setSelectedDriveId(data.drives[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados dos discos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrives();
  }, []);

  const selectedDrive = drives.find(d => d.id === selectedDriveId) || drives[0];

  const handleCopySerial = (serial: string) => {
    navigator.clipboard.writeText(serial);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 2000);
  };

  const handleOpenReport = async () => {
    if (!selectedDrive) return;
    setLoadingReport(true);
    setShowReportModal(true);
    try {
      const res = await fetch(`/api/disks/${selectedDrive.id}/report`);
      const txt = await res.text();
      setReportText(txt);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      setReportText('Erro ao gerar relatório.');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDownloadReport = () => {
    if (!reportText || !selectedDrive) return;
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RuneProjects_${selectedDrive.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    if (!reportText) return;
    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const runBenchmarkTest = async () => {
    setBenchmarking(true);
    setBenchmarkResult(null);
    try {
      const res = await fetch('/api/disks/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizeMB: benchmarkSize })
      });
      const data = await res.json();
      setBenchmarkResult(data);
    } catch (err) {
      console.error('Erro no benchmark:', err);
    } finally {
      setBenchmarking(false);
    }
  };

  const filteredAttributes = selectedDrive?.smartAttributes.filter(attr => 
    attr.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    attr.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
    attr.idHex.toLowerCase().includes(filterQuery.toLowerCase())
  ) || [];

  if (loading && drives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500 gap-4">
        <RefreshCw className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-base font-medium">Lendo dados de telemetria S.M.A.R.T. e barramentos dos discos...</p>
      </div>
    );
  }

  if (!selectedDrive) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-black/5 text-center shadow-sm">
        <HardDrive className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-zinc-800">Nenhum disco detectado</h3>
        <p className="text-zinc-500 mt-2">Não foi possível identificar unidades de armazenamento ativas.</p>
        <button 
          onClick={fetchDrives}
          className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition"
        >
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  // Health color styling
  const isHealthy = selectedDrive.healthStatus === 'Saudável';
  const isCaution = selectedDrive.healthStatus === 'Alerta';
  const healthBgColor = isHealthy ? 'bg-sky-500' : isCaution ? 'bg-amber-500' : 'bg-rose-500';
  const healthTextColor = isHealthy ? 'text-sky-600' : isCaution ? 'text-amber-600' : 'text-rose-600';
  const healthBadgeBg = isHealthy ? 'bg-sky-50 border-sky-200' : isCaution ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';

  // Temperature color
  const temp = selectedDrive.temperature;
  const tempColor = temp < 45 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : temp < 60 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-rose-600 bg-rose-50 border-rose-200';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* LEFT SIDEBAR: Actions & Drive Selection */}
      <div className="lg:col-span-3 space-y-4">
        
        {/* Title & Brand Card */}
        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-zinc-900 leading-tight">Rune Projects</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-tight mt-0.5">
                Saúde & Telemetria S.M.A.R.T.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Panel */}
        <div className="bg-white p-3.5 rounded-2xl border border-black/5 shadow-sm space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Ações Rápidas</p>

          <button
            onClick={() => setOllamaOpen(true)}
            className="w-full flex items-center justify-between gap-2 bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl text-xs font-semibold shadow-sm transition"
            title="Diagnóstico de integridade SMART com IA Local Ollama"
          >
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Análise IA (Ollama)
            </span>
            <span className="text-[9px] bg-white/20 text-white font-bold px-1.5 py-0.5 rounded">
              LOCAL
            </span>
          </button>

          <button
            onClick={() => setShowBenchmark(true)}
            className="w-full flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-900 border border-indigo-200/60 p-2.5 rounded-xl text-xs font-semibold transition"
          >
            <Zap className="w-4 h-4 text-indigo-600" />
            Mini Rune Benchmark
          </button>

          <button
            onClick={handleOpenReport}
            className="w-full flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 p-2.5 rounded-xl text-xs font-medium transition"
          >
            <FileText className="w-4 h-4 text-zinc-600" />
            Gerar Relatório
          </button>

          <button
            onClick={() => setShowLocalGuide(true)}
            className="w-full flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200/80 p-2.5 rounded-xl text-[11px] font-semibold hover:bg-emerald-100 transition"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">{isRealHardware ? 'Hardware Real' : 'Leitura no PC'}</span>
          </button>

          <button
            onClick={fetchDrives}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 border border-zinc-200 text-zinc-600 p-2 rounded-xl text-xs font-medium hover:bg-zinc-50 transition"
            title="Atualizar leituras"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar Leituras</span>
          </button>
        </div>

        {/* Drives Selector (Vertical List) */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Unidades ({drives.length})</p>
          <div className="space-y-2">
            {drives.map((disk) => {
              const isSelected = disk.id === selectedDrive.id;
              const diskIsHealthy = disk.healthStatus === 'Saudável';
              return (
                <button
                  key={disk.id}
                  onClick={() => setSelectedDriveId(disk.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-white/80 border-black/5 hover:border-zinc-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${disk.type === 'NVMe' ? 'bg-purple-50 text-purple-600' : disk.type === 'SSD' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                        {disk.type === 'NVMe' ? <Zap className="w-4 h-4" /> : disk.type === 'SSD' ? <HardDrive className="w-4 h-4" /> : <Disc className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800">
                            {disk.driveLetters.join(' ')}
                          </span>
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase">{disk.type}</span>
                        </div>
                        <p className="font-bold text-xs text-zinc-900 truncate mt-0.5" title={disk.name}>
                          {disk.name}
                        </p>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        diskIsHealthy ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {disk.healthPercentage}%
                      </span>
                      <span className="text-[10px] font-medium text-zinc-500">
                        {disk.temperature}°C
                      </span>
                    </div>
                  </div>

                  {/* Mini capacity bar */}
                  <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{disk.sizeFormatted}</span>
                    <span className="font-medium text-zinc-700">{disk.usedPercentage}% Usado</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* RIGHT MAIN COLUMN: Drives Dashboard Overview */}
      <div className="lg:col-span-9 space-y-5">
        
        {/* Compact Notice Banner */}
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-indigo-950">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-900">
                {isRealHardware 
                  ? `Hardware Físico: ${dataSource}` 
                  : `Motor de Telemetria: ${dataSource}`}
              </p>
              <p className="text-[11px] text-indigo-700 mt-0.2">
                Conectado ao barramento NVMe/SATA via WMI/Storage API para leitura dos sensores S.M.A.R.T.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLocalGuide(true)}
            className="text-xs font-bold text-indigo-700 underline hover:text-indigo-900 whitespace-nowrap"
          >
            Como rodar no PC &rarr;
          </button>
        </div>

        {/* Main Drive Dashboard Overview (Rune Projects Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Health & Temperature Mega Gauges */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Health Status Card */}
          <div className={`p-6 rounded-3xl border shadow-sm ${healthBadgeBg} flex flex-col items-center text-center justify-center relative overflow-hidden`}>
            <div className="absolute top-4 left-4">
              <ShieldCheck className={`w-6 h-6 ${healthTextColor}`} />
            </div>
            
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2">Estado de Saúde</p>
            
            <div className={`w-28 h-28 rounded-full ${healthBgColor} text-white flex flex-col items-center justify-center shadow-lg shadow-sky-500/20 my-2`}>
              <span className="text-3xl font-black">{selectedDrive.healthPercentage}%</span>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">{selectedDrive.healthStatus}</span>
            </div>

            <p className="text-sm font-semibold text-zinc-800 mt-2">
              {selectedDrive.healthPercentage >= 95 ? 'Excelente Condição de Operação' : 'Desgaste Normal de Mídia'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Limiar Crítico: 10% de Reserva Flash
            </p>
          </div>

          {/* Temperature Card */}
          <div className={`p-6 rounded-3xl border shadow-sm ${tempColor} flex flex-col items-center text-center justify-center`}>
            <div className="flex items-center gap-2 mb-1">
              <Thermometer className="w-5 h-5" />
              <p className="text-xs font-bold uppercase tracking-wider">Temperatura Operacional</p>
            </div>
            
            <div className="my-2">
              <span className="text-4xl font-black">{selectedDrive.temperature}°C</span>
              <span className="text-base font-medium text-zinc-500 ml-2">/ {selectedDrive.temperatureF}°F</span>
            </div>

            <div className="w-full bg-zinc-200/60 rounded-full h-2 mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full ${selectedDrive.temperature < 45 ? 'bg-emerald-500' : selectedDrive.temperature < 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, (selectedDrive.temperature / 80) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between w-full text-[10px] text-zinc-400 mt-1 font-medium">
              <span>0°C</span>
              <span>45°C (Ideal)</span>
              <span>80°C (Max)</span>
            </div>
          </div>

          {/* Life Cycle / Power Stats */}
          <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Uso Acumulado & Ciclos</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 p-3 rounded-2xl">
                <p className="text-xs text-zinc-500">Horas Ligado</p>
                <p className="text-lg font-bold text-zinc-900 mt-0.5">{selectedDrive.powerOnHours.toLocaleString()} h</p>
                <p className="text-[11px] text-zinc-400">~{selectedDrive.powerOnDays} dias</p>
              </div>

              <div className="bg-zinc-50 p-3 rounded-2xl">
                <p className="text-xs text-zinc-500">Inicializações</p>
                <p className="text-lg font-bold text-zinc-900 mt-0.5">{selectedDrive.powerOnCount.toLocaleString()}</p>
                <p className="text-[11px] text-zinc-400">Ciclos de energia</p>
              </div>

              <div className="bg-zinc-50 p-3 rounded-2xl">
                <p className="text-xs text-zinc-500">Gravações Host</p>
                <p className="text-lg font-bold text-zinc-900 mt-0.5">{selectedDrive.totalHostWritesTB} TB</p>
                <p className="text-[11px] text-zinc-400">Total Host Writes</p>
              </div>

              <div className="bg-zinc-50 p-3 rounded-2xl">
                <p className="text-xs text-zinc-500">Leituras Host</p>
                <p className="text-lg font-bold text-zinc-900 mt-0.5">{selectedDrive.totalHostReadsTB} TB</p>
                <p className="text-[11px] text-zinc-400">Total Host Reads</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Identity Specs & SMART Attributes Table */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Identity & Technical Specs Card */}
          <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">{selectedDrive.vendor || 'Fabricante'}</p>
                <h3 className="text-xl font-bold text-zinc-900">{selectedDrive.model}</h3>
              </div>
              <span className="px-3 py-1 bg-zinc-100 text-zinc-800 text-xs font-bold rounded-xl">
                {selectedDrive.interfaceType}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-3.5 gap-x-6 text-sm">
              <div>
                <p className="text-xs text-zinc-400">Firmware</p>
                <p className="font-semibold text-zinc-800 font-mono text-xs mt-0.5 truncate" title={selectedDrive.firmwareRevision}>{selectedDrive.firmwareRevision}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-zinc-400">Número de Série</p>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <p className="font-semibold text-zinc-800 font-mono text-xs truncate" title={selectedDrive.serialNum}>{selectedDrive.serialNum}</p>
                  <button 
                    onClick={() => handleCopySerial(selectedDrive.serialNum)}
                    className="text-zinc-400 hover:text-indigo-600 transition shrink-0 p-0.5 rounded hover:bg-zinc-100"
                    title="Copiar serial completo"
                  >
                    {copiedSerial ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Interface / Barramento</p>
                <p className="font-semibold text-zinc-800 text-xs mt-0.5 truncate" title={selectedDrive.interfaceType}>{selectedDrive.interfaceType}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Modo de Transferência</p>
                <p className="font-semibold text-zinc-800 text-xs mt-0.5">{selectedDrive.transferMode}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Padrão Suportado</p>
                <p className="font-semibold text-zinc-800 text-xs mt-0.5">{selectedDrive.standard}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400">Taxa de Rotação</p>
                <p className="font-semibold text-zinc-800 text-xs mt-0.5">{selectedDrive.rotationRate}</p>
              </div>
            </div>

            {/* Storage Usage Bar */}
            <div className="pt-2">
              <div className="flex justify-between text-xs mb-1.5 font-medium">
                <span className="text-zinc-500">
                  Capacidade: <strong className="text-zinc-800">{selectedDrive.sizeFormatted}</strong> (Letra: {selectedDrive.driveLetters.join(', ')})
                </span>
                <span className="text-zinc-600">
                  {(((selectedDrive.usedSpace || 0)) / 1024 / 1024 / 1024).toFixed(1)} GB usado / {(((selectedDrive.freeSpace || 0)) / 1024 / 1024 / 1024).toFixed(1)} GB livre
                </span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden p-0.5 border border-black/5">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(3, selectedDrive.usedPercentage)}%` }}
                />
              </div>
            </div>

            {/* Supported Features Badges */}
            <div className="pt-3 border-t border-zinc-100 flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-zinc-500 mr-1">Recursos:</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${selectedDrive.features.smart ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                S.M.A.R.T.
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${selectedDrive.features.trim ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                TRIM
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${selectedDrive.features.ncq ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                NCQ
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${selectedDrive.features.volatileWriteCache ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                VolatileWriteCache
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${selectedDrive.features.devSleep ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                DevSleep
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${selectedDrive.features.gpl ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                GPL
              </span>
            </div>
          </div>

          {/* S.M.A.R.T. Attributes Table Card */}
          <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Tabela de Atributos S.M.A.R.T.
                </h4>
                <p className="text-xs text-zinc-500">Valores nominais, piores índices e contadores brutos em hexadecimal.</p>
              </div>

              {/* Search filter input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar atributos ou ID..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-2xl border border-zinc-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200/80 text-zinc-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">St</th>
                    <th className="py-3 px-3 w-16">ID</th>
                    <th className="py-3 px-4">Nome do Atributo</th>
                    <th className="py-3 px-3 text-right">Atual</th>
                    <th className="py-3 px-3 text-right">Pior</th>
                    <th className="py-3 px-3 text-right">Limiar</th>
                    <th className="py-3 px-4 text-right font-mono">Valor Bruto (Hex)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {filteredAttributes.length > 0 ? (
                    filteredAttributes.map((attr) => (
                      <tr key={attr.id} className="hover:bg-zinc-50/80 transition-colors group">
                        <td className="py-2.5 px-3 text-center">
                          <span 
                            className={`inline-block w-3 h-3 rounded-full ${
                              attr.status === 'good' ? 'bg-sky-500 shadow-sm shadow-sky-300' : attr.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} 
                            title={attr.status === 'good' ? 'Saudável (Normal)' : 'Aviso / Atenção'}
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-zinc-700">
                          {attr.id}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-900 font-medium">
                          <div>
                            <span>{attr.name}</span>
                            {attr.description && (
                              <p className="text-[11px] text-zinc-400 font-normal line-clamp-1 group-hover:line-clamp-none transition-all">
                                {attr.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-700 font-mono">
                          {attr.current}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-700 font-mono">
                          {attr.worst}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-500 font-mono">
                          {attr.threshold}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-zinc-800 font-semibold">
                          {attr.rawValue}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-400">
                        Nenhum atributo corresponde à busca.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Azul/Ciano: Normal
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block ml-2" /> Amarelo: Alerta
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block ml-2" /> Vermelho: Crítico
              </span>
              <span>Total de {selectedDrive.smartAttributes.length} parâmetros monitorados</span>
            </div>

          </div>

        </div>

      </div>

    </div>

      {/* Mini Rune Benchmark Modal */}
      <AnimatePresence>
        {showBenchmark && (
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
              className="bg-white rounded-3xl p-6 max-w-xl w-full border border-black/10 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">Mini Rune Benchmark</h3>
                    <p className="text-xs text-zinc-500">Teste de taxa de transferência de leitura e gravação I/O.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBenchmark(false)}
                  className="text-zinc-400 hover:text-zinc-600 p-2 rounded-xl hover:bg-zinc-100 transition"
                >
                  ✕
                </button>
              </div>

              {/* Target Drive & Config */}
              <div className="bg-zinc-50 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Unidade de Teste:</span>
                  <span className="font-bold text-zinc-900">{selectedDrive.name} ({selectedDrive.driveLetters.join(' ')})</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Tamanho do Bloco de Teste:</span>
                  <select 
                    value={benchmarkSize}
                    onChange={(e) => setBenchmarkSize(Number(e.target.value))}
                    disabled={benchmarking}
                    className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value={32}>32 MiB (Rápido)</option>
                    <option value={64}>64 MiB (Recomendado)</option>
                    <option value={128}>128 MiB (Profundo)</option>
                  </select>
                </div>
              </div>

              {/* Benchmark Results Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-between">
                  <span className="text-xs font-bold text-indigo-700 uppercase">Leitura Sequencial</span>
                  <div className="my-2">
                    <span className="text-2xl font-black text-indigo-950">
                      {benchmarkResult ? benchmarkResult.sequentialReadMBps : benchmarking ? '...' : '--'}
                    </span>
                    <span className="text-xs text-indigo-600 ml-1">MB/s</span>
                  </div>
                  <span className="text-[11px] text-indigo-500 font-medium">
                    {benchmarkResult ? `${benchmarkResult.randomReadIOPS.toLocaleString()} IOPS (4K)` : 'Seq Q8T1'}
                  </span>
                </div>

                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 flex flex-col justify-between">
                  <span className="text-xs font-bold text-blue-700 uppercase">Gravação Sequencial</span>
                  <div className="my-2">
                    <span className="text-2xl font-black text-blue-950">
                      {benchmarkResult ? benchmarkResult.sequentialWriteMBps : benchmarking ? '...' : '--'}
                    </span>
                    <span className="text-xs text-blue-600 ml-1">MB/s</span>
                  </div>
                  <span className="text-[11px] text-blue-500 font-medium">
                    {benchmarkResult ? `${benchmarkResult.randomWriteIOPS.toLocaleString()} IOPS (4K)` : 'Seq Q8T1'}
                  </span>
                </div>
              </div>

              {benchmarkResult && (
                <div className="flex justify-between items-center text-xs text-zinc-500 bg-zinc-50 px-4 py-2.5 rounded-xl">
                  <span>Latência Média: <strong className="text-zinc-800">{benchmarkResult.latencyMs} ms</strong></span>
                  <span>Amostragem: <strong className="text-zinc-800">{benchmarkResult.testSizeMB} MB</strong></span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowBenchmark(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition"
                >
                  Fechar
                </button>
                <button
                  onClick={runBenchmarkTest}
                  disabled={benchmarking}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-200 transition disabled:opacity-50"
                >
                  {benchmarking ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Executando Teste I/O...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Iniciar Benchmark
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rune Projects Text Report Modal */}
      <AnimatePresence>
        {showReportModal && (
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
              className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col border border-black/10 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">Relatório Rune Projects</h3>
                    <p className="text-xs text-zinc-500">Formato padrão de diagnóstico de integridade física.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 p-2 rounded-xl hover:bg-zinc-100 transition"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-auto bg-zinc-900 text-zinc-200 p-4 rounded-2xl font-mono text-xs whitespace-pre select-all">
                {loadingReport ? 'Gerando relatório detalhado...' : reportText}
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-zinc-400">Compatível com relatórios técnicos e garantias RMA.</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="flex items-center gap-2 bg-zinc-100 text-zinc-700 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-zinc-200 transition"
                  >
                    {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedReport ? 'Copiado!' : 'Copiar Texto'}
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 transition shadow-md shadow-indigo-100"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar TXT
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local Hardware Real Execution Guide Modal */}
      <AnimatePresence>
        {showLocalGuide && (
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
              className="bg-white rounded-3xl p-6 max-w-2xl w-full border border-black/10 shadow-2xl space-y-5"
            >
              <div className="flex justify-between items-start border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">Leitura de Hardware 100% Real</h3>
                    <p className="text-xs text-zinc-500">Como o aplicativo acessa os sensores do seu computador</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLocalGuide(false)}
                  className="text-zinc-400 hover:text-zinc-600 p-2 rounded-xl hover:bg-zinc-100 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-sm text-zinc-600">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-950">
                  <p className="font-bold text-emerald-900 mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Sim! Quando você rodar no seu PC, a leitura é 100% real.
                  </p>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    O backend Node.js executa chamadas nativas ao <strong>Windows WMI / CIM</strong>, à API <code>Get-PhysicalDisk</code> / <code>Get-StorageReliabilityCounter</code> do PowerShell, e ao subsistema de kernel do sistema operacional.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <p className="font-bold text-zinc-800 text-xs uppercase tracking-wider">Por que na web você vê dados de demonstração?</p>
                  <ul className="space-y-2 text-xs">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                      <span><strong>No navegador Cloud (aqui):</strong> O app roda dentro de um contêiner virtual isolado no Google Cloud (sem acesso aos seus cabos SATA/PCIe ou sensores da sua placa-mãe).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                      <span><strong>No seu PC físico:</strong> Assim que você baixa o projeto e roda no seu Windows/Linux, o servidor se comunica com seus discos reais (Samsung, Kingston, WD, Crucial, etc.), medindo temperaturas reais, ciclos de energia, desgaste de vida útil e velocidade real de leitura/escrita.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-zinc-900 text-zinc-200 p-4 rounded-2xl font-mono text-xs space-y-2">
                  <p className="text-zinc-400 text-[11px] font-sans font-semibold">Passo a passo para rodar no seu PC:</p>
                  <p className="text-emerald-400"># 1. Instalar dependências</p>
                  <p className="bg-black/40 p-2 rounded-lg">npm install</p>
                  <p className="text-emerald-400"># 2. Executar em modo Administrador</p>
                  <p className="bg-black/40 p-2 rounded-lg">npm run dev</p>
                  <p className="text-zinc-400 text-[11px] font-sans mt-2">
                    💡 <em>Abra seu navegador em <code>http://localhost:3000</code> e veja seu hardware real em ação!</em>
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowLocalGuide(false)}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                >
                  Entendi, perfeito!
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
        page="disks"
        pageTitle="Saúde dos Discos & SMART"
        contextData={{
          selectedDrive,
          totalDrives: drives.length,
          allDrives: drives.map(d => ({
            name: d.name,
            model: d.model,
            type: d.type,
            size: d.sizeFormatted,
            health: d.healthStatus,
            healthPercent: d.healthPercentage,
            temp: d.temperature,
            powerOnHours: d.powerOnHours,
            usedPercent: d.usedPercentage
          }))
        }}
      />
    </div>
  );
};
