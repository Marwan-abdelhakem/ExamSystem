import express from 'express';
import { createSubscriptionIntent,stripePublishableKey, createAddonIntent } from './payment.service.js';

const router = express.Router();
router.post('/create-subscription-intent', createSubscriptionIntent);
router.post('/create-addon-intent', createAddonIntent);
router.get('/config', stripePublishableKey);

export default router;