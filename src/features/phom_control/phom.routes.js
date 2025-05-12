const express = require("express");
const router = express.Router();
const phomRoute = require("./phom.controller");

router.post("/getAllPhom", phomRoute.getAllPhom);
router.post("/getPhomByLastMatNo", phomRoute.getPhomByLastMatNo);
router.post("/searchPhomBinding", phomRoute.searchPhomBinding);
router.post("/bindingPhom", phomRoute.bindingPhom);

module.exports = router;
