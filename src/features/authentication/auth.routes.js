const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");

router.post("/login", authController.login);
router.post("/getAllUser", authController.getAllUsers);
router.post("/getUserById", authController.getUserById);
router.post("/get_officer_info", authController.getOfficerInfo);

module.exports = router;
