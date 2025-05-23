const { json } = require("body-parser");
const authModel = require("./auth.model");

exports.login = async (req, res) => {
  const companyName = req.body.companyName;
  const userID = req.body.userID;
  const pwd = req.body.pwd;
  const result = await authModel.login(companyName, userID, pwd);
  if (!result) {
    return res
      .status(500)
      .json({ status: 500, message: "Account does not exist" });
  } else {
    console.log(result);
    res.status(200).json(result);
  }
};

exports.getAllUsers = async (req, res) => {
  const companyname = req.body.companyname;
  console.log(companyname);
  const result = await authModel.getAllUsers(companyname);
  console.log(result);
  res.status(200).json(result);
};

exports.getUserById= async (req, res) => {
  const companyname = req.body.companyname;
  const userID = req.body.userID;
  console.log(companyname);
  const result = await authModel.getUserById(companyname, userID);
   if (!result) {
    res.status(500).json("No phom found");
  } else {
    console.log(result);
    res.status(200).json(result);
  }
}
