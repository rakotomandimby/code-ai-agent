import { Database } from 'sqlite3';
import Chunk from '../model/chunk';
import { MultiTurnChat } from '../model/multiturnchat';

export default class ChatGPTRepository {
  private db: Database;
  // Constructor
  constructor() {
    this.db = new Database('/tmp/chatgpt.sqlite');
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



  // Method to save the ChatGPT messages
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


  getSystemInstruction(){
    return new Promise<string>((resolve, reject) => {
      this.db.all('SELECT * FROM system_instruction ORDER BY id ASC', (err, rows:any) => {
        if (err) {
          console.log(err);
          reject('');
        } else {
          try{
            resolve(rows[0].content);
          } catch(error){
            console.log(error);
            console.log('there was an error retrieving the system instruction');
            resolve('there was an error retrieving the system instruction');
          }
        }
      });
    });
  }

  getModelToUse(){
    return new Promise<string>((resolve, reject) => {
      this.db.all('SELECT * FROM model_to_use ORDER BY id ASC', (err, rows:any) => {
        if (err) { 
          console.log(err);
          reject('');
        } else {
          try { resolve(rows[0].content); }
          catch(error){
            console.log(error);
            console.log('there was an error retrieving the model to use');
            resolve('there was an error retrieving the model to use');
          }
        }
      });
    });
  }

  getTemperature(){
    return new Promise<string>((resolve, reject) => {
      this.db.all('SELECT * FROM temperature ORDER BY id ASC', (err, rows:any) => {
        if (err) {
          console.log(err);
          reject('');
        } else {
          try { resolve(rows[0].content); }
          catch(error){
            console.log(error);
            console.log('there was an error retrieving the temperature');
            resolve('there was an error retrieving the temperature');
          }
        }
      });
    });
  }

  getTopP(){
    return new Promise<string>((resolve, reject) => {
      this.db.all('SELECT * FROM top_p ORDER BY id ASC', (err, rows:any) => {
        if (err) {
          console.log(err);
          reject('');
        } else {
          try { resolve(rows[0].content); }
          catch(error){
            console.log(error);
            console.log('there was an error retrieving the top_p');
            resolve('there was an error retrieving the top_p');
          }
        }
      });
    });
  }

  getMultiTurnChat(){
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


  close() {
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
