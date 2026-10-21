import express from 'express';
import { healthController } from '../controllers/healthController.js';

const router = express.Router();

router.get('/health', healthController.getHealth);
router.get('/network-info', healthController.getNetworkInfo);

export default router;
