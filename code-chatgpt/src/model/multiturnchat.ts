export class MultiTurnChat {
  private rows: any;

  constructor() {
    this.rows = [];
  }

  getRows() {
    return this.rows;
  }

  appendUniquely(rows: any) {
    for (let i = 0; i < rows.length; i++) {
      if (this.rows.indexOf(rows[i]) === -1) {
        this.rows.push(rows[i]);
      }
    }
  }
}
