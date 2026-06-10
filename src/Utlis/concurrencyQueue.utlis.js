class ConcurrencyQueue {
  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency;
    this.runningCount = 0;
    this.waitingQueue = []; 
  }

  async run(task) {
    if (this.runningCount >= this.maxConcurrency) {
      console.log(
        `⏳ Queue Full (${this.runningCount}/${this.maxConcurrency}). Task added to waiting queue...`,
      );
      await new Promise((resolve) => this.waitingQueue.push(resolve));
    }

    this.runningCount++;
    try {
      return await task(); 
    } finally {
      this.runningCount--; 

      if (this.waitingQueue.length > 0) {
        const nextTaskResolver = this.waitingQueue.shift();
        nextTaskResolver(); 
      }
    }
  }
}

export const examPdfQueue = new ConcurrencyQueue(3);
