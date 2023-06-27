import { ObjectId } from 'mongodb';
import { v4 } from 'uuid';
import mime from 'mime-types';
import Queue from 'bull';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const fs = require('fs');
const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');
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
    fileQueue.add(
      {
        userId: user._id,
        fileId: result.insertedId,
      },
    );
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

  static async getShow(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const files = await dbClient.db.collection('files');
    const { id } = req.params;
    const fileId = new ObjectId(id);
    const file = await files.findOne({ _id: fileId });
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    if (file.userId !== user._id) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const files = await dbClient.db.collection('files');
    const user = await FilesController.getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { parentId, page } = req.query;
    const pageNum = page || 0;
    let query;
    if (parentId) {
      query = { userId: user._id, parentId: new ObjectId(parentId) };
    } else {
      query = { userId: user._id };
    }
    await files.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((error, result) => {
      if (result) {
        const response = result[0].data.map((file) => {
          const inFil = { ...file, id: file._id };
          delete inFil._id;
          delete inFil.localPath;
          return inFil;
        });
        res.status(200).json(response);
        return;
      }
      console.log('An Error Occured');
      res.status(404).json({ error: 'Not found' });
    });
  }

  static async putPublish(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const files = await dbClient.db.collection('files');
    const { id } = req.params;
    const fileId = new ObjectId(id);
    const update = { $set: { isPublic: true } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate({ _id: fileId, userId: user._id }, update, options, (err, result) => {
      if (!result.lastErrorObject.updatedExisting) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.status(200).json(result.value);
    });
  }

  static async putUnpublish(req, res) {
    const user = await FilesController.getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const files = await dbClient.db.collection('files');
    const { id } = req.params;
    const fileId = new ObjectId(id);
    const update = { $set: { isPublic: false } };
    const options = { returnOriginal: false };
    files.findOneAndUpdate({ _id: fileId, userId: user._id }, update, options, (err, result) => {
      if (!result.lastErrorObject.updatedExisting) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.status(200).json(result.value);
    });
  }

  static async getFile(req, res) {
    const files = await dbClient.db.collection('files');
    const { id, size } = req.params;
    const fileId = new ObjectId(id);
    const file = await files.findOne({ _id: fileId });
    if (!file) {
      res.status(404).json({ error: 'Not found' });
      return;
    };
    if (file.type === 'folder') {
      res.status(400).json({ error: 'A folder doesn\'t have content' });
      return;
    }
    let filePath = file.localPath;
    if (size) {
      filePath = `${file.localPath}_${size}`;
    }
    fs.access(filePath, fs.F_OK, (err) => {
      if (err) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
    })
    const contentType = mime.contentType(file.name);
    res.header('Content-Type', contentType).status(200).sendFile(fileName);
  }
}

module.exports = FilesController;
