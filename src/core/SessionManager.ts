import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Session, SessionSummary, Message } from './types.js';
import { configManager } from './config.js';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export class SessionManager {
  private sessionDir: string;
  private currentSession: Session | null = null;

  constructor() {
    this.sessionDir = configManager.getSessionDir();
    this.ensureSessionDir();
  }

  private ensureSessionDir(): void {
    if (!existsSync(this.sessionDir)) {
      mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  private getSessionPath(id: string): string {
    return join(this.sessionDir, `${id}.json`);
  }

  create(name?: string): Session {
    const now = Date.now();
    const session: Session = {
      id: generateId(),
      name: name || `Session ${new Date().toLocaleString()}`,
      created_at: now,
      updated_at: now,
      messages: [],
    };
    this.saveSession(session);
    this.currentSession = session;
    return session;
  }

  load(id: string): Session | null {
    const path = this.getSessionPath(id);
    if (!existsSync(path)) {
      return null;
    }
    try {
      const content = readFileSync(path, 'utf-8');
      const session = JSON.parse(content) as Session;
      this.currentSession = session;
      return session;
    } catch {
      return null;
    }
  }

  saveSession(session: Session): void {
    session.updated_at = Date.now();
    const path = this.getSessionPath(session.id);
    writeFileSync(path, JSON.stringify(session, null, 2));
  }

  delete(id: string): boolean {
    const path = this.getSessionPath(id);
    if (existsSync(path)) {
      unlinkSync(path);
      if (this.currentSession?.id === id) {
        this.currentSession = null;
      }
      return true;
    }
    return false;
  }

  list(): SessionSummary[] {
    this.ensureSessionDir();
    const files = readdirSync(this.sessionDir).filter(f => f.endsWith('.json'));
    const sessions: SessionSummary[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(this.sessionDir, file), 'utf-8');
        const session = JSON.parse(content) as Session;
        const preview = session.messages.length > 0
          ? session.messages[session.messages.length - 1].content.substring(0, 50)
          : '(empty)';
        
        sessions.push({
          id: session.id,
          name: session.name,
          created_at: session.created_at,
          updated_at: session.updated_at,
          message_count: session.messages.length,
          preview,
        });
      } catch {
        // Skip invalid files
      }
    }

    return sessions.sort((a, b) => b.updated_at - a.updated_at);
  }

  getCurrent(): Session | null {
    return this.currentSession;
  }

  setCurrent(session: Session): void {
    this.currentSession = session;
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.load(sessionId);
    if (session) {
      session.messages.push(message);
      this.saveSession(session);
      if (this.currentSession?.id === sessionId) {
        this.currentSession = session;
      }
    }
  }

  rename(id: string, name: string): boolean {
    const session = this.load(id);
    if (session) {
      session.name = name;
      this.saveSession(session);
      return true;
    }
    return false;
  }
}

export const sessionManager = new SessionManager();