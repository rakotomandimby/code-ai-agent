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
      this.db.serialize(() => {  // <-- Key change: Use serialize
        this.db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER , role TEXT, content TEXT)');
        this.db.run('CREATE TABLE IF NOT EXISTS system_instruction (id INTEGER , content TEXT)');
        this.db.run('CREATE TABLE IF NOT EXISTS model_to_use (id INTEGER , content TEXT)');
        this.db.run('CREATE TABLE IF NOT EXISTS temperature (id INTEGER , content TEXT)');
        this.db.run('CREATE TABLE IF NOT EXISTS top_p (id INTEGER , content TEXT)');
        this.db.run('DELETE FROM messages');
        this.db.run('DELETE FROM system_instruction');
        this.db.run('DELETE FROM model_to_use');
        this.db.run('DELETE FROM temperature');
        this.db.run('DELETE FROM top_p', (err) => { // Callback for the last operation
          if (err) {
            reject(err); // Reject if there's an error
          } else {
            resolve(); // Resolve when done
          }
        });
      });
    });
  }


  // Method to save the ChatGPT messages
  save(data: Chunk) {
    if (data.kind === 'message') {
      this.db.exec(`INSERT INTO messages (id, role, content) VALUES (${data.id}, '${data.role}', '${data.content}')`);
    }
    if (data.kind === 'system_instruction') {
      this.db.exec(`INSERT INTO system_instruction (id, content) VALUES (${data.id}, '${data.content}')`);
    }
    if (data.kind === 'model_to_use') {
      this.db.exec(`INSERT INTO model_to_use (id, content) VALUES (${data.id}, '${data.content}')`);
    }
    if (data.kind === 'temperature') {
      this.db.exec(`INSERT INTO temperature (id, content) VALUES (${data.id}, '${data.content}')`);
    }
    if (data.kind === 'top_p') {
      this.db.exec(`INSERT INTO top_p (id, content) VALUES (${data.id}, '${data.content}')`);
    }
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
  init() {
    this.db.exec('CREATE TABLE IF NOT EXISTS messages (id INTEGER , role TEXT, content TEXT)');
    this.db.exec('CREATE TABLE IF NOT EXISTS system_instruction (id INTEGER , content TEXT)');
    this.db.exec('CREATE TABLE IF NOT EXISTS model_to_use (id INTEGER , content TEXT)');
    this.db.exec('CREATE TABLE IF NOT EXISTS temperature (id INTEGER , content TEXT)');
    this.db.exec('CREATE TABLE IF NOT EXISTS top_p (id INTEGER , content TEXT)');
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
