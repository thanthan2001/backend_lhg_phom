const db = require("../../../connect");
const { json } = require("body-parser");
const phomModel = require("./phom.model");

exports.getAllPhom = async (req, res) => {
  const companyName = req.body.companyName;
  const result = await phomModel.getAllPhom(companyName);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};

exports.searchPhomBinding = async (req, res) => {
  const companyName = req.body.companyName;
  const MaVatTu = req.body.MaVatTu;
  const TenPhom = req.body.TenPhom;
  const SizePhom = req.body.SizePhom;
  const result = await phomModel.searchPhomBinding(
    companyName,
    MaVatTu,
    TenPhom,
    SizePhom
  );
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};
