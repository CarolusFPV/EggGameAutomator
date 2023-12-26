class DatabaseHandler {
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.operationQueue = [];
        this.isQueueRunning = false;
    }

    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName);

            request.onerror = (event) => {
                console.error("Error opening database:", event.target.errorCode);
                reject("Error opening database");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Database opened successfully");
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log("Upgrade needed during database opening");
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                    console.log("Object store created");
                }
            };

            request.onblocked = (event) => {
                console.warn("Database access blocked. Please close all tabs with this site and try again.");
                reject("Database access blocked");
            };
        });
    }

    closeDatabase() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log("Database closed");
        }
    }

    async executeQueue() {
        this.isQueueRunning = true;
        try {
            if (!this.db) {
                await this.openDatabase();
            }

            while (this.operationQueue.length > 0) {
                const operationFunction = this.operationQueue.shift();

                await operationFunction();
            }
        } catch (error) {
            console.error("Error executing queue:", error);
        } finally {
            this.isQueueRunning = false;
            this.closeDatabase();
        }
    }

    async addToQueue(callback) {
        await this.queue;
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) {
                    await this.openDatabase();
                }

                const transaction = this.db.transaction([this.storeName], "readwrite");
                transaction.oncomplete = () => {
                    resolve();
                };
                transaction.onerror = (event) => {
                    reject("Error performing transaction: " + event.target.errorCode);
                };

                await callback(transaction, resolve, reject);
            } catch (error) {
                reject(error);
            } finally {
                this.closeDatabase();
            }
        });
    }

    async read(key) {
        return new Promise(async (resolve, reject) => {
            await this.addToQueue(async (transaction) => {
                try {
                    const objectStore = transaction.objectStore(this.storeName);

                    const request = objectStore.get(key);

                    request.onsuccess = (event) => {
                        const result = event.target.result;
                        console.log("Read operation successful:", result);
                        resolve(result);
                    };

                    request.onerror = (event) => {
                        console.error("Error reading from database:", event.target.errorCode);
                        reject("Error reading from database");
                    };
                } catch (error) {
                    console.error("Error in read:", error);
                    reject(error);
                }
            });
        });
    }

    async write(key, data) {
        return new Promise((resolve, reject) => {
            this.addToQueue(async (transaction) => {
                try {
                    const objectStore = transaction.objectStore(this.storeName);

                    const request = objectStore.put(data, key);

                    request.onsuccess = (event) => {
                        console.log("Write operation successful");
                        resolve();
                    };

                    request.onerror = (event) => {
                        console.error("Error writing to database:", event.target.errorCode);
                        reject("Error writing to database");
                    };
                } catch (error) {
                    console.error("Error in write:", error);
                    reject(error);
                }
            });
        });
    }
}
