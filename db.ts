import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'diagnostics.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS data_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_load REAL,
    cpu_temp REAL,
    gpu_load REAL,
    gpu_temp REAL,
    mem_used REAL,
    mem_total REAL,
    vram_used REAL,
    vram_total REAL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`);

// Migration for GPU columns (in case table already existed)
const tableInfo = db.prepare("PRAGMA table_info(data_points)").all() as any[];
const columns = tableInfo.map(c => c.name);

const migrations = [
  { name: 'gpu_load', type: 'REAL' },
  { name: 'gpu_temp', type: 'REAL' },
  { name: 'vram_used', type: 'REAL' },
  { name: 'vram_total', type: 'REAL' }
];

for (const m of migrations) {
  if (!columns.includes(m.name)) {
    try {
      db.exec(`ALTER TABLE data_points ADD COLUMN ${m.name} ${m.type}`);
      console.log(`[Migration] Added column ${m.name} to data_points`);
    } catch (e) {
      console.error(`[Migration] Failed to add column ${m.name}:`, e);
    }
  }
}

export default db;
