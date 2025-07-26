const db = require("../../../connect");
const _ = require("lodash");
const axios_1 = require("axios");
const e = require("express");

exports.getAllPhom = async (companyname) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT 
    LastMatNo,
    LastName,
    LastType,
    Material,
    LastSize,
    COUNT(CASE WHEN isOut IS NULL OR isOut <> 1 THEN 1 END) AS SoLuongTonKho
FROM 
    Last_Data_Binding
	where LastMatNo='${LastMatNo}'
GROUP BY 
    LastMatNo, LastName, LastType, Material, LastSize;`
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
      data: results,
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

exports.getBorrowBill = async (companyname) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT 
    dldb.ID_bill, 
    dldb.DepID,
    bdep.DepName,
    ldb.Userid, 
    bu.USERNAME AS BorrowerName,         -- Người mượn
    ldb.OfficerId, 
    officer.USERNAME AS OfficerName,     -- Người xử lý/Officer
    ldb.LastMatNo, 
    dldb.LastName, 
    dldb.LastSize, 
    dldb.LastSum,
    ldb.DateBorrow, 
    ldb.DateReceive, 
    ldb.isConfirm,
    ldb.StateLastBill,

    -- ToTalPhomNotBinding ép kiểu thập phân 1 chữ số
    CAST(ISNULL(ldb.ToTalPhomNotBinding, 0) AS DECIMAL(10,1)) AS ToTalPhomNotBinding,

    -- Số lượng đôi phom đã scan cho mượn (TotalPairsScanned)
    CAST(ISNULL(ScannedData.TotalPairsScanned, 0) AS DECIMAL(10,1)) AS TotalPairsScanned

FROM Last_Data_Bill ldb
JOIN Detail_Last_Data_Bill dldb ON ldb.ID_bill = dldb.ID_bill
LEFT JOIN Busers bu ON ldb.Userid = bu.USERID
LEFT JOIN Busers officer ON ldb.OfficerId = officer.USERID
LEFT JOIN BDepartment bdep ON ldb.DepID = bdep.ID

-- Join với dữ liệu đã scan cho mượn (StateScan = 0)
LEFT JOIN (
    SELECT
        lds.ID_bill,
        ldb.LastMatNo,
        ldb.LastSize,

        -- Tính số lượng đôi: tổng số phom chia 2, không quan tâm trái/phải
        CAST(COUNT(*) * 1.0 / 2 AS DECIMAL(10,1)) AS TotalPairsScanned

    FROM Last_Detail_Scan_Out lds
    JOIN Last_Data_Binding ldb ON lds.RFID = ldb.RFID
    WHERE lds.StateScan = 0 AND ldb.isOut = 1
    GROUP BY lds.ID_bill, ldb.LastMatNo, ldb.LastSize
) AS ScannedData 
    ON dldb.ID_bill = ScannedData.ID_bill 
    AND dldb.LastMatNo = ScannedData.LastMatNo 
    AND dldb.LastSize = ScannedData.LastSize`
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 400,
        data: [],
        message: "Không có phiếu mượn nào",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results.jsonArray,
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
};
exports.getSizeNotBinding = async (companyname, LastmatNo) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT DISTINCT LastSize FROM LastNoD where LastMatNo = '${LastmatNo}' group by LastSize`
    );
    if (!results || !results.jsonArray) {
      console.warn("Không có dữ liệu hoặc jsonArray trả về từ cơ sở dữ liệu.");
      return {
        status: "Error",
        statusCode: 404,
        data: [],
        message: "Không tìm thấy phom nào.",
      };
    }

    const payload = {
      status: "Success",
      statusCode: 200,
      data: results,
      message: "Lấy tất cả phom thành công",
    };
    return payload;
  } catch (error) {
    console.error("Lỗi khi lấy tất cả phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy tất cả phom.",
    };
  }
};

exports.getPhomNotBinding = async (companyname) => {
  try {
    const results = await db.Execute(
      companyname,
      `select LastMatNo from LastNoEntry group by LastMatNo`
    );
    if (!results || !results.jsonArray) {
      console.warn("Không có dữ liệu hoặc jsonArray trả về từ cơ sở dữ liệu.");
      return {
        status: "Error",
        statusCode: 404,
        data: [],
        message: "Không tìm thấy phom nào.",
      };
    }

    const payload = {
      status: "Success",
      statusCode: 200,
      data: results,
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
// model
exports.saveBill = async (companyName, body) => {
  const { scannedRfidDetailsList } = body;

  if (!companyName || !Array.isArray(scannedRfidDetailsList)) {
    return {
      status: "Error",
      message: "Dữ liệu không hợp lệ. Thiếu companyName hoặc danh sách RFID.",
    };
  }

  const successList = [];
  const failedList = [];

  for (const payload of scannedRfidDetailsList) {
    try {
      const checkRFIDExists = await db.Execute(
        companyName,
        `SELECT * FROM Last_Detail_Scan_Out WHERE RFID = '${payload.RFID}'`
      );

      if (checkRFIDExists?.jsonArray?.length > 0) {
        failedList.push({
          RFID: payload.RFID,
          message: "RFID đã tồn tại",
        });
        continue;
      }

      await db.Execute(
        companyName,
        `INSERT INTO Last_Detail_Scan_Out (ID_BILL, DepID, RFID, ScanDate, StateScan)
         VALUES ('${payload.ID_BILL}', '${payload.DepID}', '${payload.RFID}', '${payload.ScanDate}', '${payload.StateScan}')`
      );
      await db.Execute(
        companyName,
        `UPDATE Last_Data_Bill SET StateLastBill = 1 WHERE ID_bill = '${payload.ID_BILL}'`
      );
      await db.Execute(
        companyName,
        `UPDATE Last_Data_Binding SET isOut = 1 WHERE RFID = '${payload.RFID}'`
      );

      successList.push(payload.RFID);
    } catch (error) {
      failedList.push({
        RFID: payload.RFID,
        message: error.message || "Lỗi không xác định",
      });
    }
  }

  await db.Execute(
    companyName,
    `UPDATE Last_Data_Bill SET ToTalPhomNotBinding = '${body.ToTalPhomNotBinding}' WHERE ID_bill = '${scannedRfidDetailsList[0].ID_BILL}'`
  );

  const dataInsertLastInOutNo = await db.Execute(
    companyName,
    `
  SELECT 
    ldb.Userid,
    ldb.DepID,
    ldb.LastMatNo,
    ldbind.LastSize,
    SUM(CASE 
      WHEN ldbind.LastSide IN ('Left', 'Right') THEN 0.5
      ELSE 0
    END) AS QtySide,
    ldb.DateBorrow,
    ldb.DateReceive
  FROM Last_Data_Bill ldb
  JOIN Last_Detail_Scan_Out ldso ON ldso.ID_bill = ldb.ID_bill
  JOIN Last_Data_Binding ldbind ON ldbind.RFID = ldso.RFID
  WHERE ldb.ID_bill = '${scannedRfidDetailsList[0].ID_BILL}'
  GROUP BY 
    ldb.Userid,
    ldb.DepID,
    ldbind.LastSize,
    ldb.LastMatNo,
    ldb.DateBorrow,
    ldb.DateReceive
