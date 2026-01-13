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
      `SELECT * FROM [dbo].[BUsers] WHERE USERID = '${userID}'`
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

exports.getUserById = async (companyname, userID) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT * FROM Busers WHERE USERID = '${userID}'`
    );
    if (!results || !results.jsonArray || results.jsonArray.length === 0) {
      return {
        status: 404,
        data: null,
        message: "Không tìm thấy người dùng.",
      };
    }
    return {
      status: 200,
      data: results.jsonArray[0],
      message: "Lấy thông tin người dùng thành công.",
    };
  } catch (error) {
    console.error("Lỗi trong quá trình lấy thông tin người dùng:", error);
    return {
      status: 500,
      data: null,
      message: "Lỗi trong quá trình lấy thông tin người dùng.",
    };
  }
};

exports.getOfficerInfo = async (payload) => {
  try {
    const results = await db.Execute(
      payload.companyName,
      `SELECT 
        PERSON_ID, 
        PERSON_NAME, 
        D.DEPARTMENT_NAME,
        D.DEPARTMENT_SERIAL_KEY,
        BD.ID as DEPARTMENT_ID
    FROM HRIS.HRIS.DBO.DATA_PERSON P
    LEFT JOIN HRIS.HRIS.DBO.DATA_DEPARTMENT D 
        ON P.DEPARTMENT_SERIAL_KEY = D.DEPARTMENT_SERIAL_KEY
    LEFT JOIN BDepartment BD 
        ON BD.HR_department_serial_key = D.DEPARTMENT_SERIAL_KEY
    WHERE PERSON_ID = '${payload.userID}';
`
    );

    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 404,
        data: [],
        message: "Không tìm thấy thông tin officer.",
      };
    }

    return {
      status: "Success",
      statusCode: 200,
      data: results.jsonArray[0],
      message: "Lấy thông tin officer thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin officer:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy thông tin officer.",
    };
  }
};
