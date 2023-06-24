import { Router } from "express";
import AppController from '../controllers/AppController';

const routes = Router()

routes.get('/status', (req, res) => {
    AppController.getStatus
})
routes.get('/stats', (req, res) => {
    AppController.getStats
})

module.exports = routes