`
  );

  const ListDataInOutNo = dataInsertLastInOutNo.jsonArray;

  const LastSumQty = ListDataInOutNo.reduce((acc, item) => {
    return acc + parseFloat(item.QtySide); // sử dụng parseFloat để cộng 0.5
  }, 0);

  const LO = await db.Execute(companyName, `EXEC sp_GenerateLastInOutNo`);
  const LastInOutNo = LO.jsonArray[0].NewLastInOutNo;

  await db.Execute(
    companyName,
    `
  INSERT INTO LastInOut_M 
  (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo) 
  VALUES (
    '${LastInOutNo}', ${LastSumQty}, '${ListDataInOutNo[0].Userid}', 
    GETDATE(), 'Y', '${ListDataInOutNo[0].LastMatNo}'
  )
`
  );
  await db.Execute(
    companyName,
    `
  INSERT INTO LastInOut_A 
  (LastInOutNo, LastInOutDate, LastInOutType, LastInOutItem, LastLocation, Printed, YN, CreID, CreDate, CfmID, CfmDate) 
  VALUES (
    '${LastInOutNo}', GETDATE(), 'Out', 'BorrowOut', '${ListDataInOutNo[0].DepID}', NULL, 
    'Y', '${ListDataInOutNo[0].Userid}', GETDATE(), NULL, NULL
  )
`
  );
  for (const item of ListDataInOutNo) {
    try {
      await db.Execute(
        companyName,
        `
      INSERT INTO LastInOut_D 
      (LastInOutNo, LastSize, LastQty, YN, CreID, CreDate, Country, LastMatNo) 
      VALUES (
        '${LastInOutNo}', '${item.LastSize}', ${item.QtySide}, 'Y', 
        '${item.Userid}', GETDATE(), 'ZZZZ', '${item.LastMatNo}'
      )
    `
      );
    } catch (error) {
      console.error("Lỗi khi xử lý dữ liệu LastInOutNo:", error);
    }
  }

  return {
    status: "Completed",
    successCount: successList.length,
    failureCount: failedList.length,
    successList,
    failedList,
  };
};

exports.getInfoPhom = async (companyname, LastMatNo) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT 
    LastMatNo,
    LastName,
    LastType,
    Material,
    LastSize,

    -- Tính số lượng đôi phom còn trong kho (không phân biệt trái/phải)
    CAST(COUNT(*) * 1.0 / 2 AS DECIMAL(10,1)) AS SoLuongTonKho

FROM 
    Last_Data_Binding
WHERE 
    (isOut IS NULL OR isOut <> 1)  -- Chỉ lấy phom chưa xuất kho
    AND LastName LIKE '%' + '${LastMatNo}' + '%'
GROUP BY 
    LastMatNo, LastName, LastType, Material, LastSize;`
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 200,
        data: [],
        message: "Không có phom nào",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results,
        message: "Lấy phom thành công.",
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy thông tin phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy thông tin phom.",
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
      `SELECT ID,DepName FROM BDepartment`
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
    lnm.LastNo,     
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

// exports.bindingPhom = async (
//   // RFID,
//   // LastMatNo,
//   // LastName,
//   // LastNo,
//   // LastType,
//   // Material,
//   // LastSize,
//   // LastSide,
//   // UserID,
//   // ShelfName,
//   // DateIn,
//   companyname,
//   payload
// ) => {
//   try {
//     // Check RFID Exists
//     for (const item of payload.details) {
//       const checkRFIDExists = await db.Execute(
//         companyname,
//         `SELECT * FROM Last_Data_Binding WHERE RFID = '${item.RFID}'`
//       );
//       if (checkRFIDExists && checkRFIDExists.jsonArray.length > 0) {
//         return {
//           status: "Error",
//           statusCode: 400,
//           data: [],
//           message: "RFID đã tồn tại trong hệ thống.",
//         };
//       }
//       //Insert
//       const results = await db.Execute(
//         companyname,
//         `
//       INSERT INTO Last_Data_Binding (RFID, LastMatNo, LastName,LastNo , LastType, Material, LastSize, LastSide, UserID, ShelfName, DateIn)
//       VALUES ('${item.RFID}', '${item.LastMatNo}', '${item.LastName}', '${item.LastNo}' , '${item.LastType}', '${item.Material}', '${item.LastSize}', '${item.LastSide}', '${item.UserID}', '${item.ShelfName}', '${item.DateIn}')
//       `
//       );

