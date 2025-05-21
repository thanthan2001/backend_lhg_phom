const express = require("express");
const router = express.Router();
const phomRoute = require("./phom.controller");

router.post("/getAllPhom", phomRoute.getAllPhom);
router.post("/getInforPhomBinding", phomRoute.getInforPhomBinding);
router.post("/getLastMatNo", phomRoute.getLastMatNo);
router.post("/getPhomByLastMatNo", phomRoute.getPhomByLastMatNo);
router.post("/getSizeByLastMatNo",phomRoute.getSizeByLastMatNo)
router.post("/getDepartment", phomRoute.getDepartment);
router.post("/searchPhomBinding", phomRoute.searchPhomBinding);
router.post("/bindingPhom", phomRoute.bindingPhom);
router.post("/scanouttemp", phomRoute.ScanPhomMuonTra);
router.post("/submit_borrow", phomRoute.TaoPhieuMuonPhom);
router.post('/layphieumuon', phomRoute.LayPhieuMuonPhom);
router.post('/getphomrfid', phomRoute.TimPhomRFID);
router.post('/getInfoPhom', phomRoute.getInfoPhom);
router.post('/saveBill', phomRoute.saveBill);


module.exports = router;
