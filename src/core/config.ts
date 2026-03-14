import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import dotenv from 'dotenv';
import { AppConfig, APIConfig } from './types.js';

function findEnvFile(): string | null {
  const candidates = [
    join(process.cwd(), '.env'),
    join(homedir(), '.crux', '.env'),
    join(dirname(require.main?.filename || ''), '../../.env').replace(/\\/g, '/').split('/').filter(Boolean).join('/'),
  ];
  
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
}

const envPath = findEnvFile();
if (envPath) {
  dotenv.config({ path: envPath });
}

function getDefaultAPIConfig(): APIConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    stream: process.env.OPENAI_STREAM !== 'false',
  };
}

const DEFAULT_CONFIG: AppConfig = {
  dataDir: '.crux',
  sessionDir: 'sessions',
  configFile: 'config.json',
  api: getDefaultAPIConfig(),
};

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    const homeDir = homedir();
    const dataDir = process.env.CRUX_DATA_DIR || DEFAULT_CONFIG.dataDir;
    const configFile = process.env.CRUX_CONFIG_FILE || DEFAULT_CONFIG.configFile;

    this.configPath = join(homeDir, dataDir, configFile);
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    const configDir = dirname(this.configPath);

    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    if (existsSync(this.configPath)) {
      try {
        const fileContent = readFileSync(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        return { ...DEFAULT_CONFIG, ...fileConfig };
      } catch (error) {
        console.warn('Failed to load config, using defaults:', error);
      }
    }

    return { ...DEFAULT_CONFIG };
  }

  save(): void {
    const configDir = dirname(this.configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  get(): AppConfig {
    return this.config;
  }

  update(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.save();
  }

  updateAPI(updates: Partial<APIConfig>): void {
    this.config.api = { ...this.config.api, ...updates };
    this.save();
  }

  getSessionDir(): string {
    return join(dirname(this.configPath), this.config.sessionDir);
  }
}

export const configManager = new ConfigManager();