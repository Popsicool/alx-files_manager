import { MongoClient } from 'mongodb';

const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || 27017;
const DATABASE = process.env.DB_DATABASE || 'files_manager';

class DBClient {
  constructor() {
    this.isConnected = false;
    this.Client = MongoClient(`mongodb://${HOST}:${PORT}`, { useUnifiedTopology: true, useNewUrlParser: true });
    this.Client.connect().then(() => {
      this.db = this.client.db(`${DATABASE}`);
      this.isConnected = true;
    }).catch((error) => {
      console.log(error);
    });
  }

  isAlive() {
    return this.isConnected;
  }

  async nbUsers() {
    const users = this.db.collection('users');
    const docsCount = await users.countDocuments();
    return docsCount;
  }

  async nbFiles() {
    const files = this.db.collection('files');
    const filesCount = await files.countDocuments();
    return filesCount;
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
