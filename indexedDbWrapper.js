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
                const objectStore = transaction.objectStore(this.storeName);
    
                transaction.oncomplete = () => {
                    console.log("Transaction complete");
                    resolve();
                };
    
                transaction.onerror = (event) => {
                    console.error("Transaction error:", event.target.errorCode);
                    reject("Error performing transaction: " + event.target.errorCode); // Reject if error
                };
    
                await callback(objectStore);
    
            } catch (error) {
                console.error("Error in addToQueue:", error);
                reject(error);
            }
        });
    }


    async read(key) {
        return new Promise((resolve, reject) => {
            this.addToQueue(async (objectStore) => {
                try {
                    const request = objectStore.get(key);  // Perform the get operation using the key
    
                    request.onsuccess = (event) => {
                        const result = event.target.result;
                        console.log("Read operation successful:", result);
                        resolve(result);  // Resolve with the result of the read operation
                    };
    
                    request.onerror = (event) => {
                        console.error("Error reading from database:", event.target.errorCode);
                        reject("Error reading from database");  // Reject if there's an error
                    };
    
                } catch (error) {
                    console.error("Error in read:", error);
                    reject(error);  // Reject the promise if there's an error
                }
            });
        });
    }


    async write(key, data) {
        return new Promise((resolve, reject) => {
            this.addToQueue(async (objectStore) => {
                try {
                    const request = objectStore.put(data, key);
    
                    request.onsuccess = () => {
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
