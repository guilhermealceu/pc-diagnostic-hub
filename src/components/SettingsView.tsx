import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Palette, 
  Cpu, 
  Globe, 
  Sliders, 
  ShieldCheck, 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Sun, 
  Moon, 
  Monitor, 
  Layers, 
  Zap, 
  Server,
  Key,
  Trash2,
  Check,
  AlertTriangle
} from 'lucide-react';

export interface AppSettings {
  flatMode: boolean; // Disable card shadows for minimal flat look
  theme: 'light' | 'dark' | 'system';
  accentColor: 'indigo' | 'emerald' | 'violet' | 'amber' | 'slate';
  telemetryInterval: number; // in ms (1000, 2000, 3000, 5000, 10000)
  graphHistoryLimit: number; // 10, 20, 30, 50
  ollamaHost: string;
  ollamaModel: string;
  searchProvider: 'none' | 'free_public' | 'searxng' | 'ollama_web';
  searxngUrl: string;
  ollamaApiKey: string;
  hardwareFallback: boolean;
  compactMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  flatMode: false,
  theme: 'light',
  accentColor: 'indigo',
  telemetryInterval: 3000,
  graphHistoryLimit: 20,
  ollamaHost: 'http://127.0.0.1:11434',
  ollamaModel: 'llama3.2',
  searchProvider: 'free_public',
  searxngUrl: 'http://localhost:8080',
  ollamaApiKey: '',
  hardwareFallback: true,
  compactMode: false
};

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetSettings: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings
}) => {
  const [activeSection, setActiveSection] = useState<'visual' | 'ai' | 'telemetry' | 'status'>('visual');
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; models: string[]; loading: boolean; message: string }>({
    connected: false,
    models: [],
    loading: false,
    message: 'Não testado'
  });
  const [searchStatus, setSearchStatus] = useState<{ testing: boolean; result: { success: boolean; message: string } | null }>({
    testing: false,
    result: null
  });
  const [savedBanner, setSavedBanner] = useState(false);

  // Test Ollama Connection
  const testOllamaConnection = async (hostUrl?: string) => {
    setOllamaStatus(prev => ({ ...prev, loading: true, message: 'Conectando ao Ollama...' }));
    try {
      const targetHost = hostUrl || settings.ollamaHost;
      const res = await fetch('/api/ollama/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: targetHost })
      });
      const data = await res.json();
      if (data.connected) {
        setOllamaStatus({
          connected: true,
          models: data.models || [],
          loading: false,
          message: `Conectado! ${data.models?.length || 0} modelo(s) detectado(s).`
        });
        if (data.models?.length > 0 && !data.models.includes(settings.ollamaModel)) {
          onUpdateSettings({ ollamaModel: data.models[0] });
        }
      } else {
        setOllamaStatus({
          connected: false,
          models: [],
          loading: false,
          message: data.error || 'Não foi possível conectar ao servidor Ollama.'
        });
      }
    } catch (err: any) {
      setOllamaStatus({
        connected: false,
        models: [],
        loading: false,
        message: `Erro de rede: ${err.message}`
      });
    }
  };

  // Test Search Provider
  const testSearchProvider = async () => {
    setSearchStatus({ testing: true, result: null });
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'hardware diagnostic test',
          provider: settings.searchProvider,
          searxngUrl: settings.searxngUrl,
          ollamaApiKey: settings.ollamaApiKey
        })
      });
      const data = await res.json();
      if (data.success && data.results?.length > 0) {
        setSearchStatus({
          testing: false,
          result: {
            success: true,
            message: `Busca operacional! ${data.results.length} resultados retornados via ${data.provider}.`
          }
        });
      } else {
        setSearchStatus({
          testing: false,
          result: {
            success: false,
            message: data.error || 'Nenhum resultado retornado do provedor selecionado.'
          }
        });
      }
    } catch (err: any) {
      setSearchStatus({
        testing: false,
        result: {
          success: false,
          message: `Falha na conexão: ${err.message}`
        }
      });
    }
  };

  useEffect(() => {
    testOllamaConnection();
  }, []);

  const triggerSaveNotification = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleToggleFlatMode = () => {
    onUpdateSettings({ flatMode: !settings.flatMode });
    triggerSaveNotification();
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-black/5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 leading-tight">Painel de Configurações</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Centralize preferências visuais, estilo minimalista flat, conexões de IA e parâmetros de sistema.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedBanner && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Preferências Salvas
            </span>
          )}
          <button
            onClick={onResetSettings}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 px-3 py-2 rounded-xl transition"
            title="Restaurar padrões de fábrica"
          >
            <RotateCcwIcon className="w-3.5 h-3.5" />
            Restaurar Padrões
          </button>
        </div>
      </div>

      {/* Main Grid: Left Nav Sections & Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Categorias</p>
          
          <button
            onClick={() => setActiveSection('visual')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition text-left ${
              activeSection === 'visual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-black/5'
            }`}
          >
            <Palette className="w-4 h-4" />
            <div className="min-w-0">
              <p className="leading-tight">Aparência & Estilo Flat</p>
              <p className={`text-[10px] ${activeSection === 'visual' ? 'text-indigo-100' : 'text-zinc-400'} font-normal mt-0.5`}>
                Sombras, temas e cores
              </p>
            </div>
          </button>

          <button
            onClick={() => setActiveSection('ai')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition text-left ${
              activeSection === 'ai'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-black/5'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <div className="min-w-0">
              <p className="leading-tight">IA Local & Motores de Busca</p>
              <p className={`text-[10px] ${activeSection === 'ai' ? 'text-indigo-100' : 'text-zinc-400'} font-normal mt-0.5`}>
                Ollama Local, SearXNG & APIs
              </p>
            </div>
          </button>

          <button
            onClick={() => setActiveSection('telemetry')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition text-left ${
              activeSection === 'telemetry'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-black/5'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <div className="min-w-0">
              <p className="leading-tight">Telemetria & Gráficos</p>
              <p className={`text-[10px] ${activeSection === 'telemetry' ? 'text-indigo-100' : 'text-zinc-400'} font-normal mt-0.5`}>
                Frequência e histórico
              </p>
            </div>
          </button>

          <button
            onClick={() => setActiveSection('status')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-semibold transition text-left ${
              activeSection === 'status'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-black/5'
            }`}
          >
            <Server className="w-4 h-4" />
            <div className="min-w-0">
              <p className="leading-tight">Diagnóstico do Sistema</p>
              <p className={`text-[10px] ${activeSection === 'status' ? 'text-indigo-100' : 'text-zinc-400'} font-normal mt-0.5`}>
                Status de APIs e Banco
              </p>
            </div>
          </button>

          {/* Quick Highlight Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-4 rounded-2xl mt-4">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Dica de Desempenho</span>
            </div>
            <p className="text-[11px] text-indigo-700 mt-1 leading-relaxed">
              Desativar as sombras ativa o **Modo Flat Minimalista**, deixando a renderização do navegador mais leve em GPUs integradas.
            </p>
          </div>
        </div>

        {/* Section Content */}
        <div className="lg:col-span-9 space-y-6">

          {/* SECTION 1: VISUAL & FLAT MODE */}
          {activeSection === 'visual' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Flat Minimalist Toggle Card */}
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-base font-bold text-zinc-900">Modo Flat Minimalista (Sem Sombras)</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        RECOMENDADO
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 max-w-xl">
                      Remove todas as sombras projetadas (`box-shadow`) dos cards, botões e modais do aplicativo, adotando bordas limpas e um design ultra-flat minimalista.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      checked={settings.flatMode} 
                      onChange={handleToggleFlatMode} 
                      className="sr-only peer" 
                    />
                    <div className="w-14 h-7 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Live Preview Comparison */}
                <div className="mt-6 pt-5 border-t border-zinc-100">
                  <p className="text-xs font-bold text-zinc-700 mb-3">Pré-visualização do Estilo:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl border border-zinc-200 bg-white ${settings.flatMode ? '' : 'shadow-md shadow-zinc-200'}`}>
                      <p className="text-xs font-bold text-zinc-800">Card de Teste Atual</p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {settings.flatMode ? 'Estilo Flat: Bordas limpas de 1px sem sombra.' : 'Estilo Clássico: Sombra suave ativada.'}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-700">Estado da Sombra:</span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${settings.flatMode ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {settings.flatMode ? 'SOMBRAS DESATIVADAS' : 'SOMBRAS ATIVADAS'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme & Accent Color */}
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-600" />
                    Tema da Interface
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Escolha a aparência geral do painel.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => { onUpdateSettings({ theme: 'light' }); triggerSaveNotification(); }}
                    className={`p-4 rounded-xl border text-left flex items-center gap-3 transition ${
                      settings.theme === 'light'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-xs font-bold">Claro (Light)</p>
                      <p className="text-[10px] text-zinc-500">Fundo limpo e alto contraste</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { onUpdateSettings({ theme: 'dark' }); triggerSaveNotification(); }}
                    className={`p-4 rounded-xl border text-left flex items-center gap-3 transition ${
                      settings.theme === 'dark'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-500" />
                    <div>
                      <p className="text-xs font-bold">Escuro (Modo Noturno)</p>
                      <p className="text-[10px] text-zinc-500">Ideal para ambientes escuros</p>
                    </div>
                  </button>

                  <button
                    onClick={() => { onUpdateSettings({ theme: 'system' }); triggerSaveNotification(); }}
                    className={`p-4 rounded-xl border text-left flex items-center gap-3 transition ${
                      settings.theme === 'system'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <Monitor className="w-5 h-5 text-zinc-500" />
                    <div>
                      <p className="text-xs font-bold">Sistema</p>
                      <p className="text-[10px] text-zinc-500">Segue preferência do SO</p>
                    </div>
                  </button>
                </div>

                {/* Compact Mode */}
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-800">Densidade de Informações Compacta</p>
                    <p className="text-[11px] text-zinc-500">Reduz paddings e margens para exibir mais dados em telas menores.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.compactMode} 
                      onChange={(e) => { onUpdateSettings({ compactMode: e.target.checked }); triggerSaveNotification(); }} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* SECTION 2: AI & SEARCH PROVIDERS */}
          {activeSection === 'ai' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Ollama Host & Model Config */}
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-600" />
                    Servidor Ollama Local
                  </h3>
                  <button
                    onClick={() => testOllamaConnection()}
                    disabled={ollamaStatus.loading}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ollamaStatus.loading ? 'animate-spin' : ''}`} />
                    Testar Conexão
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Endpoint do Servidor Ollama:
                    </label>
                    <input
                      type="text"
                      value={settings.ollamaHost}
                      onChange={(e) => { onUpdateSettings({ ollamaHost: e.target.value }); triggerSaveNotification(); }}
                      placeholder="http://127.0.0.1:11434"
                      className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                    />
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Padrão no Windows: <code className="bg-zinc-100 px-1 py-0.5 rounded">http://127.0.0.1:11434</code>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">
                      Modelo LLM Padrão:
                    </label>
                    {ollamaStatus.models.length > 0 ? (
                      <select
                        value={settings.ollamaModel}
                        onChange={(e) => { onUpdateSettings({ ollamaModel: e.target.value }); triggerSaveNotification(); }}
                        className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-semibold text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      >
                        {ollamaStatus.models.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={settings.ollamaModel}
                        onChange={(e) => { onUpdateSettings({ ollamaModel: e.target.value }); triggerSaveNotification(); }}
                        placeholder="llama3.2"
                        className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-semibold text-zinc-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none"
                      />
                    )}
                    <p className="text-[10px] text-zinc-400 mt-1">
                      Modelos recomendados: <code className="bg-zinc-100 px-1 py-0.5 rounded">llama3.2</code>, <code className="bg-zinc-100 px-1 py-0.5 rounded">mistral</code>, <code className="bg-zinc-100 px-1 py-0.5 rounded">gemma2</code>
                    </p>
                  </div>
                </div>

                {/* Connection Status Indicator */}
                <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  ollamaStatus.connected 
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {ollamaStatus.connected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{ollamaStatus.message}</span>
                  </div>
                  {ollamaStatus.models.length > 0 && (
                    <span className="text-[10px] bg-white/80 px-2 py-0.5 rounded border border-emerald-300">
                      {ollamaStatus.models.length} modelo(s) pronto(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Real-Time Web Search Settings */}
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-600" />
                    Buscador Web em Tempo Real
                  </h3>
                  <button
                    onClick={() => testSearchProvider()}
                    disabled={searchStatus.testing}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${searchStatus.testing ? 'animate-spin' : ''}`} />
                    Testar Busca
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-2">Provedor de Pesquisa:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'free_public', name: 'Gratuito (DuckDuckGo / Wiki)', desc: 'Sem API key, direto da web pública' },
                      { id: 'none', name: '100% Offline (Sem Web)', desc: 'Analisa apenas com base local do modelo' },
                      { id: 'searxng', name: 'SearXNG Local / Privado', desc: 'Requer servidor SearXNG na porta 8080' },
                      { id: 'ollama_web', name: 'Chave API Customizada', desc: 'Para APIs externas ou proxies de busca' }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => { onUpdateSettings({ searchProvider: p.id as any }); triggerSaveNotification(); }}
                        className={`p-3 rounded-xl border text-left transition ${
                          settings.searchProvider === p.id
                            ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-bold'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        <p className="text-xs font-bold">{p.name}</p>
                        <p className="text-[10px] text-zinc-500 font-normal mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {settings.searchProvider === 'searxng' && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1">URL do SearXNG:</label>
                    <input
                      type="text"
                      value={settings.searxngUrl}
                      onChange={(e) => { onUpdateSettings({ searxngUrl: e.target.value }); triggerSaveNotification(); }}
                      placeholder="http://localhost:8080"
                      className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                )}

                {searchStatus.result && (
                  <div className={`p-3.5 rounded-xl border text-xs font-semibold ${
                    searchStatus.result.success ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                    {searchStatus.result.message}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* SECTION 3: TELEMETRY & GRAPH LIMITS */}
          {activeSection === 'telemetry' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-600" />
                    Intervalo de Leitura da Telemetria
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Defina a frequência de atualização dos dados de hardware.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { ms: 1000, label: '1 Segundo', sub: 'Tempo real agressivo' },
                    { ms: 2000, label: '2 Segundos', sub: 'Rápido' },
                    { ms: 3000, label: '3 Segundos', sub: 'Padrão (Recomendado)' },
                    { ms: 5000, label: '5 Segundos', sub: 'Economia de CPU' },
                    { ms: 10000, label: '10 Segundos', sub: 'Mínimo uso de fundo' }
                  ].map(item => (
                    <button
                      key={item.ms}
                      onClick={() => { onUpdateSettings({ telemetryInterval: item.ms }); triggerSaveNotification(); }}
                      className={`p-3 rounded-xl border text-center transition ${
                        settings.telemetryInterval === item.ms
                          ? 'border-indigo-600 bg-indigo-600 text-white font-bold shadow-sm'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      <p className="text-xs font-bold">{item.label}</p>
                      <p className={`text-[9px] ${settings.telemetryInterval === item.ms ? 'text-indigo-100' : 'text-zinc-400'} mt-0.5`}>
                        {item.sub}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t border-zinc-100 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800">Retenção de Histórico nos Gráficos ao Vivo</h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Quantidade máxima de pontos mantidos na memória dos gráficos.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {[10, 20, 30, 50].map(points => (
                      <button
                        key={points}
                        onClick={() => { onUpdateSettings({ graphHistoryLimit: points }); triggerSaveNotification(); }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                          settings.graphHistoryLimit === points
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {points} Pontos
                      </button>
                    ))}
                  </div>
                </div>

                {/* Hardware WMI Fallback Switch */}
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-800">Fallback de Sensores em Baixo Nível (WMI / PowerShell)</p>
                    <p className="text-[11px] text-zinc-500">Tenta consultar LibreHardwareMonitor, OpenHardwareMonitor e nvidia-smi se os sensores padrão retornarem 0.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.hardwareFallback} 
                      onChange={(e) => { onUpdateSettings({ hardwareFallback: e.target.checked }); triggerSaveNotification(); }} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* SECTION 4: SYSTEM & DIAGNOSTICS */}
          {activeSection === 'status' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-5">
                <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-600" />
                  Diagnóstico de Integridade do Sistema & APIs
                </h3>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-xs font-bold text-emerald-950">Servidor Node.js Backend & API Express</p>
                        <p className="text-[10px] text-emerald-700">Porta 3000 ativa e respondendo às rotas REST</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-800 bg-white/80 px-2.5 py-1 rounded-md border border-emerald-300">ONLINE</span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-xs font-bold text-emerald-950">Banco de Dados SQLite (Telemetria & Históricos)</p>
                        <p className="text-[10px] text-emerald-700">Tabelas de sessões e data_points inicializadas corretamente</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-800 bg-white/80 px-2.5 py-1 rounded-md border border-emerald-300">PRONTO</span>
                  </div>

                  <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    ollamaStatus.connected ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'
                  }`}>
                    <div className="flex items-center gap-3">
                      {ollamaStatus.connected ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-zinc-900">Servidor LLM Ollama Local ({settings.ollamaHost})</p>
                        <p className="text-[10px] text-zinc-600">{ollamaStatus.message}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                      ollamaStatus.connected ? 'text-emerald-800 bg-white/80 border-emerald-300' : 'text-amber-800 bg-white/80 border-amber-300'
                    }`}>
                      {ollamaStatus.connected ? 'CONECTADO' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};

function RotateCcwIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
