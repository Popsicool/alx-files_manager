import { createClient, print } from 'redis';

class RedisClient{
    constructor(){
        this.client = createClient();
        this.client.on('connect', () => console.log('Redis client connected to the server'));
        this.client.on('error', err => console.log(`Redis client not connected to the server: ${err}`));

    }
    isAlive(){
        if(this.client.connected){
            return true
        }
        return false
    }
    async get(str){
        const val = await this.client.get(str)
        return val
    }
}