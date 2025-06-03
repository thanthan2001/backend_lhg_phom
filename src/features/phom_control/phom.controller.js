const db = require("../../../connect");
const { json } = require("body-parser");
const phomModel = require("./phom.model");

exports.getAllPhom = async (req, res) => {
  const companyName = req.body.companyName;
  const LastMatNo = req.body.LastMatNo;
  const result = await phomModel.getAllPhom(companyName,LastMatNo);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};
exports.getPhomNotBinding = async (req, res) => {
  const companyName = req.body.companyName;
  const result = await phomModel.getPhomNotBinding(companyName);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
exports.getSizeNotBinding = async (req, res) => {
  const companyName = req.body.companyName;
  const LastMatNo = req.body.LastMatNo;
  const result = await phomModel.getSizeNotBinding(companyName, LastMatNo);

  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
exports.getInforPhomBinding = async (req, res) => {

  const companyName = req.body.companyName;
  const result = await phomModel.getInforPhomBinding(companyName);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
exports.getInfoPhom = async (req, res) => {
  const companyName = req.body.companyName;
  const LastMatNo = req.body.LastMatNo;
  const result = await phomModel.getInfoPhom(companyName, LastMatNo);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
exports.getLastMatNo = async (req, res) => {
  const companyName = req.body.companyName;
  const result = await phomModel.getLastMatNo(companyName);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
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
exports.getSizeByLastMatNo = async(req,res)=>{
  const companyName = req.body.companyName;
  const LastMatNo = req.body.LastMatNo;
   const result = await phomModel.getSizeByLastMatNo(companyName, LastMatNo);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
exports.getDepartment= async (req, res) => {
  const companyName = req.body.companyName;
  const result = await phomModel.getDepartment(companyName);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
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
  const LastNo = req.body.LastNo;
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
    LastNo,
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
exports.updatePhom = async (req, res) => {
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

  const result = await phomModel.updatePhom(
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

exports.TaoPhieuMuonPhom = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.TaoPhieuMuonPhom(companyName,payload);
    if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.LayPhieuMuonPhom = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.LayPhieuMuonPhom(companyName,payload);
    if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.TimPhomRFID = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.TimPhomRFID(companyName,payload);
    if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.getRFIDPhom = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.getRFIDPhom(companyName,payload);
    if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

// controller
exports.saveBill = async (req, res) => {
  const payload = req.body;
  const companyName = payload.companyName;

  try {
    const result = await phomModel.saveBill(companyName, payload);
    if (!result) {
      return res.status(500).json({ status: "Error", message: "Không thể lưu dữ liệu." });
    }

    res.status(200).json(result); // chỉ gọi res tại controller
  } catch (error) {
    res.status(500).json({ status: "Error", message: error.message });
  }
};

exports.getOldBill = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.getOldBill(companyName,payload);
    if (!result) {
    res.status(500).json("Cant Found Bill");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.confirmReturnPhom = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.confirmReturnPhom(companyName,payload);
    if (!result) {
    res.status(500).json("Cant Found Bill");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
exports.checkRFIDinBrBill = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.checkRFIDinBrBill(companyName,payload);
    if (!result) {
    res.status(500).json("Cant Found Bill");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.submitReturnPhom = async (req,res)=>{
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.submitReturnPhom(companyName,payload);
    if (!result) {
    res.status(500).json("Cant Found Bill");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.getBorrowBill = async (req, res) => {
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.getBorrowBill(companyName);
  if (!result) {
    res.status(500).json("No borrow bill found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.getAllReturnBill = async (req, res) => {
  const payload = req.body;
  console.log("Payload:", payload); 
  const companyName = payload.companyName;
  console.log("CompanyName:", companyName); 

  try {
    const result = await phomModel.getAllReturnBill(companyName, payload);
    console.log("Kết quả:", result);
    if (!result) {
      res.status(500).json("No return bill found");
    } else {
      res.status(200).json(result);
    }
  } catch (error) {
    console.error("Lỗi từ controller getAllReturnBill:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};


exports.confirmBorrowBill = async (req, res) => {
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.confirmBorrowBill(companyName, payload);
  if (!result) {
    res.status(500).json("No borrow bill found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};

exports.getBorrowBillByUser = async (req, res) => {
  const payload = req.body;
  const companyName = payload.companyName;
  const UserID = payload.UserID;
  const result = await phomModel.getBorrowBillByUser(companyName, UserID);
  if (!result) {
    res.status(500).json("No borrow bill found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}

exports.getAllPhomManagement = async (req, res) => {
  const payload = req.body;
  const companyName = payload.companyName;
  const result = await phomModel.getAllPhomManagement(companyName);
  if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};