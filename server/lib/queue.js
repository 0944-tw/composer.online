class Queue {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
    }
  
    add(task) {
      this.queue.push(task);
      if (!this.isProcessing) {
        this.processQueue();
      }
    }
  
    async processQueue() {
      this.isProcessing = true;
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        await task();
      }
      this.isProcessing = false;
    }
  }
  
  module.exports = Queue;