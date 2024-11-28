export class Chunk {
  kind: string;
  id: number;
  role: string;
  content: string;
  constructor(kind: string, id: number, role: string, content: string) {
    if (kind === 'message' || kind === 'system_instruction') {
      this.kind = kind;
      this.role = role;
      this.content = this.escapeSingleQuotes(content);
      this.id = id;
    } else {
      this.kind = kind;
      this.role = '';
      this.content = content,
      this.id = id;
    }
  }
  private escapeSingleQuotes(content: string) {
    return content.replace(/'/g, "''");
  }
}
