const db = require("../../../connect");
const _ = require("lodash");
const axios_1 = require("axios");
const e = require("express");

exports.getAllPhom = async (companyname) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT 
    sub.LastMatNo,
    lnm.LastName,
    lnm.LastType,
    lnm.LastBrand,
    lnm.Material,
    sub.LastSize,
    sub.TotalQty AS LastQty
FROM (
    SELECT 
        LastMatNo,
        LastSize,
        SUM(LastQty) AS TotalQty
    FROM LastNoD
    --WHERE LastMatNo = 'V401000026' AND LastSize = '06.0'
    GROUP BY LastMatNo, LastSize
) sub
JOIN LastNoM lnm ON lnm.LastMatNo = sub.LastMatNo`
    );

    if (!results || !results.jsonArray) {
      console.warn("Không có dữ liệu hoặc jsonArray trả về từ cơ sở dữ liệu.");
      return {
        status: "Error",
        data: [], // Trả về một mảng rỗng để tránh lỗi
        message: "Không tìm thấy phom nào.",
      };
    }

    const payload = {
      status: "Success",
      statusCode: 200,
      data: results.jsonArray,
      message: "Lấy tất cả phom thành công",
    };
    return payload;
  } catch (error) {
    console.error("Lỗi khi lấy tất cả phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [], // Trả về một mảng rỗng để tránh lỗi
      message: "Lỗi khi lấy tất cả phom.",
    };
  }
};

exports.getPhomByLastMatNo = async (companyname, LastMatNo) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT LastName From LastNoM where LastMatNo = '${LastMatNo}'`
    );
    return {
      status: "Success",
      statusCode: 200,
      data: results,
      message: "Lấy tên phom thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy tên phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy tên phom.",
    };
  }
};

exports.searchPhomBinding = async (companyname, MaVatTu, TenPhom, SizePhom) => {
  try {
    const results = await db.Execute(
      companyname,
      `
      SELECT     
    sub.LastMatNo,     
    lnm.LastName,     
    lnm.LastType,     
    lnm.LastBrand,     
    lnm.Material,     
    sub.LastSize,     
    sub.TotalQty AS LastQty,     
    (
        SELECT COUNT(*) 
        FROM Last_Data_Binding ldb 
        WHERE ldb.LastMatNo = sub.LastMatNo 
          AND ldb.LastName = lnm.LastName 
          AND ldb.LastSize = sub.LastSize 
          AND ldb.LastSide = 'Left'
    ) AS LeftCount,
    (
        SELECT COUNT(*) 
        FROM Last_Data_Binding ldb 
        WHERE ldb.LastMatNo = sub.LastMatNo 
          AND ldb.LastName = lnm.LastName 
          AND ldb.LastSize = sub.LastSize 
          AND ldb.LastSide = 'Right'
    ) AS RightCount,
    (
        SELECT COUNT(*) 
        FROM Last_Data_Binding ldb 
        WHERE ldb.LastMatNo = sub.LastMatNo 
          AND ldb.LastName = lnm.LastName 
          AND ldb.LastSize = sub.LastSize
    ) AS BindingCount
FROM (
    SELECT 
        LastMatNo,
        LastSize,
        SUM(LastQty) AS TotalQty
    FROM LastNoD
    WHERE LastMatNo = '${MaVatTu}' 
      AND LastSize = '${SizePhom}'
    GROUP BY LastMatNo, LastSize
) sub
JOIN LastNoM lnm 
    ON lnm.LastMatNo = sub.LastMatNo
WHERE lnm.LastName = '${TenPhom}';

      `
    );
    return {
      status: "Success",
      statusCode: 200,
      data: results,
      message: "Tìm kiếm phom thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi tìm kiếm phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi tìm kiếm phom.",
    };
  }
};

exports.bindingPhom = async (
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
  companyname
) => {
  try {
    // Check RFID Exists
    const checkRFIDExists = await db.Execute(
      companyname,
      `SELECT * FROM Last_Data_Binding WHERE RFID = '${RFID}'`
    );
    if (checkRFIDExists && checkRFIDExists.jsonArray.length > 0) {
      return {
        status: "Error",
        statusCode: 400,
        data: [],
        message: "RFID đã tồn tại trong hệ thống.",
      };
    }
    //Insert
    const results = await db.Execute(
      companyname,
      `
      INSERT INTO Last_Data_Binding (RFID, LastMatNo, LastName , LastType, Material, LastSize, LastSide, UserID, ShelfName, DateIn)
      VALUES ('${RFID}', '${LastMatNo}', '${LastName}' , '${LastType}', '${Material}', '${LastSize}', '${LastSide}', '${UserID}', '${ShelfName}', '${DateIn}')
      `
    );

    //Data Inserted
    const insertedData = await db.Execute(
      companyname,
      `SELECT * FROM Last_Data_Binding WHERE RFID = '${RFID}'`
    );

    return {
      status: "Success",
      statusCode: 200,
      data: insertedData,
      message: "Gán phom thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi gán phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi gán phom.",
    };
  }
};
