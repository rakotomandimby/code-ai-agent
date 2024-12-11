import { Database } from 'sqlite3';
import { Chunk } from '@code-ai-agent/lib';
import { MultiTurnChat } from '@code-ai-agent/lib';

export class BaseRepository {
  protected db: Database;
  protected dbName: string;

  constructor(dbName: string) {
    this.dbName = dbName;
    this.db = new Database(`/tmp/${dbName}.sqlite`);
  }


  clear(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER , role TEXT, content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS system_instruction (id INTEGER , content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS model_to_use (id INTEGER , content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS temperature (id INTEGER , content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS top_p (id INTEGER , content TEXT)')
          .run('DELETE FROM messages')
          .run('DELETE FROM system_instruction')
          .run('DELETE FROM model_to_use')
          .run('DELETE FROM temperature')
          .run('DELETE FROM top_p', (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
      });
    });
  }

  save(data: Chunk): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let sql = '';
      if (data.kind === 'message') {
        sql = `INSERT INTO messages (id, role, content) VALUES (${data.id}, '${data.role}', '${data.content}')`;
      } else if (data.kind === 'system_instruction') {
        sql = `INSERT INTO system_instruction (id, content) VALUES (${data.id}, '${data.content}')`;
      } else if (data.kind === 'model_to_use') {
        sql = `INSERT INTO model_to_use (id, content) VALUES (${data.id}, '${data.content}')`;
      } else if (data.kind === 'temperature') {
        sql = `INSERT INTO temperature (id, content) VALUES (${data.id}, '${data.content}')`;
      } else if (data.kind === 'top_p') {
        sql = `INSERT INTO top_p (id, content) VALUES (${data.id}, '${data.content}')`;
      }

      if (sql) {
        this.db.exec(sql, (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve(); // Resolve if no matching kind
      }
    });
  }

  protected getSetting(setting: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.db.all(`SELECT * FROM ${setting} ORDER BY id ASC`, (err, rows: any) => {
        if (err) {
          console.error(`Error retrieving ${setting}:`, err);
          reject('');
        } else {
          try {
            resolve(rows[0].content);
            console.log(`${this.dbName}, retrieved ${setting}:`, rows[0].content);
          } catch (error) {
            console.error(`Error parsing ${setting}:`, error);
            resolve(''); // Or handle the error as needed
          }
        }
      });
    });
  }

  getSystemInstruction(): Promise<string> { return this.getSetting('system_instruction'); }
  getModelToUse(): Promise<string> { return this.getSetting('model_to_use'); }
  getTemperature(): Promise<string> { return this.getSetting('temperature'); }
  getTopP(): Promise<string> { return this.getSetting('top_p'); }


  getMultiTurnChat(): Promise<MultiTurnChat>{
    return new Promise<MultiTurnChat>((resolve, reject) => {
      let c = new MultiTurnChat();
      this.db.all('SELECT * FROM messages ORDER BY id ASC', (err, rows) => {
        if (err) {
          console.log(err);
          reject(new MultiTurnChat());
        } else {
          c.appendUniquely(rows);
          resolve(c);
        }
      });
    });
  }


  init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER , role TEXT, content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS system_instruction (id INTEGER , content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS model_to_use (id INTEGER , content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS temperature (id INTEGER , content TEXT)')
          .run('CREATE TABLE IF NOT EXISTS top_p (id INTEGER , content TEXT)', (err) => { // Callback on the last operation
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
      });
    });
  }


  close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

}
