import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Settings, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Copy, 
  Check, 
  Terminal, 
  Cpu, 
  ShieldCheck, 
  Layers,
  ChevronDown,
  Globe,
  Search,
  ExternalLink,
  Key,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

export interface OllamaModel {
  name: string;
  size: number;
}

export interface SearchCitation {
  title: string;
  url: string;
  content: string;
  source?: string;
}

export interface OllamaStatus {
  connected: boolean;
  endpoint: string;
  models: OllamaModel[];
  selectedModel: string;
  error?: string;
  searchCapabilities?: {
    searxngConfigured: boolean;
    ollamaWebConfigured: boolean;
  };
}


interface OllamaAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: 'diagnostic' | 'processes' | 'disks' | 'battery' | 'history' | 'process_explain';
  pageTitle: string;
  contextData: any;
  processItem?: any;
  initialEndpoint?: string;
  initialModel?: string;
  initialSearchProvider?: 'none' | 'free_public' | 'searxng' | 'ollama_web' | 'auto';
  initialSearxngUrl?: string;
  initialOllamaApiKey?: string;
}

export const OllamaAnalysisModal: React.FC<OllamaAnalysisModalProps> = ({
  isOpen,
  onClose,
  page,
  pageTitle,
  contextData,
  processItem,
  initialEndpoint,
  initialModel,
  initialSearchProvider,
  initialSearxngUrl,
  initialOllamaApiKey
}) => {
  const [status, setStatus] = useState<OllamaStatus>({
    connected: false,
    endpoint: initialEndpoint || 'http://127.0.0.1:11434',
    models: [],
    selectedModel: initialModel || 'llama3.2'
  });
  const [selectedModel, setSelectedModel] = useState<string>(initialModel || 'llama3.2');
  const [customEndpoint, setCustomEndpoint] = useState<string>(initialEndpoint || 'http://127.0.0.1:11434');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Web Search Configuration
  const [searchProvider, setSearchProvider] = useState<'none' | 'free_public' | 'searxng' | 'ollama_web' | 'auto'>(initialSearchProvider || 'free_public');
  const [searxngUrl, setSearxngUrl] = useState<string>(initialSearxngUrl || 'http://127.0.0.1:8080');
  const [ollamaApiKey, setOllamaApiKey] = useState<string>(initialOllamaApiKey || '');
  const [testingSearch, setTestingSearch] = useState<boolean>(false);
  const [searchTestStatus, setSearchTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Sync settings when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialEndpoint) setCustomEndpoint(initialEndpoint);
      if (initialModel) setSelectedModel(initialModel);
      if (initialSearchProvider) setSearchProvider(initialSearchProvider);
      if (initialSearxngUrl) setSearxngUrl(initialSearxngUrl);
      if (initialOllamaApiKey) setOllamaApiKey(initialOllamaApiKey);
    }
  }, [isOpen, initialEndpoint, initialModel, initialSearchProvider, initialSearxngUrl, initialOllamaApiKey]);

  const [loading, setLoading] = useState<boolean>(false);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [citations, setCitations] = useState<SearchCitation[]>([]);
  const [copied, setCopied] = useState<boolean>(false);

  // Check Ollama and Search connection on open
  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/ollama/status?endpoint=${encodeURIComponent(customEndpoint)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OllamaStatus = await res.json();
      setStatus(data);
      if (data.selectedModel) {
        setSelectedModel(data.selectedModel);
      }
    } catch {
      setStatus(prev => ({ ...prev, connected: false, error: 'Falha ao verificar Ollama' }));
    }
  };

  const handleTestSearch = async () => {
    if (searchProvider === 'none') {
      setSearchTestStatus({
        success: true,
        message: 'Modo 100% Offline selecionado. Nenhuma conexão com a internet necessária.'
      });
      return;
    }

    setTestingSearch(true);
    setSearchTestStatus(null);
    try {
      const testQuery = processItem?.name || "windows svchost.exe security service";
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testQuery,
          provider: searchProvider,
          searxngUrl,
          ollamaApiKey
        })
      });
      
      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Servidor retornou resposta inesperada.');
      }

      if (data.success && data.results?.length > 0) {
        const providerName = 
          data.provider === 'searxng' ? 'SearXNG Local' : 
          data.provider === 'free_public' ? 'Busca Gratuita (DuckDuckGo / Wiki)' : 
          data.provider === 'ollama_web' ? 'Ollama Web API' : 'Busca Web';

        setSearchTestStatus({
          success: true,
          message: `Busca OK! ${data.results.length} resultados obtidos via ${providerName}.`
        });
      } else {
        setSearchTestStatus({
          success: false,
          message: data.error || 'Nenhum resultado retornado. Recomendamos usar o Modo 100% Offline ou Busca Gratuita.'
        });
      }
    } catch (err: any) {
      setSearchTestStatus({
        success: false,
        message: `Erro ao testar busca: ${err.message}`
      });
    } finally {
      setTestingSearch(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      runAnalysis();
    }
  }, [isOpen, page, processItem?.pid]);

  const runAnalysis = async () => {
    setLoading(true);
    setAnalysisText('');
    setCitations([]);
    setShowSettings(false); // Collapse settings automatically so the full analysis is immediately visible
    try {
      // Build lightweight and focused context payload for Ollama
      let payloadContext: any = processItem || contextData;
      if (page === 'processes' && contextData) {
        payloadContext = {
          total: contextData.total,
          usedMemMb: contextData.usedMemMb,
          totalMemMb: contextData.totalMemMb,
          memPercent: contextData.memPercent,
          topCpu: (contextData.topCpu || []).slice(0, 8),
          topMem: (contextData.topMem || []).slice(0, 8)
        };
      } else if (page === 'process_explain' && processItem) {
        payloadContext = {
          name: processItem.name,
          pid: processItem.pid,
          cpu: processItem.cpu,
          memMb: processItem.memMb,
          mem: processItem.mem,
          category: processItem.category,
          isCritical: processItem.isCritical
        };
      }

      const res = await fetch('/api/ollama/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          contextData: payloadContext,
          endpoint: customEndpoint,
          model: selectedModel,
          useWebSearch: searchProvider !== 'none',
          searchProvider,
          searxngUrl,
          ollamaApiKey
        })
      });

      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = {
          text: `Resposta recebida do assistente:\n\n${rawText.slice(0, 500)}`,
          modelUsed: selectedModel,
          isOfflineFallback: true
        };
      }

      if (data.error && !data.text) {
        setAnalysisText(`Erro ao processar: ${data.error}`);
      } else {
        setAnalysisText(data.text || 'Diagnóstico gerado com sucesso.');
      }
      setModelUsed(data.modelUsed || selectedModel);
      setIsFallback(!!data.isOfflineFallback);
      if (data.searchResults) {
        setCitations(data.searchResults);
      }
    } catch (err: any) {
      setAnalysisText(`Erro ao gerar análise com Ollama: ${err.message || 'Falha de comunicação'}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysisText) return;
    navigator.clipboard.writeText(analysisText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl max-w-3xl w-full border border-black/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-zinc-900">
                    {page === 'process_explain' && processItem 
                      ? `Explicador de Processo: ${processItem.name}` 
                      : `Análise com IA Local (Ollama) - ${pageTitle}`}
                  </h3>
                  {searchProvider !== 'none' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      <Globe className="w-3 h-3 text-blue-600" />
                      {searchProvider === 'searxng' ? 'SearXNG Local' : searchProvider === 'ollama_web' ? 'Ollama Web API' : 'Web Grounding'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      100% Offline / Privado
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Processamento direto via Ollama API {searchProvider !== 'none' ? 'com enriquecimento web' : 'totalmente isolado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                  showSettings ? 'bg-zinc-200 text-zinc-800' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
                title="Configurações do Ollama Local e Busca"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configurações & Busca</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Collapsible Ollama & Search Settings */}
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-5 bg-zinc-100 border-b border-zinc-200 space-y-4 text-xs overflow-y-auto max-h-[300px]"
            >
              {/* Ollama Section */}
              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${status.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className="font-bold text-zinc-800">
                      Ollama Local: {status.connected ? 'Conectado' : 'Offline / Base Local Ativa'}
                    </span>
                  </div>
                  <button
                    onClick={checkStatus}
                    className="px-2.5 py-1 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 font-semibold rounded-lg border border-zinc-200 transition flex items-center gap-1 text-[11px]"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Testar Ollama
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                      Endpoint Ollama:
                    </label>
                    <input
                      type="text"
                      value={customEndpoint}
                      onChange={(e) => setCustomEndpoint(e.target.value)}
                      placeholder="http://127.0.0.1:11434"
                      className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                      Modelo Local:
                    </label>
                    {status.models && status.models.length > 0 ? (
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {status.models.map(m => (
                          <option key={m.name} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        placeholder="llama3.2, mistral, deepseek-r1..."
                        className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Web Search Section */}
              <div className="bg-white p-3.5 rounded-2xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-zinc-800">Enriquecimento com Busca na Web (Opcional)</span>
                  </div>

                  <button
                    onClick={handleTestSearch}
                    disabled={testingSearch}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg border border-blue-200 transition flex items-center gap-1 text-[11px] disabled:opacity-50"
                  >
                    <Search className={`w-3 h-3 ${testingSearch ? 'animate-spin' : ''}`} />
                    Testar Seleção
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSearchProvider('none')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      searchProvider === 'none' 
                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-bold shadow-sm' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <span className="text-[11px] font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      🔒 100% Offline
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal mt-0.5">Padrão • Sem API e sem internet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchProvider('free_public')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      searchProvider === 'free_public' 
                        ? 'border-blue-500 bg-blue-50/60 text-blue-950 font-bold shadow-sm' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <span className="text-[11px] font-bold flex items-center gap-1">
                      <Globe className="w-3 h-3 text-blue-600" />
                      🌐 Busca Gratuita
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal mt-0.5">DuckDuckGo • Zero configuração</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchProvider('searxng')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      searchProvider === 'searxng' 
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-950 font-bold shadow-sm' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <span className="text-[11px] font-bold flex items-center gap-1">
                      <Server className="w-3 h-3 text-indigo-600" />
                      ⚡ SearXNG Local
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal mt-0.5">Docker no PC (127.0.0.1:8080)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchProvider('ollama_web')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      searchProvider === 'ollama_web' 
                        ? 'border-purple-500 bg-purple-50/60 text-purple-950 font-bold shadow-sm' 
                        : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <span className="text-[11px] font-bold flex items-center gap-1">
                      <Key className="w-3 h-3 text-purple-600" />
                      🔑 Ollama Web API
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal mt-0.5">Requer Chave de API</span>
                  </button>
                </div>

                {searchProvider === 'searxng' && (
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                    <label className="block text-[10px] font-bold text-zinc-700 flex items-center gap-1">
                      <Server className="w-3 h-3 text-indigo-600" />
                      Endereço do SearXNG Local:
                    </label>
                    <input
                      type="text"
                      value={searxngUrl}
                      onChange={(e) => setSearxngUrl(e.target.value)}
                      placeholder="http://127.0.0.1:8080"
                      className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Como rodar o SearXNG no seu PC com Docker: <code className="bg-zinc-200 px-1 py-0.5 rounded font-mono">docker run -d -p 8080:8080 searxng/searxng</code>
                    </p>
                  </div>
                )}

                {searchProvider === 'ollama_web' && (
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                    <label className="block text-[10px] font-bold text-zinc-700 flex items-center gap-1">
                      <Key className="w-3 h-3 text-purple-600" />
                      Chave de API do Ollama (Bearer Token):
                    </label>
                    <input
                      type="password"
                      value={ollamaApiKey}
                      onChange={(e) => setOllamaApiKey(e.target.value)}
                      placeholder="Insira sua chave obtida no site do Ollama"
                      className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800"
                    />
                  </div>
                )}

                {searchProvider === 'free_public' && (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900">
                    💡 <strong>Pronto para usar:</strong> Pesquisa dados técnicos diretamente em enciclopédias e bases públicas sem necessidade de chave de API ou instalação de servidores extras.
                  </div>
                )}

                {searchProvider === 'none' && (
                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900">
                    ✨ <strong>Modo Privado Puro:</strong> Todo o raciocínio é feito exclusivamente na CPU/GPU do seu computador pelo Ollama. Zero pacotes saem da sua rede.
                  </div>
                )}

                {searchTestStatus && (
                  <div className={`p-2.5 rounded-xl border text-[11px] ${
                    searchTestStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {searchTestStatus.message}
                  </div>
                )}
              </div>

              {!status.connected && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-amber-700" />
                    Como iniciar o Ollama no seu PC:
                  </p>
                  <p>
                    Abra o seu terminal e execute: <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-bold">ollama run llama3.2</code> ou <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-bold">ollama serve</code>.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Analysis Body */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <div className="relative w-12 h-12 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping opacity-75" />
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                </div>
                <p className="text-sm font-bold text-zinc-800">
                  Processando com modelo Ollama ({selectedModel}) {searchProvider !== 'none' ? '+ Busca Web' : ''}...
                </p>
                <p className="text-xs text-zinc-400">
                  {searchProvider !== 'none' 
                    ? 'Pesquisando informações e sintetizando diagnóstico...'
                    : 'Analisando dados em tempo real 100% offline.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Model badge and search indicators */}
                <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-zinc-400">Motor:</span>
                    <span className="font-mono font-bold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-lg">
                      {modelUsed || selectedModel}
                    </span>
                    {citations.length > 0 && (
                      <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                        <Globe className="w-3 h-3 text-blue-600" />
                        {citations.length} fontes consultadas
                      </span>
                    )}
                    {isFallback && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-semibold">
                        Base Local Offline
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-zinc-100 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar Resumo'}
                  </button>
                </div>

                {/* Markdown Content */}
                <div className="prose prose-sm max-w-none text-zinc-700 space-y-3 leading-relaxed text-xs sm:text-sm">
                  <ReactMarkdown
                    components={{
                      h3: ({ node, ...props }) => <h3 className="text-base font-bold text-zinc-900 mt-4 mb-2 flex items-center gap-2" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-bold text-zinc-900" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1.5 text-zinc-700" {...props} />,
                      li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                      code: ({ node, ...props }) => <code className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-indigo-600 text-xs" {...props} />,
                      a: ({ node, ...props }) => <a className="text-indigo-600 underline font-semibold hover:text-indigo-800" target="_blank" rel="noreferrer" {...props} />
                    }}
                  >
                    {analysisText}
                  </ReactMarkdown>
                </div>

                {/* Citations Box */}
                {citations.length > 0 && (
                  <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-2">
                    <p className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-600" />
                      Fontes Pesquisadas na Web (Grounding):
                    </p>
                    <div className="space-y-1.5">
                      {citations.map((c, i) => (
                        <div key={i} className="text-xs bg-white p-2.5 rounded-xl border border-zinc-100 flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-zinc-800">{c.title}</span>
                            <p className="text-[11px] text-zinc-500 line-clamp-1">{c.content}</p>
                          </div>
                          {c.url && (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded shrink-0"
                              title="Abrir link original"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-zinc-400">
              {searchProvider !== 'none' ? 'Busca enriquecida via SearXNG / Ollama' : 'Privacidade total • 100% no seu PC'}
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Reanalisar
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-xl text-xs font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

