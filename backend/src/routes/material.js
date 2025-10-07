import express from 'express';
import { getMaterialTypes, createMaterialType } from '../controllers/materialController.js';

const router = express.Router();

router.get('/types', getMaterialTypes);
router.post('/types', createMaterialType);

export default router;
