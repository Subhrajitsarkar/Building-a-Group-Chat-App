// routes/groupRoutes.js
const express = require('express');
const router = express.Router();

const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../services/S3service');

router.post('/', authenticate, groupController.createGroup);

router.post('/:groupId/makeAdmin', authenticate, groupController.makeAdmin);

router.post('/:groupId/remove', authenticate, groupController.removeUser);

router.post('/:groupId/add', authenticate, groupController.addUser);

router.post('/:groupId/message', authenticate, groupController.postGroupMessage);

router.get('/:groupId/messages', authenticate, groupController.getGroupMessages);

router.post('/:groupId/upload', authenticate, upload.single('file'), groupController.uploadFile);

router.get('/', authenticate, groupController.getAllGroups);

module.exports = router;
