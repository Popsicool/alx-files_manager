import sha1 from 'sha1';
import { ObjectID } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');
class UsersController {
  static async postNew(req, res) {
    const { email } = req.body;
    const { password } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }
    const user = await dbClient.db.collection('users').findOne({ email });
    if (user) {
      res.status(400).json({ error: 'Already exist' });
      return;
    }
    const passwordHash = sha1(password);
    await dbClient.db.collection('users').insertOne({ email, password: passwordHash })
      .then((result) => {
        userQueue.add({ userId: result.insertedId });
        res.json({ id: result.insertedId, email });
      });
  }

  static async getMe(req, res) {
    const users = await dbClient.db.collection('users');
    const auths = req.header('X-Token');
    if (!auths) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = await redisClient.get(`auth_${auths}`);
    if (!id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const userId = new ObjectID(id);
    const user = await users.findOne({ _id: userId });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(201).json({ email: user.email, id });
  }
}

module.exports = UsersController;
