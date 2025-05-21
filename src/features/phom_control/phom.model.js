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
exports.getLastMatNo = async (companyname) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT DISTINCT LastMatNo FROM Last_Data_Bill
`
    );
    return {
      status: "Success",
      statusCode: 200,
      data: results,
      message: "Lấy mã vật tư thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy mã vật tư:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy mã vật tư.",
    };
  }
}
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

exports.getSizeByLastMatNo = async (companyname, LastMatNo) => {
  try {
    const results = await db.Execute(
      companyname,
      `select DISTINCT LastSize from Last_Data_Bill where LastMatNo= '${LastMatNo}' ORDER BY LastSize DESC`
    );
    return {
      status: "Success",
      statusCode: 200,
      data: results,
      message: "Lấy Size thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy Size:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy Size.",
    };
  }
};
exports.getDepartment = async (companyname) => {

  try {
    const results = await db.Execute(
      companyname,
      `SELECT ID FROM BDepartment`
    );
    return {
      status: "Success",
      statusCode: 200,
      data: results,
      message: "Lấy tên phòng ban thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy tên phòng ban:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy tên phòng ban.",
    };
  }
}
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

exports.ScanPhomMuonTra = async (companyname, RFID) => {
  try {
    // Kiểm tra xem RFID đã tồn tại trong bảng hay chưa
    const results = await db.Execute(
      companyname,
      `SELECT * FROM Last_Data_Scan_Temp WHERE RFID = '${RFID}'`
    );

    if (results.rowCount === 0) {
      // Không có dữ liệu RFID => INSERT mới
      await db.Execute(
        companyname,
        `INSERT INTO Last_Data_Scan_Temp (RFID, isOutScan, DateIn, DateOut)
         VALUES ('${RFID}', 1, '1900-01-01', GETDATE())`
      );

      return {
        status: "Success",
        statusCode: 200,
        message: "Đã thêm dữ liệu mới với isOutScan = 1.",
      };
    } else {
      console.log("results", results);
      // Có dữ liệu => kiểm tra isOutScan
      const isOutScan = results.jsonArray[0].isOutScan;

      if (isOutScan === 1 || isOutScan === true) {
        // Nếu đang ở trạng thái isOutScan = 1 thì cập nhật lại
        await db.Execute(
          companyname,
          `UPDATE Last_Data_Scan_Temp
           SET isOutScan = 0, DateIn = GETDATE()
           WHERE RFID = '${RFID}'`
        );

        return {
          status: "Updated",
          statusCode: 200,
          message: "Đã cập nhật isOutScan = 0 và DateIn = GETDATE().",
        };
      } else {
        return {
          status: "NoAction",
          statusCode: 200,
          message: "RFID đã tồn tại và isOutScan = 0, không cần cập nhật.",
        };
      }
    }
  } catch (error) {
    console.error("Lỗi khi xử lý RFID:", error);
    return {
      status: "Error",
      statusCode: 500,
      message: "Đã xảy ra lỗi khi xử lý RFID.",
    };
  }
};

exports.TaoPhieuMuonPhom = async(companyname, payload) => {
    try {
      // Tạo Đơn Mượn
      const TaoPhieuMuon = await db.Execute(companyname,
        `EXEC Insert_Last_Data_Bill
          @Userid = '${payload.UserID}',
          @DepID = '${payload.DepID}',
          @DateBorrow = '${payload.DateBorrow}',
          @DateReceive = '${payload.DateReceive}',
          @LastMatNo = '${payload.LastMatNo}',
          @isConfirm = 0,
          @StateLastBill = 0;`
      );
      const GetPhieuMuon = await db.Execute(companyname,
        `select * from Last_Data_Bill where DepID='${payload.DepID}' and 
        DateBorrow='${payload.DateBorrow}' and DateReceive='${payload.DateReceive}' and LastMatNo='${payload.LastMatNo}'`
      );
      if (GetPhieuMuon.rowCount === 0) {
        return {
          status: "Error",
          statusCode: 400,
          data: [],
          message: "Không tìm thấy phiếu mượn.",
        };
      }
      else{
        const ID_Bill = GetPhieuMuon.jsonArray[0].ID_bill;
        if (ID_Bill === null || ID_Bill === undefined) {
          return {
            status: "Error",
            statusCode: 400,
            data: [],
            message: "Không tìm thấy ID_Bill.",
          };
        }
        else{
          // Tạo Đơn Mượn Chi Tiết
         for (const item of payload.Details) {
            const TaoPhieuMuonCT = await db.Execute(companyname,
              `EXEC Insert_Detail_Last_Data_Bill
                @ID_bill = '${ID_Bill}',
                @DepID = '${payload.DepID}',
                @LastMatNo = '${payload.LastMatNo}',
                @LastName = N'${item.LastName}',  -- dùng N'' nếu có tiếng Việt
                @LastSize = '${item.LastSize}',
                @LastSum = ${item.LastSum};`
            );
          }
        }
        const results = await db.Execute(companyname, `select * from Last_Data_Bill where ID_bill = '${ID_Bill}'`);
        if (results.rowCount !== 0 && results.jsonArray.length > 0) {
         return{
          status: "Success",
          statusCode: 200,
          data: results.jsonArray,
          message: "Tạo phiếu mượn thành công.",
         }
        }
      }
    } catch (error) {
      console.error("Lỗi khi tạo phiếu mượn:", error);
      return {
        status: "Error",
        statusCode: 500,
        data: [],
        message: "Lỗi khi tạo phiếu mượn.",
      };
    }
}

exports.LayPhieuMuonPhom = async(companyname, payload) => {
  try {
    const results = await db.Execute(companyname,
      `select * from Last_Data_Bill where CONVERT(date, DateBorrow) = '${payload.DateBorrow}' and DepID = '${payload.DepID}' and Userid='${payload.UserID}' and LastMatNo='${payload.LastMatNo}'`
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 200,
        data: [],
        message: "Không có phiếu mượn nào",
      };
    } else {
      const ID_Bill = results.jsonArray[0].ID_bill;
      const getDetailsBill = await db.Execute(companyname,
        `select * from Detail_Last_Data_Bill where ID_bill = '${ID_Bill}'`
      );
      console.log("ID_Bill", getDetailsBill);
      return {
        status: "Success",
        statusCode: 200,
        data: getDetailsBill,
        message: "Lấy phiếu mượn thành công.",
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy phiếu mượn:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy phiếu mượn.",
    };
  }
}

exports.TimPhomRFID = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT * FROM Last_Data_Binding WHERE RFID = '${payload.RFID}'`
    );
    if (results.rowCount === 0) {
      return {
        status: "Chưa binding",
        statusCode: 204,
        data: [],
        message: "Không có phom nào",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results.jsonArray,
        message: "Lấy phom thành công.",
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy phom.",
    };
  }
}

exports.getRFIDPhom = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `
select * from Last_Data_Binding where RFID='${payload.RFID}'
`
    );
    if (results.rowCount === 0) {
      return {
        status: "không có phom nào",
        statusCode: 204,
        data: [],
        message: "Không có phom nào",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results.jsonArray,
        message: "Lấy phom thành công.",
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy phom.",
    };
  }
}
