const express = require("express");
const router = express.Router();
const phomRoute = require("./phom.controller");

router.post("/getAllPhom", phomRoute.getAllPhom);
router.post("/searchPhomBinding", phomRoute.searchPhomBinding);

module.exports = router;
