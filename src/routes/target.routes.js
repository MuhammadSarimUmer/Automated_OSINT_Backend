const express = require('express');
const { addTarget, getTargets, deleteTarget } = require('../controllers/target.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/add', addTarget);
router.get('/', getTargets);
router.delete('/:id', deleteTarget);

module.exports = router;