//       //Data Inserted
//       const insertedData = await db.Execute(
//         companyname,
//         `SELECT * FROM Last_Data_Binding WHERE RFID = '${item.RFID}'`
//       );
//     }
//     return {
//       status: "Success",
//       statusCode: 200,
//       data: insertedData.jsonArray,
//       message: "Gán phom thành công.",
//     };
//   } catch (error) {
//     console.error("Lỗi khi gán phom:", error);
//     return {
//       status: "Error",
//       statusCode: 500,
//       data: [],
//       message: "Lỗi khi gán phom.",
//     };
//   }
// };
exports.bindingPhom = async (companyname, payload) => {
  try {
    let successCount = 0;
    let failCount = 0;
    let failedRFIDs = [];
    let insertedItems = [];

    for (const item of payload.details) {
      const checkRFIDExists = await db.Execute(
        companyname,
        `SELECT * FROM Last_Data_Binding WHERE RFID = '${item.RFID}'`
      );

      if (checkRFIDExists && checkRFIDExists.jsonArray.length > 0) {
        failCount++;
        failedRFIDs.push(item.RFID);
        continue;
      }

      // Insert nếu RFID chưa tồn tại
      await db.Execute(
        companyname,
        `
        INSERT INTO Last_Data_Binding 
        (RFID, LastMatNo, LastName, LastNo, LastType, Material, LastSize, LastSide, UserID, ShelfName, DateIn)
        VALUES (
          '${item.RFID}', '${item.LastMatNo}', '${item.LastName}', '${item.LastNo}',
          '${item.LastType}', '${item.Material}', '${item.LastSize}', '${item.LastSide}',
          '${item.UserID}', '${item.ShelfName}', '${item.DateIn}'
        )
        `
      );

      const insertedData = await db.Execute(
        companyname,
        `SELECT * FROM Last_Data_Binding WHERE RFID = '${item.RFID}'`
      );

      if (insertedData && insertedData.jsonArray.length > 0) {
        successCount++;
        insertedItems.push(insertedData.jsonArray[0]);
      }
    }

    return {
      status: "Success",
      statusCode: 200,
      data: insertedItems,
      message: "Gán phom hoàn tất.",
      summary: {
        successCount,
        failCount,
        failedRFIDs,
      },
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

exports.updatePhom = async (companyname, items) => {
  const successList = [];
  const failureList = [];

  const updatePromises = items.map((item) => {
    const {
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
    } = item;

    const sqlQuery = `
      UPDATE Last_Data_Binding SET
        LastMatNo = '${LastMatNo}',
        LastName = '${LastName}',
        LastType = '${LastType}',
        Material = '${Material}',
        LastSize = '${LastSize}',
        LastSide = '${LastSide}',
        UserID = '${UserID}',
        ShelfName = '${ShelfName}',
        DateIn = '${DateIn}'
      WHERE RFID = '${RFID}'
    `;

    return db.Execute(companyname, sqlQuery);
  });

  const results = await Promise.allSettled(updatePromises);

  results.forEach((result, index) => {
    const originalItem = items[index];

    if (result.status === "fulfilled") {
      successList.push({
        rfid: originalItem.rfid,
        message: "Cập nhật thành công.",
      });
    } else {
      failureList.push({
        rfid: originalItem.rfid,
        error: result.reason.message || "Lỗi không xác định từ CSDL",
      });
    }
  });

  // Trả về một đối tượng chứa cả hai danh sách
  return {
    statusCode: 200,
    message: "Hoàn tất xử lý lô cập nhật.",
    data: {
      successes: successList,
      failures: failureList,
      totalSuccess: successList.length,
      totalFailure: failureList.length,
    },
  };
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
         VALUES ('${RFID}', 1, '1900-01-01', GETDATE())
               `
      );

      // await db.Execute(companyname,`UPDATE Last_Data_Binding set isOut = 1
      //    WHERE RFID = '${RFID}';`)

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

exports.TaoPhieuMuonPhom = async (companyname, payload) => {
  try {
    // Tạo Đơn Mượn
    const TaoPhieuMuon = await db.Execute(
      companyname,
      `EXEC Insert_Last_Data_Bill
          @Userid = '${payload.UserID}',
          @DepID = '${payload.DepID}',
          @DateBorrow = '${payload.DateBorrow}',
          @DateReceive = '${payload.DateReceive}',
          @LastMatNo = '${payload.LastMatNo}',
          @isConfirm = 0,
          @StateLastBill = 0,
          @OfficerId = '${payload.OfficerId}'`
    );

    const ID_Bill = TaoPhieuMuon.jsonArray[0].ID_bill;
    if (ID_Bill === null || ID_Bill === undefined) {
      return {
        status: "Error",
        statusCode: 400,
        data: [],
        message: "Không tìm thấy ID_Bill.",
      };
    } else {
      // Tạo Đơn Mượn Chi Tiết
      for (const item of payload.Details) {
        const TaoPhieuMuonCT = await db.Execute(
          companyname,
          `EXEC Insert_Detail_Last_Data_Bill
                @ID_bill = '${ID_Bill}',
                @DepID = '${payload.DepID}',
                @LastMatNo = '${item.LastMatNo}',
                @LastName = N'${item.LastName}',  -- dùng N'' nếu có tiếng Việt
                @LastSize = '${item.LastSize}',
                @LastSum = ${item.LastSum};`
        );
      }
    }
    const results = await db.Execute(
      companyname,
      `select * from Last_Data_Bill where ID_bill = '${ID_Bill}'`
    );
    if (results.rowCount !== 0 && results.jsonArray.length > 0) {
      return {
        status: "Success",
        statusCode: 200,
        data: results.jsonArray,
        message: "Tạo phiếu mượn thành công.",
      };
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
};

exports.LayPhieuMuonPhom = async (companyname, payload) => {
  try {
    // const results = await db.Execute(
    //   companyname,
    //   `select * from Last_Data_Bill where CONVERT(date, DateBorrow) = '${payload.DateBorrow}'
    //   and DepID = '${payload.DepID}' and Userid='${payload.UserID}'
    //   and LastMatNo='${payload.LastMatNo}'`
    // );
    const results = await db.Execute(
      companyname,
      `select * from Last_Data_Bill where ID_bill='${payload.ID_BILL}'`
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 400,
        data: [],
        message: "Không có phiếu mượn nào",
      };
    } else {
      const ID_Bill = results.jsonArray[0].ID_bill;
      const getDetailsBill = await db.Execute(
        companyname,
        `select * from Detail_Last_Data_Bill where ID_bill = '${ID_Bill}'`
      );
      console.log("ID_Bill", getDetailsBill);
      return {
        status: "Success",
        statusCode: 200,
        data: getDetailsBill,
        infoBill: results.jsonArray[0],
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
};

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
};

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
};

exports.getOldBill = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT 
    ldb.ID_bill,
    ldb.LastMatNo,
    (SELECT SUM(LastSum) 
     FROM Detail_Last_Data_Bill 
     WHERE ID_bill = ldb.ID_bill) AS LastSum,
    (SELECT COUNT(DISTINCT RFID) 
     FROM Last_Detail_Scan_Out 
     WHERE ID_bill = ldb.ID_bill) AS TotalScanOut
    FROM Last_Data_Bill ldb
    WHERE ldb.ID_bill = '${payload.ID_BILL}';`
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 400,
        data: [],
        message: "Không có phiếu mượn nào",
      };
    } else {
      const getReturnBill = await db.Execute(
        companyname,
        `select * from Return_Bill rb join Last_Data_Bill ldb on 
          rb.ID_BILL = ldb.ID_bill
          where rb.ID_BILL='${results.jsonArray[0].ID_bill}'`
      );
      const lastdatabill = await db.Execute(
        companyname,
        `select * from Last_Data_Bill where ID_bill='${payload.ID_BILL}'`
      );
      return {
        status: "Success",
        statusCode: 200,
        data: {
          results: results.jsonArray,
          getReturnBill: getReturnBill.jsonArray,
          lastdatabill: lastdatabill.jsonArray,
        },
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
};

exports.confirmReturnPhom = async (companyname, payload) => {
  const checkBillExits = await db.Execute(
    companyname,
    `SELECT * FROM Return_Bill WHERE ID_BILL = '${payload.ID_BILL}'`
  );
  if (checkBillExits.rowCount != 0) {
    return {
      status: "Error",
      statusCode: 204,
      data: [],
      message: "Đơn đã đăng ký trả rồi!",
    };
  }

  const results = await db.Execute(
    companyname,
    `EXEC Insert_Return_Bill 
      @Userid = '${payload.UserID}',
      @ID_BILL = '${payload.ID_BILL}',
      @totalQuantityBorrow = ${payload.totalQuantityBorrow},
      @totalQuantityReturn = ${payload.totalQuantityReturn},
      @isConfirm = ${payload.isConfirm},
      @ReturnRequestDate = '${payload.ReturnRequestDate}'`
  );
  const checkInsert = await db.Execute(
    companyname,
    `SELECT * FROM Return_Bill WHERE ID_BILL = '${payload.ID_BILL}'`
  );
  if (!checkInsert) {
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi xác nhận trả phom.",
    };
  }
  return {
    status: "Success",
    statusCode: 200,
    data: checkInsert.jsonArray,
    message: "Xác nhận trả phom thành công.",
  };
};

exports.checkRFIDinBrBill = async (companyname, payload) => {
  console.log("DEBUG payload:", JSON.stringify(payload)); // 👈 thêm dòng này
  try {
    const results = await db.Execute(
      companyname,
      `SELECT RFID FROM Last_Detail_Scan_Out WHERE RFID = '${payload.RFID}'`
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 500,
        data: [],
        message: "Không có phom nào",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results,
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
};

exports.submitReturnPhom = async (companyname, payload) => {
  console.log("DEBUG payload:", JSON.stringify(payload)); // 👈 thêm dòng này
  try {
    // Kiểm tra phiếu trả có tồn tại
    const checkBillBr = await db.Execute(
      companyname,
      `SELECT * FROM Return_Bill WHERE ID_BILL = '${payload.data[0].ID_bill}'`
    );
    if (checkBillBr.rowCount !== 0) {
      return {
        status: "Error",
        statusCode: 404,
        message: "Đơn mượn đã được xử lí trước đó.",
      };
    }

    const resultsInsert = [];
    for (const item of payload.data[0].payloadDetails) {
      const checkExitsRFIDinBill = await db.Execute(
        companyname,
        `SELECT RFID FROM Details_Last_Scan_Return WHERE RFID = '${item.RFID}'`
      );

      if (checkExitsRFIDinBill.rowCount != 0) {
        console.log(`RFID ${item.RFID} đã được scan trả trước đó, bỏ qua.`);
        continue;
      }
      await db.Execute(
        companyname,
        `INSERT INTO Details_Last_Scan_Return (ID_Return, RFID, ScanDate)
          VALUES ('${item.ID_BILL}', '${item.RFID}', GETDATE())`
      );

      await db.Execute(
        companyname,
        `UPDATE Last_Data_Binding SET isOut = 0 WHERE RFID = '${item.RFID}'`
      );
      resultsInsert.push(item.RFID);
    }

    await db.Execute(
      companyname,
      `INSERT Return_Bill (ID_Return,ID_BILL, Userid, totalQuantityBorrow, totalQuantityReturn, isConfirm, ReturnRequestDate)
      VALUES ('${payload.data[0].ID_bill}','${payload.data[0].ID_bill}', '${payload.data[0].Userid}', ${payload.data[0].TotalScanOut}, ${resultsInsert.length}, 0, GETDATE())
      `
    );

    const DataLastInOut = await db.Execute(
      companyname,
      `SELECT 
        ldb.LastMatNo,
        ldb.LastSize,
        count(*) as lastsum,
        COUNT(*) * 0.5 AS LastQty
        FROM 
        Details_Last_Scan_Return dlsr
      JOIN 
        Last_Data_Binding ldb 
      ON 
        dlsr.RFID = ldb.RFID
      where dlsr.ID_Return='${payload.data[0].ID_bill}'
      GROUP BY 
        ldb.LastMatNo, ldb.LastSize;`
    );

    const LastInOutNo = await db.Execute(
      companyname,
      `EXEC sp_GenerateLastInOutNo`
    );

    const NewLastInOutNo = LastInOutNo.jsonArray[0].NewLastInOutNo;
    const newDetaLastInOut = DataLastInOut.jsonArray;
    console.log("LastInOutNo:", newDetaLastInOut, "data", NewLastInOutNo);
    await db.Execute(
      companyname,
      `
      INSERT INTO LastInOut_M (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo)
      VALUES ('${NewLastInOutNo}', ${parseFloat(
        payload.data[0].TotalScanOut / 2
      )}, '${payload.data[0].Userid}', GETDATE(), 'Y', '${
        newDetaLastInOut[0].LastMatNo
      }')
    `
    );
    await db.Execute(
      companyname,
      `
      INSERT INTO LastInOut_A (LastInOutNo, LastInOutDate, LastInOutType, LastInOutItem, LastLocation, Printed, YN, CreID, CreDate, CfmID, CfmDate)
      VALUES ('${NewLastInOutNo}', GETDATE(), 'Return', 'BorrowReturn', '${payload.data[0].DepID}', NULL, 'Y', '${payload.data[0].Userid}', GETDATE(), NULL, NULL)
    `
    );
    for (const item of newDetaLastInOut) {
      await db.Execute(
        companyname,
        `
        INSERT INTO LastInOut_D (LastInOutNo, LastSize, LastQty, YN, CreID, CreDate, Country, LastMatNo)
        VALUES ('${NewLastInOutNo}', '${item.LastSize}', ${item.LastQty}, 'Y', '${payload.data[0].Userid}', GETDATE(), 'ZZZZ', '${item.LastMatNo}')
      `
      );
    }
    return {
      status: "Success",
      statusCode: 200,
      message: "Xử lý return bill thành công",
      data: resultsInsert,
    };
  } catch (error) {
    console.error("Lỗi khi xử lý return bill:", error);
    return {
      status: "Error",
      statusCode: 500,
      message: "Lỗi khi xử lý return bill",
      data: [],
    };
  }
};

exports.confirmBorrowBill = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `UPDATE Last_Data_Bill 
       SET isConfirm = 1
       WHERE ID_bill = '${payload.ID_bill}'`
    );
    if (results.rowCount === 0) {
      return {
        status: "Error",
        statusCode: 500,
        data: [],
        message: "Không tìm thấy phiếu mượn.",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results.jsonArray,
        message: "Xác nhận phiếu mượn thành công.",
      };
    }
  } catch (error) {
    console.error("Lỗi khi xác nhận phiếu mượn:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi xác nhận phiếu mượn.",
    };
  }
};

exports.getBorrowBillByUser = async (companyname, payload) => {
  try {
    const borrowResults = await db.Execute(
      companyname,
      `SELECT 
        dldb.ID_bill, 
        dldb.DepID,
        bdep.DepName,
        ldb.Userid, 
        bu.USERNAME AS BorrowerName,         
        ldb.OfficerId, 
        officer.USERNAME AS OfficerName,     
        ldb.LastMatNo, 
        dldb.LastName, 
        dldb.LastSize, 
        dldb.LastSum,
        ldb.DateBorrow, 
        ldb.DateReceive, 
        ldb.isConfirm,
        ldb.StateLastBill,
        CAST(ISNULL(ldb.ToTalPhomNotBinding, 0) AS DECIMAL(10,1)) AS ToTalPhomNotBinding,
        CAST(ISNULL(ScannedData.TotalPairsScanned, 0) AS DECIMAL(10,1)) AS TotalPairsScanned
      FROM Last_Data_Bill ldb
      JOIN Detail_Last_Data_Bill dldb ON ldb.ID_bill = dldb.ID_bill
      LEFT JOIN Busers bu ON ldb.Userid = bu.USERID
      LEFT JOIN Busers officer ON ldb.OfficerId = officer.USERID
      LEFT JOIN BDepartment bdep ON ldb.DepID = bdep.ID
      LEFT JOIN (
          SELECT
              lds.ID_bill,
              ldb.LastMatNo,
              ldb.LastSize,
              CAST(COUNT(*) * 1.0 / 2 AS DECIMAL(10,1)) AS TotalPairsScanned
          FROM Last_Detail_Scan_Out lds
          JOIN Last_Data_Binding ldb ON lds.RFID = ldb.RFID
          WHERE lds.StateScan = 0 AND ldb.isOut = 1
          GROUP BY lds.ID_bill, ldb.LastMatNo, ldb.LastSize
      ) AS ScannedData 
          ON dldb.ID_bill = ScannedData.ID_bill 
          AND dldb.LastMatNo = ScannedData.LastMatNo 
          AND dldb.LastSize = ScannedData.LastSize
      WHERE ldb.Userid = '${payload}'`
    );

    const returnResults = await db.Execute(
      companyname,
      `WITH ReturnCounts AS (
          SELECT 
              dsr.ID_Return,
              ldbind.LastMatNo,
              ldbind.LastName,
              ldbind.LastSize,
              COUNT(DISTINCT dsr.RFID) AS TotalRFIDReturn
          FROM Details_Last_Scan_Return AS dsr
          JOIN Last_Data_Binding AS ldbind ON dsr.RFID = ldbind.RFID
          GROUP BY dsr.ID_Return, ldbind.LastMatNo, ldbind.LastName, ldbind.LastSize
      )
      SELECT 
          rb.ID_Return, 
          rb.ID_BILL,
          ldb.DepID,
          bdep.DepName,
          rb.Userid, 
          bu.USERNAME AS BorrowerName,          
          ldb.OfficerId,
          officer.USERNAME AS OfficerName,      
          dldb.LastMatNo, 
          dldb.LastName,
          dldb.LastSize, 
          dldb.LastSum AS QuantityBorrow, 
          ROUND(ISNULL(rc.TotalRFIDReturn, 0) / 2.0, 1) AS QuantityReturn,
          ISNULL(UnreturnedRFIDs.RFIDsNotReturned, '') AS RFIDsNotReturned,
          ISNULL(UnreturnedRFIDs.RFID_Shortcut, '') AS RFID_Shortcut,  
          ldb.DateBorrow, 
          rb.ReturnRequestDate,
          rb.isConfirm AS isConfirmReturn,      
          ldb.StateLastBill
      FROM Return_Bill rb
      JOIN Detail_Last_Data_Bill dldb ON rb.ID_BILL = dldb.ID_bill
      JOIN Last_Data_Bill ldb ON rb.ID_BILL = ldb.ID_bill
      LEFT JOIN ReturnCounts rc 
          ON rb.ID_Return = rc.ID_Return
          AND dldb.LastMatNo = rc.LastMatNo
          AND dldb.LastName = rc.LastName
          AND dldb.LastSize = rc.LastSize
      LEFT JOIN Busers bu ON rb.Userid = bu.USERID
      LEFT JOIN Busers officer ON ldb.OfficerId = officer.USERID
      LEFT JOIN BDepartment bdep ON ldb.DepID = bdep.ID
      LEFT JOIN (
          SELECT 
              lso.ID_bill,
              ldb.LastMatNo,
              ldb.LastName,
              ldb.LastSize,
              STUFF((
                  SELECT DISTINCT ',' + lso_inner.RFID
                  FROM Last_Detail_Scan_Out lso_inner
                  LEFT JOIN Details_Last_Scan_Return dlsr_inner ON lso_inner.RFID = dlsr_inner.RFID
                  JOIN Last_Data_Binding ldb_inner ON lso_inner.RFID = ldb_inner.RFID
                  WHERE 
                      dlsr_inner.RFID IS NULL
                      AND lso_inner.ID_bill = lso.ID_bill
                      AND ldb_inner.LastMatNo = ldb.LastMatNo
                      AND ldb_inner.LastName = ldb.LastName
                      AND ldb_inner.LastSize = ldb.LastSize
                  FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS RFIDsNotReturned,
              STUFF((
                  SELECT DISTINCT ',' + ldb_inner.RFID_Shortcut
                  FROM Last_Detail_Scan_Out lso_inner
                  LEFT JOIN Details_Last_Scan_Return dlsr_inner ON lso_inner.RFID = dlsr_inner.RFID
                  JOIN Last_Data_Binding ldb_inner ON lso_inner.RFID = ldb_inner.RFID
                  WHERE 
                      dlsr_inner.RFID IS NULL
                      AND lso_inner.ID_bill = lso.ID_bill
                      AND ldb_inner.LastMatNo = ldb.LastMatNo
                      AND ldb_inner.LastName = ldb.LastName
                      AND ldb_inner.LastSize = ldb.LastSize
                  FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS RFID_Shortcut
          FROM Last_Detail_Scan_Out lso
          LEFT JOIN Details_Last_Scan_Return dlsr ON lso.RFID = dlsr.RFID
          JOIN Last_Data_Binding ldb ON lso.RFID = ldb.RFID
          WHERE dlsr.RFID IS NULL
          GROUP BY lso.ID_bill, ldb.LastMatNo, ldb.LastName, ldb.LastSize
      ) AS UnreturnedRFIDs
          ON rb.ID_BILL = UnreturnedRFIDs.ID_bill
          AND dldb.LastMatNo = UnreturnedRFIDs.LastMatNo
          AND dldb.LastName = UnreturnedRFIDs.LastName
          AND dldb.LastSize = UnreturnedRFIDs.LastSize
      WHERE rb.Userid = '${payload}'`
    );

    return {
      status: "Success",
      statusCode: 200,
      data: {
        borrowBills: borrowResults.jsonArray || [],
        returnBills: returnResults.jsonArray || [],
      },
      message: "Lấy thông tin mượn và trả thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu mượn/trả:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy dữ liệu mượn/trả.",
    };
  }
};


exports.getAllReturnBill = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `WITH ReturnCounts AS (
    SELECT 
        dsr.ID_Return,
        ldbind.LastMatNo,
        ldbind.LastName,
        ldbind.LastSize,
        COUNT(DISTINCT dsr.RFID) AS TotalRFIDReturn
    FROM 
        Details_Last_Scan_Return AS dsr
    JOIN 
        Last_Data_Binding AS ldbind ON dsr.RFID = ldbind.RFID
    GROUP BY 
        dsr.ID_Return, 
        ldbind.LastMatNo, 
        ldbind.LastName, 
        ldbind.LastSize
)

SELECT 
    rb.ID_Return, 
    rb.ID_BILL,
    ldb.DepID,
    bdep.DepName,
    
    rb.Userid, 
    bu.USERNAME AS BorrowerName,          
    ldb.OfficerId,
    officer.USERNAME AS OfficerName,      

    dldb.LastMatNo, 
    dldb.LastName,
    dldb.LastSize, 
    dldb.LastSum AS QuantityBorrow, 
    
    ROUND(ISNULL(rc.TotalRFIDReturn, 0) / 2.0, 1) AS QuantityReturn,

    ISNULL(UnreturnedRFIDs.RFIDsNotReturned, '') AS RFIDsNotReturned,
    ISNULL(UnreturnedRFIDs.RFID_Shortcut, '') AS RFID_Shortcut,  

    ldb.DateBorrow, 
    rb.ReturnRequestDate,
    
    rb.isConfirm AS isConfirmReturn,      
    ldb.StateLastBill

FROM Return_Bill rb
JOIN Detail_Last_Data_Bill dldb 
    ON rb.ID_BILL = dldb.ID_bill
JOIN Last_Data_Bill ldb 
    ON rb.ID_BILL = ldb.ID_bill
LEFT JOIN ReturnCounts rc 
    ON rb.ID_Return = rc.ID_Return
    AND dldb.LastMatNo = rc.LastMatNo
    AND dldb.LastName = rc.LastName
    AND dldb.LastSize = rc.LastSize
LEFT JOIN Busers bu 
    ON rb.Userid = bu.USERID
LEFT JOIN Busers officer 
    ON ldb.OfficerId = officer.USERID
LEFT JOIN BDepartment bdep 
    ON ldb.DepID = bdep.ID

-- SUBQUERY lấy danh sách RFID chưa trả và RFID_Shortcut
LEFT JOIN (
    SELECT 
        lso.ID_bill,
        ldb.LastMatNo,
        ldb.LastName,
        ldb.LastSize,
        -- Chuỗi các RFID chưa trả
        STUFF((
            SELECT DISTINCT ',' + lso_inner.RFID
            FROM Last_Detail_Scan_Out lso_inner
            LEFT JOIN Details_Last_Scan_Return dlsr_inner 
                ON lso_inner.RFID = dlsr_inner.RFID
            JOIN Last_Data_Binding ldb_inner 
                ON lso_inner.RFID = ldb_inner.RFID
            WHERE 
                dlsr_inner.RFID IS NULL
                AND lso_inner.ID_bill = lso.ID_bill
                AND ldb_inner.LastMatNo = ldb.LastMatNo
                AND ldb_inner.LastName = ldb.LastName
                AND ldb_inner.LastSize = ldb.LastSize
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS RFIDsNotReturned,

        -- Chuỗi các RFID_Shortcut tương ứng
        STUFF((
            SELECT DISTINCT ',' + ldb_inner.RFID_Shortcut
            FROM Last_Detail_Scan_Out lso_inner
            LEFT JOIN Details_Last_Scan_Return dlsr_inner 
                ON lso_inner.RFID = dlsr_inner.RFID
            JOIN Last_Data_Binding ldb_inner 
                ON lso_inner.RFID = ldb_inner.RFID
            WHERE 
                dlsr_inner.RFID IS NULL
                AND lso_inner.ID_bill = lso.ID_bill
                AND ldb_inner.LastMatNo = ldb.LastMatNo
                AND ldb_inner.LastName = ldb.LastName
                AND ldb_inner.LastSize = ldb.LastSize
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS RFID_Shortcut

    FROM Last_Detail_Scan_Out lso
    LEFT JOIN Details_Last_Scan_Return dlsr 
        ON lso.RFID = dlsr.RFID
    JOIN Last_Data_Binding ldb 
        ON lso.RFID = ldb.RFID
    WHERE dlsr.RFID IS NULL
    GROUP BY lso.ID_bill, ldb.LastMatNo, ldb.LastName, ldb.LastSize
) AS UnreturnedRFIDs
    ON rb.ID_BILL = UnreturnedRFIDs.ID_bill
    AND dldb.LastMatNo = UnreturnedRFIDs.LastMatNo
    AND dldb.LastName = UnreturnedRFIDs.LastName
    AND dldb.LastSize = UnreturnedRFIDs.LastSize;`
    );
    console.log("results", results);
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 400,
        data: [],
        message: "Không có phiếu trả nào",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results.jsonArray,
        message: "Lấy phiếu trả thành công.",
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy phiếu trả:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy phiếu trả.",
    };
  }
};

exports.getAllPhomManagement = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT
    ldb.LastNo,
    ldb.LastSize,

    -- RFID dạng mảng cho bản SQL Server cũ
    STUFF((
        SELECT ',' + ldb2.RFID
        FROM Last_Data_Binding ldb2
        WHERE ldb2.LastNo = ldb.LastNo AND ldb2.LastSize = ldb.LastSize
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS RFID_List,

    -- Original columns
    MIN(ldb.LastMatNo)   AS LastMatNo,
    MIN(ldb.LastName)    AS LastName,
    MIN(ldb.Material)    AS Material,
    MIN(ldb.LastType)    AS LastType,
    MIN(ldb.DateIn)      AS DateIn,
    MIN(ldb.UserID)      AS UserID,

    -- Tổng số chiếc (không phân biệt trái/phải)
    COUNT(*) AS TotalQty,

    -- Số đôi = Tổng số chiếc / 2 (kết quả có thể là số lẻ, ví dụ 5.5)
    CAST(COUNT(*) / 2.0 AS DECIMAL(10,1)) AS TotalPairs,

    -- Tổng số chiếc còn trong kho
    SUM(CASE WHEN ldb.isOut = 0 THEN 1 ELSE 0 END) AS QtyInStock_Total,

    -- Số đôi còn trong kho = Tổng số chiếc trong kho / 2
    CAST(SUM(CASE WHEN ldb.isOut = 0 THEN 1 ELSE 0 END) / 2.0 AS DECIMAL(10,1)) AS QtyInStock_Pairs

FROM
    Last_Data_Binding ldb
GROUP BY
    ldb.LastNo,
    ldb.LastSize
ORDER BY
    ldb.LastNo,
    ldb.LastSize;
`
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 400,
        data: [],
        message: "Không có phom nào",
      };
    } else {
      return {
        status: "Success",
        statusCode: 200,
        data: results.jsonArray,
        message: "Lấy danh sách phom thành công.",
      };
    }
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy danh sách phom.",
    };
  }
};

exports.submitTransfer = async (companyname, payload) => {
  try {
    const today = new Date();
    const formattedDate = today.toISOString().slice(0, 10);
    //========================XỬ LÍ MƯỢN==========================
    console.log("==============TẠO PHIẾU MƯỢN==========================");
    const TaoPhieuMuon = await db.Execute(
      companyname,
      `EXEC Insert_Last_Data_Bill
      @Userid = '${payload.userId}',
      @DepID = '${payload.BILL_BORROW.RFIDDetails[0].DepID}',
      @DateBorrow ='${payload.BILL_BORROW.RFIDDetails[0].ScanDate}',
      @DateReceive = '${payload.BILL_BORROW.RFIDDetails[0].ScanDate}',
      @LastMatNo = '${payload.BILL_BORROW.RFIDDetails[0].LastMatNo}',
      @isConfirm = 1,
      @StateLastBill = 1,
      @OfficerId = 'NULL',
      @isTransfer = 1
      `
    );
    console.log("Tạo phiếu mượn", TaoPhieuMuon);

    const newIDBill = TaoPhieuMuon.jsonArray[0].ID_bill;
    if (!newIDBill) {
      return {
        status: "Error",
        statusCode: 500,
        data: [],
        message: "Lỗi khi tạo phiếu mượn.",
      };
    }
    console.log("newIDBill", newIDBill);
    console.log(
      "==============CAP NHAT STATE AND ID PHIEU MUON CHI TIET=========================="
    );
    for (var item of payload.BILL_BORROW.RFIDDetails) {
      await db.Execute(
        companyname,
        `UPDATE Last_Detail_Scan_Out SET ID_bill='${newIDBill}' WHERE RFID = '${item.RFID}'`
      );
      await db.Execute(
        companyname,
        `UPDATE Last_Detail_Scan_Out SET DepID='${item.DepID}' WHERE RFID = '${item.RFID}'`
      );
      await db.Execute(
        companyname,
        `UPDATE Last_Detail_Scan_Out SET StateScan=1 WHERE RFID = '${item.RFID}'`
      );
    }

    const LO = await db.Execute(companyname, `EXEC sp_GenerateLastInOutNo`);
    const LastInOutNo = LO.jsonArray[0].NewLastInOutNo;

    // Tính toán LastSumQty an toàn hơn
    const LastSumQty = payload.BILL_BORROW.scannedRfidDetailsList.reduce(
      (acc, item) => {
        return acc + (Number(item.LastSum) || 0); // Đảm bảo item.LastSum là số, nếu không thì coi như 0
      },
      0
    ); // Khởi tạo acc = 0

    let borrowQtyForM = parseFloat(LastSumQty / 2);
    if (isNaN(borrowQtyForM)) {
      borrowQtyForM = 0; // Hoặc NULL nếu cột cho phép
    }

    await db.Execute(
      companyname,
      `
  INSERT INTO LastInOut_A (LastInOutNo, LastInOutDate, LastInOutType, LastInOutItem, LastLocation, Printed,
  YN, CreID, CreDate, CfmID, CfmDate) VALUES(
  '${LastInOutNo}',GETDATE(),'Out','BorrowOut', '${payload.BILL_BORROW.RFIDDetails[0].DepID}',NULL,'Y',
  '${payload.userId}',GETDATE(),NULL,NULL 
  )`
    ); // Bỏ dấu ) thừa

    await db.Execute(
      companyname,
      `
  INSERT INTO LastInOut_M (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo) VALUES(
  '${LastInOutNo}', ${borrowQtyForM}, '${payload.userId}', GETDATE(), 'Y', '${payload.BILL_BORROW.RFIDDetails[0].LastMatNo}'
  )
`
    );

    for (const item of payload.BILL_BORROW.scannedRfidDetailsList) {
      await db.Execute(
        companyname,
        `
    INSERT INTO LastInOut_D (LastInOutNo, LastSize, LastQty, YN, CreID, CreDate, Country, LastMatNo) VALUES(
    '${LastInOutNo}', '${item.LastSize}', ${Number(item.LastSum) || 0}, 'Y', '${
          payload.userId
        }', GETDATE(), 'ZZZZ', '${item.LastMatNo}'
    )
  `
      );
    }
    console.log("==============XONG TẠO PHIẾU MƯỢN==========================");

    //========================XỬ LÍ TRẢ==========================
    console.log("==============TẠO PHIẾU TRẢ==========================");
    // !!! QUAN TRỌNG: Đảm bảo sp_GenerateLastInOutNo trả về ID mới khác với LastInOutNo ở trên
    const LO_Return = await db.Execute(
      companyname,
      `EXEC sp_GenerateLastInOutNo`
    );
    const LastInOutNoReturn = LO_Return.jsonArray[0].NewLastInOutNo;

    // Ghi log để kiểm tra xem LastInOutNo và LastInOutNoReturn có khác nhau không
    console.log(`Generated LastInOutNo for Borrow: ${LastInOutNo}`);
    console.log(`Generated LastInOutNo for Return: ${LastInOutNoReturn}`);

    if (LastInOutNo === LastInOutNoReturn) {
      console.error(
        "CRITICAL ERROR: sp_GenerateLastInOutNo returned the same ID for borrow and return operations. This will cause PK violations."
      );
      // Có thể bạn muốn dừng ở đây hoặc thử gọi lại SP
      // return { status: "Error", statusCode: 500, message: "Failed to generate unique InOut number for return."};
    }

    const LastSumQtyReturn = payload.BILL_RETURN.reduce((acc, item) => {
      return acc + (Number(item.LastSum) || 0);
    }, 0);

    let returnQtyForM = parseFloat(LastSumQtyReturn / 2);
    if (isNaN(returnQtyForM)) {
      returnQtyForM = 0; // Hoặc NULL nếu cột cho phép
    }

    await db.Execute(
      companyname,
      `
  INSERT INTO LastInOut_A (LastInOutNo, LastInOutDate, LastInOutType, LastInOutItem, LastLocation, Printed,
  YN, CreID, CreDate, CfmID, CfmDate) VALUES(
  '${LastInOutNoReturn}',GETDATE(),'In','ReturnIn', '${payload.BILL_RETURN[0].DepID}',NULL,'Y',
  '${payload.userId}',GETDATE(),NULL,NULL
  )`
    ); // Bỏ dấu ) thừa

    await db.Execute(
      companyname,
      `
  INSERT INTO LastInOut_M (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo) VALUES(
  '${LastInOutNoReturn}', ${returnQtyForM}, '${payload.userId}', GETDATE(), 'Y', '${payload.BILL_RETURN[0].LastMatNo}'
  )
`
    );

    for (const item of payload.BILL_RETURN) {
      await db.Execute(
        companyname,
        `
    INSERT INTO LastInOut_D (LastInOutNo, LastSize, LastQty, YN, CreID, CreDate, Country, LastMatNo) VALUES(
    '${LastInOutNoReturn}', '${item.LastSize}', ${
          Number(item.LastSum) || 0
        }, 'Y', '${payload.userId}', GETDATE(), 'ZZZZ', '${item.LastMatNo}'
    )
  `
      );
    }

    return {
      status: "Success",
      statusCode: 200,
      data: [
        {
          statusCode: 200,
          status: "Success",
          ID_bill: newIDBill,
          LastInOutNo: LastInOutNo,
          LastInOutNoReturn: LastInOutNoReturn,
          LastSumQty: LastSumQty, // Giờ sẽ là số
          LastSumQtyReturn: LastSumQtyReturn, // Giờ sẽ là số
        },
      ],
      message: "Xử lý chuyển giao thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi xử lý chuyển giao:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi xử lý chuyển giao.",
    };
  }
};

exports.getBorrowPhomState = async (companyname, payload) => {
  try {
    // Câu lệnh 1: Lấy trạng thái tổng hợp của tất cả phom trong kho
    const sqlQueryPhomTrongKho = `
      SELECT
    ldb.LastNo,
    ldb.LastSize,

    -- RFID dạng mảng cho bản SQL Server cũ
    STUFF((
        SELECT ',' + ldb2.RFID
        FROM Last_Data_Binding ldb2
        WHERE ldb2.LastNo = ldb.LastNo AND ldb2.LastSize = ldb.LastSize
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS RFID_List,

    -- Original columns
    MIN(ldb.LastMatNo)   AS LastMatNo,
    MIN(ldb.LastName)    AS LastName,
    MIN(ldb.Material)    AS Material,
    MIN(ldb.LastType)    AS LastType,
    MIN(ldb.DateIn)      AS DateIn,
    MIN(ldb.UserID)      AS UserID,

    -- Tổng số chiếc (không phân biệt trái/phải)
    COUNT(*) AS TotalQty,

    -- Số đôi = Tổng số chiếc / 2 (kết quả có thể là số lẻ, ví dụ 5.5)
    CAST(COUNT(*) / 2.0 AS DECIMAL(10,1)) AS TotalPairs,

    -- Tổng số chiếc còn trong kho
    SUM(CASE WHEN ldb.isOut = 0 THEN 1 ELSE 0 END) AS QtyInStock_Total,

    -- Số đôi còn trong kho = Tổng số chiếc trong kho / 2
    CAST(SUM(CASE WHEN ldb.isOut = 0 THEN 1 ELSE 0 END) / 2.0 AS DECIMAL(10,1)) AS QtyInStock_Pairs

FROM
    Last_Data_Binding ldb
GROUP BY
    ldb.LastNo,
    ldb.LastSize
ORDER BY
    ldb.LastNo,
    ldb.LastSize;`;

    // Câu lệnh 2: Lấy danh sách chi tiết các đơn mượn
    const sqlQueryDonMuon = `SELECT 
    dldb.ID_bill, 
    dldb.DepID,
    bdep.DepName,
    ldb.Userid, 
    bu.USERNAME AS BorrowerName,         -- Người mượn
    ldb.OfficerId, 
    officer.USERNAME AS OfficerName,     -- Người xử lý/Officer
    ldb.LastMatNo, 
    dldb.LastName, 
    dldb.LastSize, 
    dldb.LastSum,
    ldb.DateBorrow, 
    ldb.DateReceive, 
    ldb.isConfirm,
    ldb.StateLastBill,

    -- ToTalPhomNotBinding ép kiểu thập phân 1 chữ số
    CAST(ISNULL(ldb.ToTalPhomNotBinding, 0) AS DECIMAL(10,1)) AS ToTalPhomNotBinding,

    -- Số lượng đôi phom đã scan cho mượn (TotalPairsScanned)
    CAST(ISNULL(ScannedData.TotalPairsScanned, 0) AS DECIMAL(10,1)) AS TotalPairsScanned

FROM Last_Data_Bill ldb
JOIN Detail_Last_Data_Bill dldb ON ldb.ID_bill = dldb.ID_bill
LEFT JOIN Busers bu ON ldb.Userid = bu.USERID
LEFT JOIN Busers officer ON ldb.OfficerId = officer.USERID
LEFT JOIN BDepartment bdep ON ldb.DepID = bdep.ID

-- Join với dữ liệu đã scan cho mượn (StateScan = 0)
LEFT JOIN (
    SELECT
        lds.ID_bill,
        ldb.LastMatNo,
        ldb.LastSize,

        -- Tính số lượng đôi: tổng số phom chia 2, không quan tâm trái/phải
        CAST(COUNT(*) * 1.0 / 2 AS DECIMAL(10,1)) AS TotalPairsScanned

    FROM Last_Detail_Scan_Out lds
    JOIN Last_Data_Binding ldb ON lds.RFID = ldb.RFID
    WHERE lds.StateScan = 0 AND ldb.isOut = 1
    GROUP BY lds.ID_bill, ldb.LastMatNo, ldb.LastSize
) AS ScannedData 
    ON dldb.ID_bill = ScannedData.ID_bill 
    AND dldb.LastMatNo = ScannedData.LastMatNo 
    AND dldb.LastSize = ScannedData.LastSize`;

    // ----- THỰC THI SONG SONG 2 CÂU LỆNH -----
    const [phomTrongKhoResult, donMuonResult] = await Promise.all([
      db.Execute(companyname, sqlQueryPhomTrongKho),
      db.Execute(companyname, sqlQueryDonMuon),
    ]);

    const responseData = {
      danhSachPhomTrongKho: phomTrongKhoResult.jsonArray || [],
      danhSachDonMuon: donMuonResult.jsonArray || [],
    };

    return {
      status: "Success",
      statusCode: 200,
      data: responseData,
      message: "Lấy dữ liệu tổng quan thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu tổng quan phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: null, // Trả về null hoặc một object rỗng trong trường hợp lỗi
      message: "Lỗi máy chủ khi lấy dữ liệu tổng quan phom.",
    };
  }
};


exports.updaterfidphom = async (companyname, payload) => {
  try {
    const RFID_Update = await db.Execute(
      companyname,
      `UPDATE Last_Data_Binding SET RFID = '${payload.RFID}' WHERE RFID_Shortcut = '${payload.RFID_Shortcut}'`
    );
    const results = await db.Execute(
      `select * from Last_Data_Binding where  RFID = '${payload.RFID}'`
    );

    if (results.rowCount === 0) {
      return {
        status: "Error",
        statusCode: 400,
        data: [],
        message: "Không tìm thấy phom nào với RFID đã cập nhật.",
      };
    }
    return {
      status: "Success",
      statusCode: 200,
      data: results.jsonArray,
      message: "Cập nhật RFID phom thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi cập nhật RFID phom:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi cập nhật RFID phom.",
    };
  }
};