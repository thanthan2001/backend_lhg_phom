const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");

router.post("/login", authController.login);
router.post("/getAllUser", authController.getAllUsers);

module.exports = router;
