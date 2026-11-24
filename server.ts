import express from "express";
import { createServer as createViteServer } from "vite";
import si from "systeminformation";
import db from "./db.ts";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

import { getDiskDrivesInfo, runDiskBenchmark, formatCrystalDiskReport } from "./server/disks.ts";
import { getBatteryData, generateBatteryReportHtml } from "./server/battery.ts";
import { getProcessesData, killProcess } from "./server/processes.ts";
import { checkOllamaConnection, generateOllamaResponse } from "./server/ollama.ts";
import { performWebSearch, searchWithSearXNG, searchWithOllamaWeb } from "./server/search.ts";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Cached GPU and hardware info to avoid heavy WMIC/PowerShell queries on every tick
  let cachedGpuInfo: any = null;
  let lastGpuCheck = 0;
  let lastStatsResult: any = null;
  let lastStatsTime = 0;

  // Cached Windows Updates to prevent COM search freezes
  let cachedPendingUpdates: number | null = null;
  let lastUpdatesCheck = 0;

  // Query NVIDIA-SMI directly for precise GPU metrics (temperature, utilization, VRAM)
  async function getNvidiaGpuStats(): Promise<{ temp: number; load: number; vramUsedMb: number; vramTotalMb: number; name?: string } | null> {
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=temperature.gpu,utilization.gpu,memory.used,memory.total,name --format=csv,noheader,nounits', { timeout: 1500 });
      if (stdout && stdout.trim()) {
        const parts = stdout.trim().split('\n')[0].split(',').map(s => s.trim());
        const temp = parseFloat(parts[0]) || 0;
        const load = parseFloat(parts[1]) || 0;
        const vramUsedMb = parseFloat(parts[2]) || 0;
        const vramTotalMb = parseFloat(parts[3]) || 0;
        const name = parts[4] || undefined;
        return { temp, load, vramUsedMb, vramTotalMb, name };
      }
    } catch {
      // nvidia-smi not available or non-NVIDIA system
    }
    return null;
  }

  // Query LibreHardwareMonitor / OpenHardwareMonitor / ACPI via WMI on Windows
  async function getWindowsCpuTempFallback(): Promise<number> {
    if (process.platform !== 'win32') return 0;
    try {
      const psCmd = `powershell -NoProfile -Command "try { (Get-CimInstance -Namespace 'root\\LibreHardwareMonitor' -ClassName Sensor -Filter \\"SensorType='Temperature' and (Name like '%CPU Package%' or Name like '%Package%' or Name like '%Core (Tctl/Tdie)%' or Name like '%CPU Total%')\\" -ErrorAction Stop | Select-Object -First 1).Value } catch { try { (Get-CimInstance -Namespace 'root\\OpenHardwareMonitor' -ClassName Sensor -Filter \\"SensorType='Temperature' and (Name like '%CPU Package%' or Name like '%Package%' or Name like '%CPU Total%')\\" -ErrorAction Stop | Select-Object -First 1).Value } catch { try { $t = (Get-CimInstance -Namespace 'root/wmi' -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1).CurrentTemperature; if ($t -gt 2732) { [math]::Round(($t - 2732) / 10, 1) } } catch {} } }"`;
      const { stdout } = await execAsync(psCmd, { timeout: 2500 });
      const val = parseFloat(stdout.trim());
      if (!isNaN(val) && val > 0 && val < 130) {
        return Math.round(val * 10) / 10;
      }
    } catch {
      // Ignore WMI fallback errors
    }
    return 0;
  }

  // Helper to get current stats (optimized for zero CPU overhead)
  async function getCurrentStats() {
    const now = Date.now();
    // Return cached stats if called within 1200ms
    if (lastStatsResult && (now - lastStatsTime < 1200)) {
      return lastStatsResult;
    }

    // Check direct NVIDIA-SMI metrics first for real GPU stats
    const nvidiaStats = await getNvidiaGpuStats();

    // Only query heavy graphics controller specs once every 60 seconds if not NVIDIA
    if (!nvidiaStats && (!cachedGpuInfo || now - lastGpuCheck > 60000)) {
      try {
        const graphics = await si.graphics();
        cachedGpuInfo = graphics.controllers.find(c => c.utilizationGpu !== undefined) || graphics.controllers[0] || null;
        lastGpuCheck = now;
      } catch {
        cachedGpuInfo = null;
      }
    }

    const [cpu, temp, mem] = await Promise.all([
      si.currentLoad(),
      si.cpuTemperature().catch(() => ({ main: 0, cores: [], max: 0 })),
      si.mem()
    ]);

    const gpu = cachedGpuInfo;

    // Robust CPU Temp detection
    let cpuTemp = temp.main || 0;
    if (cpuTemp === 0 && temp.cores && temp.cores.length > 0) {
      cpuTemp = Math.max(...temp.cores.filter((t: number) => t > 0));
    }
    if (cpuTemp === 0 && temp.max) {
      cpuTemp = temp.max;
    }

    // If still 0 and on Windows, attempt LibreHardwareMonitor / OpenHardwareMonitor / ACPI WMI
    if (cpuTemp === 0 && process.platform === 'win32') {
      cpuTemp = await getWindowsCpuTempFallback();
    }

    // Compute GPU metrics (using nvidia-smi if available, otherwise si.graphics)
    const gpuLoad = nvidiaStats ? nvidiaStats.load : (gpu?.utilizationGpu || 0);
    const gpuTemp = nvidiaStats ? nvidiaStats.temp : (gpu?.temperatureGpu || 0);
    const vramUsed = nvidiaStats ? (nvidiaStats.vramUsedMb * 1024 * 1024) : ((gpu?.memoryUsed || 0) * 1024 * 1024);
    const vramTotal = nvidiaStats ? (nvidiaStats.vramTotalMb * 1024 * 1024) : ((gpu?.memoryTotal || 0) * 1024 * 1024);
    const gpuModel = nvidiaStats?.name || gpu?.model || 'Desconhecido';

    lastStatsResult = {
      cpuLoad: Math.round(cpu.currentLoad * 10) / 10,
      cpuTemp: cpuTemp,
      gpuLoad: Math.round(gpuLoad * 10) / 10,
      gpuTemp: Math.round(gpuTemp * 10) / 10,
      memUsed: mem.active,
      memTotal: mem.total,
      vramUsed: vramUsed,
      vramTotal: vramTotal,
      gpuModel: gpuModel,
      timestamp: new Date().toISOString()
    };
    lastStatsTime = now;

    return lastStatsResult;
  }

  // Background collector
  let activeSessionId: number | null = null;
  let collectionInterval: NodeJS.Timeout | null = null;

  // Check if there's an active session on startup
  const activeSession = db.prepare('SELECT id FROM sessions WHERE is_active = 1 LIMIT 1').get() as { id: number } | undefined;
  if (activeSession) {
    activeSessionId = activeSession.id;
    startCollection();
  }

  function startCollection() {
    if (collectionInterval) clearInterval(collectionInterval);
    collectionInterval = setInterval(async () => {
      if (activeSessionId) {
        try {
          const stats = await getCurrentStats();
          db.prepare(`
            INSERT INTO data_points (session_id, cpu_load, cpu_temp, gpu_load, gpu_temp, mem_used, mem_total, vram_used, vram_total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            activeSessionId, 
            stats.cpuLoad, 
            stats.cpuTemp, 
            stats.gpuLoad, 
            stats.gpuTemp, 
            stats.memUsed, 
            stats.memTotal,
            stats.vramUsed,
            stats.vramTotal
          );
          console.log(`[Diagnostic] Data point saved for session ${activeSessionId}`);
        } catch (err) {
          console.error("Error collecting stats:", err);
        }
      }
    }, 60000); // Every minute
  }

  // API Routes
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await getCurrentStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.post("/api/sessions/start", async (req, res) => {
    const { name } = req.body;
    if (activeSessionId) {
      return res.status(400).json({ error: "A session is already active" });
    }

    const result = db.prepare('INSERT INTO sessions (name) VALUES (?)').run(name || `Sessão ${new Date().toLocaleString()}`);
    activeSessionId = Number(result.lastInsertRowid);
    startCollection();
    
    // Initial data point
    try {
      const stats = await getCurrentStats();
      db.prepare(`
        INSERT INTO data_points (session_id, cpu_load, cpu_temp, gpu_load, gpu_temp, mem_used, mem_total, vram_used, vram_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        activeSessionId, 
        stats.cpuLoad, 
        stats.cpuTemp, 
        stats.gpuLoad, 
        stats.gpuTemp, 
        stats.memUsed, 
        stats.memTotal,
        stats.vramUsed,
        stats.vramTotal
      );
    } catch (err) {
      console.error("Error saving initial data point:", err);
    }

    res.json({ id: activeSessionId, name });
  });

  app.post("/api/sessions/stop", (req, res) => {
    if (!activeSessionId) {
      return res.status(400).json({ error: "No active session" });
    }

    db.prepare('UPDATE sessions SET is_active = 0, end_time = CURRENT_TIMESTAMP WHERE id = ?').run(activeSessionId);
    if (collectionInterval) clearInterval(collectionInterval);
    const id = activeSessionId;
    activeSessionId = null;
    res.json({ message: "Session stopped", id });
  });

  app.get("/api/sessions", (req, res) => {
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY start_time DESC').all();
    res.json(sessions);
  });

  app.get("/api/sessions/:id", (req, res) => {
    try {
      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      
      const dataPoints = db.prepare('SELECT * FROM data_points WHERE session_id = ? ORDER BY timestamp ASC').all(req.params.id);
      res.json({ ...session, dataPoints });
    } catch (err) {
      console.error("Error fetching session details:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/sessions/:id", (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
    res.json({ message: "Session deleted" });
  });

  app.get("/api/updates", async (req, res) => {
    try {
      const [os, bios, graphics] = await Promise.all([
        si.osInfo(),
        si.bios(),
        si.graphics()
      ]);

      let pendingUpdates = cachedPendingUpdates !== null ? cachedPendingUpdates : 0;
      let updateError = null;

      // Try to check for Windows updates if on Windows (with 5-min cache and defensive timeout)
      const now = Date.now();
      if (os.platform === 'win32') {
        if (cachedPendingUpdates !== null && (now - lastUpdatesCheck < 300000)) {
          pendingUpdates = cachedPendingUpdates;
        } else {
          try {
            const { stdout } = await execAsync('powershell -NoProfile -Command "(New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search(\'IsInstalled=0 and Type=\\\'Software\\\' and IsHidden=0\').Updates.Count"', { timeout: 4000 });
            pendingUpdates = parseInt(stdout.trim()) || 0;
            cachedPendingUpdates = pendingUpdates;
            lastUpdatesCheck = now;
          } catch (e) {
            if (cachedPendingUpdates === null) {
              updateError = "Serviço de atualizações do Windows ocupado ou verificação em segundo plano.";
            } else {
              pendingUpdates = cachedPendingUpdates;
            }
          }
        }
      }

      res.json({
        os: {
          distro: os.distro,
          release: os.release,
          build: os.build,
          arch: os.arch
        },
        bios: {
          vendor: bios.vendor,
          version: bios.version,
          releaseDate: bios.releaseDate
        },
        gpu: graphics.controllers.map(c => ({
          model: c.model,
          driverVersion: c.driverVersion,
          vendor: c.vendor
        })),
        pendingUpdates,
        updateError
      });
    } catch (err) {
      console.error("Error fetching updates:", err);
      res.status(500).json({ error: "Failed to fetch update info" });
    }
  });

  // Rune Projects & Disks Diagnostic Routes
  app.get("/api/disks", async (req, res) => {
    try {
      const data = await getDiskDrivesInfo();
      res.json(data);
    } catch (err) {
      console.error("Error fetching disk info:", err);
      res.status(500).json({ error: "Failed to fetch disk health and SMART info" });
    }
  });

  app.post("/api/disks/benchmark", async (req, res) => {
    try {
      const { sizeMB } = req.body;
      const results = await runDiskBenchmark(sizeMB || 64);
      res.json(results);
    } catch (err) {
      console.error("Error running disk benchmark:", err);
      res.status(500).json({ error: "Failed to run disk benchmark" });
    }
  });

  app.get("/api/disks/:id/report", async (req, res) => {
    try {
      const data = await getDiskDrivesInfo();
      const disk = data.drives.find(d => d.id === req.params.id) || data.drives[0];
      if (!disk) return res.status(404).json({ error: "Disk not found" });
      const report = formatCrystalDiskReport(disk);
      res.type("text/plain").send(report);
    } catch (err) {
      console.error("Error generating report:", err);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // Battery & Power Diagnostics
  app.get("/api/battery", async (req, res) => {
    try {
      const data = await getBatteryData();
      res.json(data);
    } catch (err) {
      console.error("Error fetching battery data:", err);
      res.status(500).json({ error: "Failed to fetch battery diagnostics" });
    }
  });

  app.get("/api/battery/report", async (req, res) => {
    try {
      const data = await getBatteryData();
      const html = generateBatteryReportHtml(data);
      res.type("text/html").send(html);
    } catch (err) {
      console.error("Error generating battery report:", err);
      res.status(500).json({ error: "Failed to generate battery report" });
    }
  });

  // Top Resource Consuming Processes & Task Manager Pro
  app.get("/api/processes", async (req, res) => {
    try {
      const force = req.query.refresh === 'true';
      const data = await getProcessesData(force);
      res.json(data);
    } catch (err) {
      console.error("Error fetching process list:", err);
      res.status(500).json({ error: "Failed to fetch process manager data" });
    }
  });

  app.post("/api/processes/kill", async (req, res) => {
    try {
      const { pid } = req.body;
      if (!pid || typeof pid !== 'number') {
        return res.status(400).json({ error: "PID inválido fornecido" });
      }
      const result = await killProcess(pid);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err) {
      console.error("Error killing process:", err);
      res.status(500).json({ success: false, message: "Erro interno ao tentar encerrar processo" });
    }
  });

  // --- WEB SEARCH (SearXNG / Ollama Web Search API) ROUTES ---
  app.get("/api/search/status", (req, res) => {
    res.json({
      searxngUrl: process.env.SEARXNG_URL || 'http://127.0.0.1:8080',
      hasSearxng: !!process.env.SEARXNG_URL,
      hasOllamaKey: !!process.env.OLLAMA_API_KEY
    });
  });

  app.post("/api/search", async (req, res) => {
    try {
      const { query, provider, searxngUrl, ollamaApiKey } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: "Query é obrigatória" });
      }
      const results = await performWebSearch({
        query,
        provider: provider || 'auto',
        searxngUrl,
        ollamaApiKey
      });
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- OLLAMA LOCAL API ROUTES ---
  app.get("/api/ollama/status", async (req, res) => {
    try {
      const endpoint = (req.query.endpoint as string) || undefined;
      const status = await checkOllamaConnection(endpoint);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ connected: false, error: err.message });
    }
  });

  app.post("/api/ollama/analyze", async (req, res) => {
    try {
      const { 
        page, 
        contextData, 
        customPrompt, 
        endpoint, 
        model, 
        useWebSearch, 
        searchProvider = 'auto', 
        searxngUrl, 
        ollamaApiKey 
      } = req.body;

      let prompt = "";
      let searchQuery = "";
      let system = "Você é um engenheiro sênior de suporte e diagnóstico de computadores e hardware. Forneça respostas concisas, práticas e objetivas em português do Brasil com formatação Markdown limpa (títulos, marcadores e destaques em negrito).";

      if (page === 'diagnostic') {
        prompt = `Analise os seguintes dados de telemetria de hardware em tempo real:
${JSON.stringify(contextData, null, 2)}

Faça um resumo executivo cobrindo:
1. Saúde e estresse da CPU (temperatura e carga atual).
2. Uso e folga de Memória RAM.
3. Carga e temperatura da GPU.
4. Identificação de eventuais gargalos ou aquecimento excessivo e recomendações imediatas.`;
        searchQuery = `hardware diagnostic thermal throttling CPU GPU limits`;
      } else if (page === 'processes') {
        prompt = `Analise a seguinte lista de processos em execução no sistema operacional:
Total de Processos: ${contextData?.total}
Memória Utilizada: ${contextData?.usedMemMb} MB de ${contextData?.totalMemMb} MB (${contextData?.memPercent}%)
Top Consumidores de CPU:
${(contextData?.topCpu || []).map((p: any) => `- ${p.name} (PID ${p.pid}): CPU ${p.cpu}%, RAM ${p.memMb}MB [${p.category}]`).join('\n')}
Top Consumidores de Memória:
${(contextData?.topMem || []).map((p: any) => `- ${p.name} (PID ${p.pid}): RAM ${p.memMb}MB, CPU ${p.cpu}% [${p.category}]`).join('\n')}

Faça um resumo prático:
1. Identifique os maiores gastadores de recursos.
2. Destaque se há bloatware, processos duplicados ou navegadores acumulando muita memória.
3. Diga quais processos o usuário pode encerrar com segurança para deixar o PC mais rápido sem quebrar o Windows.`;
        searchQuery = `windows background processes optimization high cpu ram`;
      } else if (page === 'process_explain') {
        const proc = contextData;
        prompt = `O usuário não conhece o processo '${proc.name}' (PID: ${proc.pid}, Categoria: ${proc.category}, Uso de CPU: ${proc.cpu}%, RAM: ${proc.memMb}MB).

Por favor explique detalhadamente:
1. O que é esse executável (${proc.name}) e qual empresa/sistema o desenvolveu?
2. Para que serve exatamente e por que está rodando?
3. É seguro encerrar ou desinstalar? (Pode quebrar o Windows ou algum programa essencial?)
4. É vírus/malware comum com esse nome ou processo legítimo?`;
        searchQuery = `${proc.name} what is it windows process safe to end task`;
      } else if (page === 'disks') {
        prompt = `Analise os dados SMART e de saúde dos discos de armazenamento:
${JSON.stringify(contextData, null, 2)}

Faça um diagnóstico estilo técnico Rune Projects:
1. Avaliação geral de integridade (Saudável, Alerta ou Crítico).
2. Análise de desgaste, horas de uso e setores defeituosos (se houver).
3. Recomendações de backup ou troca preventiva.`;
        searchQuery = `SSD SMART health attributes bad sectors Rune Projects`;
      } else if (page === 'battery') {
        prompt = `Analise os dados de saúde da bateria e sistema de alimentação:
${JSON.stringify(contextData, null, 2)}

Faça uma análise especializada:
1. Nível de degradação das células (Capacidade de projeto vs Capacidade atual retida).
2. Avaliação da contagem de ciclos de carga.
3. Dicas personalizadas para prolongar a vida útil da bateria deste notebook.`;
        searchQuery = `laptop battery health cycle count degradation threshold`;
      } else if (page === 'history') {
        prompt = `Analise o histórico de diagnósticos de benchmark da máquina:
${JSON.stringify(contextData, null, 2)}

Resuma a evolução de estabilidade e score de desempenho ao longo do tempo.`;
      } else {
        prompt = customPrompt || "Faça uma análise geral de desempenho do computador.";
        searchQuery = customPrompt ? customPrompt.slice(0, 100) : "pc diagnostic support";
      }

      // If Web Search is enabled (or automatically requested), perform web grounding
      let searchResults = undefined;
      if (useWebSearch && searchQuery && searchProvider !== 'none') {
        try {
          const searchRes = await performWebSearch({
            query: searchQuery,
            provider: searchProvider,
            searxngUrl,
            ollamaApiKey
          });
          if (searchRes.success && searchRes.results.length > 0) {
            searchResults = searchRes.results;
          }
        } catch (searchErr: any) {
          console.warn("Web search grounding warning:", searchErr.message);
        }
      }

      const response = await generateOllamaResponse({
        endpoint,
        model: model || 'llama3.2',
        prompt,
        system,
        searchResults,
        searchProvider: searchProvider === 'searxng' ? 'SearXNG Local' : searchProvider === 'ollama_web' ? 'Ollama Web Search API' : 'Busca Web'
      });

      res.json(response);
    } catch (err: any) {
      console.error("Error running Ollama analysis:", err);
      res.status(500).json({ error: err.message || "Erro na análise com Ollama" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
