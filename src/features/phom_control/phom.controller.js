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

exports.getPhomByLastMatNo = async (req, res) => {
  const companyName = req.body.companyName;
  const LastMatNo = req.body.LastMatNo;
  const result = await phomModel.getPhomByLastMatNo(companyName, LastMatNo);
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

exports.bindingPhom = async (req, res) => {
  const companyName = req.body.companyName;
  const RFID = req.body.RFID;
  const LastMatNo = req.body.LastMatNo;
  const LastName = req.body.LastName;
  const LastType = req.body.LastType;
  const Material = req.body.Material;
  const LastSize = req.body.LastSize;
  const LastSide = req.body.LastSide;
  const UserID = req.body.UserID;
  const ShelfName = req.body.ShelfName;
  const DateIn = req.body.DateIn;

  const result = await phomModel.bindingPhom(
    RFID,
    LastMatNo,
    LastName,
    LastType,
    Material,
    LastSize,
    LastSide,
    UserID,
    ShelfName,
    DateIn,
    companyName
  );
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};

exports.ScanPhomMuonTra = async (req, res) => {
  const companyName = req.body.companyName;
  const RFID = req.body.epc;
  const result = await phomModel.ScanPhomMuonTra(companyName, RFID);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};
