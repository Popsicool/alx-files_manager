import { Router } from "express";
import AppController from '../controllers/AppController';

const routes = Router()

routes.get('/status', AppController.getStatus)
routes.get('/stats', AppController.getStats)

module.exports = routes
