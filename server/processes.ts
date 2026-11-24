import si from "systeminformation";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ProcessItem {
  pid: number;
  parentPid: number;
  name: string;
  cpu: number; // %
  mem: number; // %
  memRss: number; // KB
  memMb: number; // MB
  user: string;
  state: string;
  command: string;
  category: 'Navegador' | 'Desenvolvimento' | 'Jogos' | 'Comunicação' | 'Multimídia' | 'Sistema' | 'Aplicativo';
  isCritical: boolean; // Protected system process
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

const CRITICAL_SYSTEM_PROCESSES = new Set([
  'system', 'system idle process', 'registry', 'smss.exe', 'csrss.exe', 
  'wininit.exe', 'services.exe', 'lsass.exe', 'winlogon.exe', 'fontdrvhost.exe',
  'dwm.exe', 'kernel', 'launchd', 'systemd', 'init', 'kthreadd'
]);

function categorizeProcess(name: string): { category: ProcessItem['category']; isCritical: boolean } {
  const lower = (name || '').toLowerCase().trim();

  if (CRITICAL_SYSTEM_PROCESSES.has(lower) || CRITICAL_SYSTEM_PROCESSES.has(lower.replace('.exe', ''))) {
    return { category: 'Sistema', isCritical: true };
  }

  if (lower.includes('svchost') || lower.includes('spoolsv') || lower.includes('taskhost') || lower.includes('explorer')) {
    return { category: 'Sistema', isCritical: lower !== 'explorer.exe' };
  }

  // Browsers
  if (lower.includes('chrome') || lower.includes('edge') || lower.includes('msedge') || lower.includes('firefox') || lower.includes('brave') || lower.includes('opera') || lower.includes('safari') || lower.includes('vivaldi')) {
    return { category: 'Navegador', isCritical: false };
  }

  // Dev
  if (lower.includes('code') || lower.includes('node') || lower.includes('git') || lower.includes('python') || lower.includes('java') || lower.includes('docker') || lower.includes('powershell') || lower.includes('cmd.exe') || lower.includes('terminal') || lower.includes('idea') || lower.includes('vsls')) {
    return { category: 'Desenvolvimento', isCritical: false };
  }

  // Games
  if (lower.includes('steam') || lower.includes('epicgames') || lower.includes('riot') || lower.includes('gta') || lower.includes('valorant') || lower.includes('cs2') || lower.includes('minecraft') || lower.includes('origin') || lower.includes('battle.net') || lower.includes('unity') || lower.includes('unreal')) {
    return { category: 'Jogos', isCritical: false };
  }

  // Communication & Media
  if (lower.includes('discord') || lower.includes('slack') || lower.includes('teams') || lower.includes('telegram') || lower.includes('whatsapp') || lower.includes('zoom')) {
    return { category: 'Comunicação', isCritical: false };
  }

  if (lower.includes('spotify') || lower.includes('obs') || lower.includes('vlc') || lower.includes('premiere') || lower.includes('photoshop') || lower.includes('afterfx') || lower.includes('audacity') || lower.includes('media')) {
    return { category: 'Multimídia', isCritical: false };
  }

  return { category: 'Aplicativo', isCritical: false };
}

let cachedProcessData: ProcessStatsResponse | null = null;
let lastProcessFetchTime = 0;

export async function getProcessesData(force = false): Promise<ProcessStatsResponse> {
  const now = Date.now();
  if (cachedProcessData && !force && (now - lastProcessFetchTime < 1500)) {
    return cachedProcessData;
  }

  try {
    const [procData, memData] = await Promise.all([
      si.processes(),
      si.mem()
    ]);

    const totalMemMb = Math.round(memData.total / (1024 * 1024));
    const usedMemMb = Math.round(memData.active / (1024 * 1024));
    const memPercent = Math.round((usedMemMb / totalMemMb) * 100);

    const items: ProcessItem[] = procData.list.map(p => {
      const { category, isCritical } = categorizeProcess(p.name);
      // systeminformation returns memRss in KB on most platforms, but in Bytes on some Windows WMI queries.
      // If memRss is larger than total system memory in KB, it is in Bytes.
      const rawRss = p.memRss || 0;
      let memMb = 0;
      if (rawRss > (totalMemMb * 1024)) {
        memMb = Math.round(rawRss / (1024 * 1024));
      } else {
        memMb = Math.round(rawRss / 1024);
      }
      const cpu = Math.round(p.cpu * 10) / 10;
      const mem = Math.round(p.mem * 10) / 10;

      let statusAlert: ProcessItem['statusAlert'] = 'normal';
      if (cpu > 25) statusAlert = 'high_cpu';
      else if (memMb > 1500 || mem > 20) statusAlert = 'high_ram';

      return {
        pid: p.pid,
        parentPid: p.parentPid,
        name: p.name || 'Processo Desconhecido',
        cpu: Math.max(0, cpu),
        mem: Math.max(0, mem),
        memRss: p.memRss,
        memMb: memMb,
        user: p.user || 'SYSTEM',
        state: p.state || 'running',
        command: p.command || p.name,
        category,
        isCritical,
        statusAlert
      };
    });

    // Top CPU
    const topCpu = [...items]
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 10);

    // Top RAM
    const topMem = [...items]
      .sort((a, b) => b.memMb - a.memMb)
      .slice(0, 10);

    // All sorted by CPU by default
    const allSorted = [...items].sort((a, b) => b.cpu - a.cpu);

    cachedProcessData = {
      total: procData.all || items.length,
      running: procData.running || items.filter(i => i.state === 'running').length,
      blocked: procData.blocked || 0,
      sleeping: procData.sleeping || items.filter(i => i.state === 'sleeping').length,
      topCpu,
      topMem,
      all: allSorted,
      timestamp: new Date().toISOString(),
      totalMemMb,
      usedMemMb,
      memPercent
    };
    lastProcessFetchTime = now;

    return cachedProcessData;
  } catch (error) {
    console.error("Error fetching process list:", error);
    // Return safe fallback
    return cachedProcessData || {
      total: 0,
      running: 0,
      blocked: 0,
      sleeping: 0,
      topCpu: [],
      topMem: [],
      all: [],
      timestamp: new Date().toISOString(),
      totalMemMb: 16384,
      usedMemMb: 8192,
      memPercent: 50
    };
  }
}

