const express = require("express");
const router = express.Router();
const phomRoute = require("./phom.controller");

router.post("/getAllPhom", phomRoute.getAllPhom);
router.post("/getPhomByLastMatNo", phomRoute.getPhomByLastMatNo);
router.post("/getSizeByLastMatNo",phomRoute.getSizeByLastMatNo)
router.post("/getDepartment", phomRoute.getDepartment);
router.post("/searchPhomBinding", phomRoute.searchPhomBinding);
router.post("/bindingPhom", phomRoute.bindingPhom);
router.post("/scanouttemp", phomRoute.ScanPhomMuonTra);
router.post("/submit_borrow", phomRoute.TaoPhieuMuonPhom);

module.exports = router;
