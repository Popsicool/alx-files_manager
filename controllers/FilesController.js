import { ObjectId } from 'mongodb';
import { v4 } from 'uuid';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const fs = require('fs');

class FilesController {
  static async getUser(req) {
    const auths = req.header('X-Token');
    if (!auths) {
      return null;
    }
    const userId = await redisClient.get(`auth_${auths}`);
    if (!userId) {
      return null;
    }
    const id = new ObjectId(userId);
    const user = await dbClient.db.collection('users').findOne({ _id: id });
    if (!user) {
      return null;
    }
    return user;
  }

  static async postUpload(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { name } = req.body;
    const { type } = req.body;
    const { parentId } = req.body;
    const { isPublic } = req.body;
    const { data } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }
    if (!type) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }
    if (type !== 'folder' && !data) {
      res.status(400).json({ error: 'Missing data' });
      return;
    }
    const files = await dbClient.db.collection('files');
    if (parentId) {
      const pId = new ObjectId(parentId);
      const parent = await files.findOne({ parentId: pId });
      if (!parent) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }
      if (parent.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }
    if (type === 'folder') {
      await files.insertOne({
        userId: user._id, name, type, isPublic: isPublic || false, parentId: 0,
      })
        .then((result) => {
          res.status(201).json({
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic: isPublic || false,
            parentId: 0,
          });
        });
      return;
    }
    const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileName = `${filePath}/${v4()}`;
    const buff = Buffer.from(data, 'base64');
    try {
      try {
        await fs.mkdir(filePath);
      } catch (error) {
        console.log(error);
      }
      await fs.writeFile(fileName, buff, 'utf-8');
    } catch (error) {
      console.log(error);
    }
    await files.insertOne({
      userId: user._id,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
      localPath: fileName,
    })
      .then((result) => {
        res.status(201).json({
          id: result.insertedId,
          userId: user._id,
          name,
          type,
          isPublic: isPublic || false,
          parentId: parentId || 0,
        });
      });
  }
}

module.exports = FilesController;
