import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.isConnected = true;
    this.client.on('connect', () => {
      this.isConnected = true;
    });
    this.client.on('error', (err) => {
      console.log(`Redis client not connected to the server: ${err}`);
      this.isConnected = false;
    });
  }

  isAlive() {
    return this.isConnected;
  }

  async get(str) {
    const getVal = promisify(this.client.get).bind(this.client);
    const val = await getVal(str);
    return val;
  }

  async set(key, val, exp) {
    const setVal = promisify(this.client.set).bind(this.client);
    await setVal(key, val);
    await this.client.expire(key, exp);
  }

  async del(key) {
    const delVal = promisify(this.client.del).bind(this.client);
    await delVal(key);
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