export async function killProcess(pid: number): Promise<{ success: boolean; message: string }> {
  if (pid === 0 || pid === 4 || pid === 1 || pid < 0) {
    return { success: false, message: "Não é permitido encerrar o processo raiz ou de sistema do kernel." };
  }

  // Safety check on process list
  const current = await getProcessesData(true);
  const target = current.all.find(p => p.pid === pid);
  if (target && target.isCritical) {
    return { success: false, message: `O processo "${target.name}" é um serviço crítico do Windows e não pode ser encerrado.` };
  }

  const osInfo = await si.osInfo();
  const isWindows = osInfo.platform === 'win32';

  try {
    if (isWindows) {
      await execAsync(`taskkill /PID ${pid} /T /F`, { timeout: 3000 });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    // Invalidate cache immediately
    cachedProcessData = null;
    return { success: true, message: `Processo PID ${pid} (${target?.name || ''}) encerrado com sucesso!` };
  } catch (err: any) {
    const errorText = err.message || '';
    if (errorText.toLowerCase().includes('acesso negado') || errorText.toLowerCase().includes('access is denied')) {
      return { 
        success: false, 
        message: `Acesso Negado: O terminal do Node.js precisa ser executado como Administrador para finalizar o processo "${target?.name || pid}".` 
      };
    }
    return { success: false, message: `Falha ao encerrar PID ${pid}: ${errorText || 'Acesso negado'}` };
  }
}
