import sha1 from 'sha1';
import { v4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
  static async getConnect(req, res) {
    const auths = req.header('Authorization');
    if (!auths) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    let emailAndPassword = auths.split(' ')[1];
    if (!emailAndPassword) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const buff = Buffer.from(emailAndPassword, 'base64');
    emailAndPassword = buff.toString('ascii');
    const data = emailAndPassword.split(':');
    if (data.length !== 2) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const email = data[0];
    const password = sha1(data[1]);
    const users = await dbClient.db.collection('users');
    const user = await users.findOne({ email, password });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (user.password !== password) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = v4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 60 * 60 * 24);
    res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const auths = req.header('X-Token');
    if (!auths) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await redisClient.get(`auth_${auths}`);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await redisClient.del(`auth_${auths}`);
    res.status(204).json({});
  }
}
module.exports = AuthController;
