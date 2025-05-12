const db = require("../../../connect");
const _ = require("lodash");
const axios_1 = require("axios");

exports.getAllUsers = async (companyname) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT TOP 10 * FROM [dbo].[BUsers]`
    );

    if (!results || !results.jsonArray) {
      console.warn("Không có dữ liệu hoặc jsonArray trả về từ cơ sở dữ liệu.");
      return {
        status: "error",
        data: [], // Trả về một mảng rỗng để tránh lỗi
        message: "Không tìm thấy người dùng nào.",
      };
    }

    const payload = {
      status: "success",
      data: results.jsonArray,
      message: "Lấy tất cả người dùng thành công",
    };
    return payload;
  } catch (error) {
    console.error("Lỗi khi lấy tất cả người dùng:", error);
    return {
      status: "error",
      data: [], // Trả về một mảng rỗng để tránh lỗi
      message: "Lỗi khi lấy tất cả người dùng.",
    };
  }
};

exports.login = async (companyname, userID, pwd) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT * FROM [dbo].[BUsers] WHERE USERID = '${userID}' aND PWD = '${pwd}'`
    );
    if (!results || !results.jsonArray || results.jsonArray.length === 0) {
      return {
        status: 500,
        data: null,
        message: "Tên đăng nhập hoặc mật khẩu không chính xác.",
      };
    }
    // Return Infor User
    const user = results.jsonArray[0];
    return {
      status: 200,
      data: user,
      message: "Đăng nhập thành công.",
    };
  } catch (error) {
    console.error("Lỗi trong quá trình đăng nhập:", error);
    return {
      status: 500,
      data: null,
      message: "Lỗi trong quá trình đăng nhập.",
    };
  }
};

exports.getInfoUserbyID = async (companyname, userID) => {
  try {
    const results = db.Execute(
      companyname,
      `SELECT * FROM [dbo].[BUsers] where USERID = '${userID}'`
    );
    if (!results || !results.jsonArray) {
      console.warn("Không có dữ liệu hoặc jsonArray trả về từ cơ sở dữ liệu.");
      return {
        status: "Error",
        data: [], // Trả về một mảng rỗng để tránh lỗi
        message: "Không tìm thấy user nào.",
      };
    }
    const payload = {
      status: "Success",
      statusCode: 200,
      data: results.jsonArray,
      message: "Lấy thông tin user thành công",
    };
    return payload;
  } catch (error) {
    console.error("Lỗi khi lấy thông tin user:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [], // Trả về một mảng rỗng để tránh lỗi
      message: "Lỗi khi lấy thông tin user.",
    };
  }
};
