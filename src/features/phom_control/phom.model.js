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
    LastMatNo, LastName, LastType, Material, LastSize;`,
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

exports.controlPhom = async (payload) => {
  console.log(payload);
  try {
    const results = await db.Execute(
      payload.companyName,
      `
    -- ===================================================================
    -- SET UP
    -- ===================================================================
    DECLARE @TargetLastNo NVARCHAR(50);
    SET @TargetLastNo = '${payload.LastNo}'; 
    -- ===================================================================
    DECLARE @columns NVARCHAR(MAX) = '';
    DECLARE @columns_divided NVARCHAR(MAX) = '';
    DECLARE @sum_columns_divided NVARCHAR(MAX) = '';
    DECLARE @sql NVARCHAR(MAX) = '';

    -- Bước 1: Tạo các chuỗi động (Không thay đổi)
    SELECT @columns += QUOTENAME(LastSize) + ','
    FROM (SELECT DISTINCT LastSize FROM Last_Data_Binding) AS Sizes
    ORDER BY LastSize;
    SET @columns = LEFT(@columns, LEN(@columns) - 1);

    SELECT @columns_divided += 'CAST(ROUND(ISNULL(' + QUOTENAME(LastSize) + ', 0) / 2.0, 1) AS DECIMAL(18, 1)) AS ' + QUOTENAME(LastSize) + ','
    FROM (SELECT DISTINCT LastSize FROM Last_Data_Binding) AS Sizes
    ORDER BY LastSize;
    SET @columns_divided = LEFT(@columns_divided, LEN(@columns_divided) - 1);

    SELECT @sum_columns_divided += 'CAST(ROUND(SUM(ISNULL(' + QUOTENAME(LastSize) + ', 0)) / 2.0, 1) AS DECIMAL(18, 1)) AS ' + QUOTENAME(LastSize) + ','
    FROM (SELECT DISTINCT LastSize FROM Last_Data_Binding) AS Sizes
    ORDER BY LastSize;
    SET @sum_columns_divided = LEFT(@sum_columns_divided, LEN(@sum_columns_divided) - 1);


    -- Bước 2: Xây dựng câu lệnh truy vấn PIVOT động
    SET @sql = N'
    -- CTE 1: Tính số lượng chưa trả (vẫn cần DepID để join)
    WITH PivotedResult AS (
        SELECT
            DepID, LastNo, ' + @columns + '
        FROM (
            SELECT lso.DepID, b.LastNo, b.LastSize
            FROM Last_Data_Binding AS b
            INNER JOIN (
                SELECT RFID, DepID, ROW_NUMBER() OVER(PARTITION BY RFID ORDER BY ScanDate DESC, ID_bill DESC) as rn
                FROM Last_Detail_Scan_Out
            ) AS lso ON b.RFID = lso.RFID AND lso.rn = 1
            WHERE
                b.isOut = 1
                AND (@DynamicLastNo IS NULL OR b.LastNo = @DynamicLastNo)
        ) AS DataSource
        PIVOT (COUNT(LastSize) FOR LastSize IN (' + @columns + ')) AS PivotedTable
    ),
    -- CTE 2: Tính tổng tồn kho
    InventoryResult AS (
        SELECT
            LastNo, ' + @columns + '
        FROM (
            SELECT LastNo, LastSize FROM Last_Data_Binding
            WHERE (@DynamicLastNo IS NULL OR LastNo = @DynamicLastNo)
        ) AS DataSource
        PIVOT (COUNT(LastSize) FOR LastSize IN (' + @columns + ')) AS PivotedTable
    )

    -- Bước cuối: Kết hợp tất cả lại, chỉ hiển thị DepName
    -- Thay thế DepID bằng DepName trong danh sách cột
    SELECT DepName, LastNo, ' + @columns + '
    FROM (
        -- Hàng 1: Tổng tồn kho
        SELECT
            1 AS SortOrder,
            ''Total Inventory'' AS DepName, -- Thay thế DepID bằng DepName
            @DynamicLastNo AS LastNo,
            ' + @columns_divided + '
        FROM InventoryResult

        UNION ALL

        -- Hàng 2: Chi tiết số lượng chưa trả
        SELECT
            2 AS SortOrder,
            bd.DepName, -- Chỉ chọn DepName
            pr.LastNo,
            ' + @columns_divided + '
        FROM
            PivotedResult pr
            LEFT JOIN BDepartment bd ON pr.DepID = bd.ID -- Join để lấy DepName

        UNION ALL

        -- Hàng 3: Tổng số lượng chưa trả
        SELECT
            3 AS SortOrder,
            ''Total'' AS DepName, -- Thay thế DepID bằng DepName
            @DynamicLastNo AS LastNo,
            ' + @sum_columns_divided + '
        FROM PivotedResult
    ) AS FinalResult
    ORDER BY SortOrder, DepName; -- Sắp xếp theo DepName
    ';

    -- Bước 3: Thực thi câu lệnh, TRUYỀN THAM SỐ VÀO
    EXEC sp_executesql @sql,
        N'@DynamicLastNo NVARCHAR(50)',
        @DynamicLastNo = @TargetLastNo;
`,
    );
    if (!results || results.jsonArray.length === 0) {
      console.error("Không có dữ liệu hoặc jsonArray trả về từ cơ sở dữ liệu.");
      return {
        status: "Error",
        statusCode: 404,
        data: [],
        message: "Không tìm thấy thông tin thống kê.",
      };
    }
    return {
      status: "Success",
      statusCode: 200,
      data: results.jsonArray,
      message: "Lấy thông tin thống kê thành công.",
    };
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

exports.statisticalParameters = async (payload) => {
  console.log(payload);
  try {
    const statisticData = await db.Execute(
      payload.companyName,
      `
      SELECT 
    sub.*,
    CAST((sub.DangSuDung * 100.0 / sub.TongSoLuong) AS decimal(10,3)) as TyLeSD,
    CAST((sub.PhomMat * 100.0 / sub.TongSoLuong) AS decimal(10,3)) as TyLeThatLac
FROM (
    SELECT 
        CAST(COUNT(*) / 2.0 AS DECIMAL(10,1)) AS TongSoLuong,
        (SELECT CAST(COUNT(*) / 2.0 AS DECIMAL(10,1)) 
         FROM Last_Data_Binding WHERE isOut='1') AS DangSuDung,
        (SELECT CAST(COUNT(*) / 2.0 AS DECIMAL(10,1)) 
         FROM Last_Data_Binding WHERE isOut='0') AS TonKho,
        (SELECT CAST(COUNT(*) / 2.0 AS DECIMAL(10,1)) 
         FROM Last_Data_Binding WHERE isLost='1') AS PhomMat
    FROM Last_Data_Binding ldb
) as sub;
      `,
    );

    if (!statisticData || !statisticData.jsonArray) {
      console.warn("Không có dữ liệu hoặc jsonArray trả về từ cơ sở dữ liệu.");
      return {
        status: "Error",
        statusCode: 404,
        data: [],
        message: "Không tìm thấy thông tin thống kê.",
      };
    }
    return {
      status: "Success",
      statusCode: 200,
      data: statisticData.jsonArray,
      message: "Lấy thông tin thống kê thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin thống kê:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy thông tin thống kê.",
    };
  }
};

exports.statisticalParametersColumn = async (payload) => {
  if (payload.month == "" || payload.year == "") {
    const result = await db.Execute(
      payload.companyName,
      `
        DECLARE @Year INT = NULL;
        DECLARE @Month INT = NULL; 

        SELECT 
            CASE 
                WHEN @Year IS NOT NULL AND @Month IS NOT NULL 
                    THEN CONCAT(@Year, '-', RIGHT('00' + CAST(@Month AS VARCHAR(2)), 2)) 
                ELSE 'All' 
            END AS YearMonth,
            bd.DepName,
            COUNT(*)/2 AS TotalCount
        FROM Last_Detail_Scan_Out ldso
        left join BDepartment bd on ldso.DepID = bd.ID
        WHERE (@Year IS NULL OR YEAR(ScanDate) = @Year)
          AND (@Month IS NULL OR MONTH(ScanDate) = @Month)
        GROUP BY ldso.DepID, bd.DepName;`,
    );
    return {
      status: "Success",
      statusCode: 200,
      data: result.jsonArray,
      message: "Lấy thông tin thống kê thành công.",
    };
  } else {
    const result = await db.Execute(
      payload.companyName,
      `
        DECLARE @Year INT = ${payload.year};
        DECLARE @Month INT = ${payload.month}; 

        SELECT 
            CASE 
                WHEN @Year IS NOT NULL AND @Month IS NOT NULL 
                    THEN CONCAT(@Year, '-', RIGHT('00' + CAST(@Month AS VARCHAR(2)), 2)) 
                ELSE 'All' 
            END AS YearMonth,
            bd.DepName,
            COUNT(*)/2 AS TotalCount
        FROM Last_Detail_Scan_Out ldso
        left join BDepartment bd on ldso.DepID = bd.ID
        WHERE (@Year IS NULL OR YEAR(ScanDate) = @Year)
          AND (@Month IS NULL OR MONTH(ScanDate) = @Month)
        GROUP BY ldso.DepID, bd.DepName;`,
    );
    return {
      status: "Success",
      statusCode: 200,
      data: result.jsonArray,
      message: "Lấy thông tin thống kê thành công.",
    };
  }
};
exports.statisticalPhomBinding = async (payload) => {
  if (payload.year == "") {
    return {
      status: "Error",
      statusCode: 400,
      data: [],
      message: "Vui lòng chọn năm để thống kê.",
    };
  }
  const result = await db.Execute(
    payload.companyName,
    `
    DECLARE @Year INT = ${payload.year};
   
;WITH MonthlyOut AS (
    SELECT 
        YEAR(ScanDate) AS Y,
        MONTH(ScanDate) AS M,
        COUNT(DISTINCT RFID) AS OutCount
    FROM Last_Detail_Scan_Out
    WHERE YEAR(ScanDate) = @Year
    GROUP BY YEAR(ScanDate), MONTH(ScanDate)
),
MonthlyReturn AS (
    SELECT 
        YEAR(ScanDate) AS Y,
        MONTH(ScanDate) AS M,
        COUNT(DISTINCT RFID) AS ReturnCount
    FROM Details_Last_Scan_Return
    WHERE YEAR(ScanDate) = @Year
    GROUP BY YEAR(ScanDate), MONTH(ScanDate)
),
AllMonths AS (
    -- hợp nhất cả Out và Return để tránh thiếu tháng
    SELECT DISTINCT Y, M FROM MonthlyOut
    UNION
    SELECT DISTINCT Y, M FROM MonthlyReturn
)
SELECT 
    am.Y,
    am.M,
    ISNULL(mo.OutCount, 0) AS SoMuonTrongThang,
    ISNULL(mr.ReturnCount, 0) AS SoTraTrongThang,
    (SELECT COUNT(DISTINCT RFID) FROM Last_Data_Binding)
      - SUM(ISNULL(mo.OutCount,0)) OVER (ORDER BY am.Y, am.M)
      + SUM(ISNULL(mr.ReturnCount,0)) OVER (ORDER BY am.Y, am.M) AS TonCuoiThang
FROM AllMonths am
LEFT JOIN MonthlyOut mo ON am.Y = mo.Y AND am.M = mo.M
LEFT JOIN MonthlyReturn mr ON am.Y = mr.Y AND am.M = mr.M
ORDER BY am.Y, am.M;

    `,
  );
  if (!result || !result.jsonArray) {
    return {
      status: "Error",
      statusCode: 404,
      data: [],
      message: "Không tìm thấy thông tin thống kê.",
    };
  }
  return {
    status: "Success",
    statusCode: 200,
    data: result.jsonArray,
    message: "Lấy thông tin thống kê thành công.",
  };
};
exports.getInforPhomBinding = async (companyname) => {
  console.log(companyname);
  try {
    const results = await db.Execute(
      companyname,
      `
    SELECT *,
       SUM(SL) OVER() AS TongSL,sum(SL_0) OVER() as Tong_TonKho
FROM (
    SELECT 
        ldb.LastMatNo,
        ldb.LastNo,
        ldb.LastSize,
		ldb.Material,
        CAST(COUNT(ldb.LastSize) / 2.0 AS DECIMAL(10,1)) AS SL,
		CAST(COUNT(CASE WHEN ldb.isOut = 0 THEN ldb.LastSize END) / 2.0 AS DECIMAL(10,1)) AS SL_0
    FROM Last_Data_Binding ldb
    GROUP BY ldb.LastMatNo, ldb.LastNo, ldb.LastSize,ldb.Material
) AS sub
ORDER BY sub.LastNo DESC;




      `,
    );
    const rows = results.jsonArray;
    console.log("rows", rows);
    // Gom nhóm theo LastNo
    const grouped = Object.values(
      rows.reduce((acc, row) => {
        if (!acc[row.LastNo]) {
          acc[row.LastNo] = {
            code: row.LastMatNo,
            name: row.LastNo,
            material: row.Material,
            TongPhom: row.TongSL,
            TongTonKho: row.Tong_TonKho,
            details: [],
          };
        }
        acc[row.LastNo].details.push({
          size: row.LastSize,
          quantity: row.SL,
          stock: row.SL_0,
        });
        return acc;
      }, {}),
    );

    return {
      status: "Thành công",
      statusCode: 200,
      data: grouped,
      message: "Lấy thông tin phom thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin phom binding:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy thông tin phom binding.",
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
    bu.Person_Name AS BorrowerName,         
    ldb.OfficerId, 
    officer.Person_Name AS OfficerName,        -- Người xử lý/Officer
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
LEFT JOIN HRIS.HRIS.DBO.DATA_PERSON bu ON ldb.Userid = bu.Person_ID
LEFT JOIN HRIS.HRIS.DBO.DATA_PERSON officer ON ldb.OfficerId = officer.Person_ID
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
    WHERE lds.StateScan = 0
    GROUP BY lds.ID_bill, ldb.LastMatNo, ldb.LastSize
) AS ScannedData 
    ON dldb.ID_bill = ScannedData.ID_bill 
    AND dldb.LastMatNo = ScannedData.LastMatNo 
    AND dldb.LastSize = ScannedData.LastSize`,
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
      `SELECT DISTINCT LastSize FROM LastNoD where LastMatNo = '${LastmatNo}' group by LastSize`,
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
      `select LastMatNo from LastNoEntry group by LastMatNo`,
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

exports.getDetailsBillScanOut = async (companyname, payload) => {
  const ID_BILL = payload.ID_BILL;

  try {
    const results = await db.Execute(
      companyname,
      `select scan.*,reg.LastSum
from
(SELECT 
        ldso.ID_bill,
        ldb.LastMatNo,
        ldb.LastNo,
        ldb.LastName,
        ldb.LastSize,
        ldso.DepID,
        ROUND(CAST(COUNT(ldso.RFID)/2 AS DECIMAL(10,1)), 1) AS SoLuong
      FROM Last_Data_Binding ldb
      JOIN Last_Detail_Scan_Out ldso 
      ON ldb.RFID = ldso.RFID
      WHERE ldso.ID_bill = '${ID_BILL}'
      GROUP BY ldb.LastMatNo, ldb.LastName, ldb.LastSize,ldb.LastNo,ldso.ID_bill,ldso.DepID) scan
join Detail_Last_Data_Bill reg on scan.ID_bill = reg.ID_bill and scan.LastMatNo=reg.LastMatNo and reg.LastSize=scan.LastSize

`,
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

exports.updaterfidphom = async (companyname, payload) => {
  try {
    const RFID_Update = await db.Execute(
      companyname,
      `UPDATE Last_Data_Binding SET RFID = '${payload.RFID}' WHERE RFID_Shortcut = '${payload.RFID_Shortcut}'`,
    );
    const results = await db.Execute(
      `select * from Last_Data_Binding where  RFID = '${payload.RFID}'`,
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
// model
exports.saveBill = async (companyName, body) => {
  const LO = await db.Execute(companyName, `EXEC sp_GenerateLastInOutNo`);
  const LastInOutNo = LO.jsonArray[0].NewLastInOutNo;

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
        `SELECT * FROM Last_Detail_Scan_Out WHERE RFID = '${payload.RFID}' and ID_BILL='${payload.ID_BILL}'`,
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
        `INSERT INTO Last_Detail_Scan_Out (ID_BILL, DepID, RFID, ScanDate, StateScan, LastInOutNo,USERID)
         VALUES ('${payload.ID_BILL}', '${payload.DepID}', '${payload.RFID}', GETDATE(), '${payload.StateScan}', '${LastInOutNo}', '${ReceiverCardNumber}')`,
      );
      await db.Execute(
        companyName,
        `UPDATE Last_Data_Bill SET StateLastBill = 1 WHERE ID_bill = '${payload.ID_BILL}'`,
      );
      await db.Execute(
        companyName,
        `UPDATE Last_Data_Bill SET LastInOutNo = '${LastInOutNo}' WHERE ID_bill = '${payload.ID_BILL}'`,
      );
      await db.Execute(
        companyName,
        `UPDATE Last_Data_Binding SET isOut = 1 WHERE RFID = '${payload.RFID}'`,
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
    `UPDATE Last_Data_Bill SET ToTalPhomNotBinding = '${body.ToTalPhomNotBinding}' WHERE ID_bill = '${scannedRfidDetailsList[0].ID_BILL}'`,
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
`,
  );

  const ListDataInOutNo = dataInsertLastInOutNo.jsonArray;

  const LastSumQty = ListDataInOutNo.reduce((acc, item) => {
    return acc + parseFloat(item.QtySide); // sử dụng parseFloat để cộng 0.5
  }, 0);

  await db.Execute(
    companyName,
    `
  INSERT INTO LastInOut_M 
  (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo) 
  VALUES (
    '${LastInOutNo}', ${LastSumQty}, '${ListDataInOutNo[0].Userid}', 
    GETDATE(), 'Y', '${ListDataInOutNo[0].LastMatNo}'
  )
`,
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
`,
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
    `,
      );
    } catch (error) {
      console.error("Lỗi khi xử lý dữ liệu LastInOutNo:", error);
    }
  }
  console.log("Success List:", successList);
  console.log("Failed List:", failedList);
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
    LastMatNo, LastName, LastType, Material, LastSize;`,
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
`,
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
      `SELECT LastName From LastNoM where LastMatNo = '${LastMatNo}'`,
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
      `select DISTINCT LastSize from Last_Data_Bill where LastMatNo= '${LastMatNo}' ORDER BY LastSize DESC`,
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
      `SELECT ID,DepName FROM BDepartment`,
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

exports.getAllLastNo = async (companyname) => {
  try {
    const results = await db.Execute(
      companyname,
      `SELECT LastNo,LastMatNo FROM Last_Data_Binding group by LastNo,LastMatNo`,
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
    return {
      status: "Success",
      statusCode: 200,
      data: results,
      message: "Lấy tất cả phom thành công",
    };
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
      CAST(
  (
    SELECT COUNT(*) 
    FROM Last_Data_Binding ldb 
    WHERE ldb.LastMatNo = sub.LastMatNo 
      AND ldb.LastName = lnm.LastName 
      AND ldb.LastSize = sub.LastSize
  ) / 2.0 AS DECIMAL(10,1)
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
      `,
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
        `SELECT * FROM Last_Data_Binding WHERE RFID = '${item.RFID}'`,
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
        (RFID, LastMatNo, LastName, LastNo, LastType, Material, LastSize, LastSide, UserID, ShelfName, DateIn,RFID_Shortcut)
        VALUES (
          '${item.RFID}', '${item.LastMatNo}', '${item.LastName}', '${item.LastNo}',
          '${item.LastType}', '${item.Material}', '${item.LastSize}', '${item.LastSide}',
          '${item.UserID}', '${item.ShelfName}', GETDATE(), '${item.RFIDShortcut}'
        )
        `,
      );

      const insertedData = await db.Execute(
        companyname,
        `SELECT * FROM Last_Data_Binding WHERE RFID = '${item.RFID}'`,
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

exports.checkExitsRFID = async (companyName, ListRFID) => {
  try {
    const failedList = [];
    for (const rfid of ListRFID) {
      const results = await db.Execute(
        companyName,
        `SELECT * FROM Last_Data_Binding WHERE RFID = '${rfid}'`,
      );
      if (results && results.jsonArray.length > 0) {
        failedList.push({ data: results.jsonArray });
      }
    }
    if (failedList && failedList.length > 0) {
      return {
        status: "Exists",
        statusCode: 400,
        data: failedList,
        message: `Đã có phom tồn tại trong hệ thống`,
      };
    }
    return {
      status: "NotExists",
      statusCode: 200,
      data: [],
      message: "Không có phom nào tồn tại trong hệ thống.",
    };
  } catch (error) {
    console.error("Lỗi khi kiểm tra RFID:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi kiểm tra RFID.",
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
      LastNo,
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
        LastNo = '${LastNo}',
        Material = '${Material}',
        LastSize = '${LastSize}',
        LastSide = '${LastSide}',
        UserID = '${UserID}',
        ShelfName = '${ShelfName}',
        DateIn = GETDATE()
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
      `SELECT * FROM Last_Data_Scan_Temp WHERE RFID = '${RFID}'`,
    );

    if (results.rowCount === 0) {
      // Không có dữ liệu RFID => INSERT mới
      await db.Execute(
        companyname,
        `INSERT INTO Last_Data_Scan_Temp (RFID, isOutScan, DateIn, DateOut)
         VALUES ('${RFID}', 1, '1900-01-01', GETDATE())
               `,
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
           WHERE RFID = '${RFID}'`,
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
          @OfficerId = '${payload.OfficerId}'`,
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
                @LastSum = ${item.LastSum};`,
        );
      }
    }
    const results = await db.Execute(
      companyname,
      `select * from Last_Data_Bill where ID_bill = '${ID_Bill}'`,
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
      `select * from Last_Data_Bill where ID_bill='${payload.ID_BILL}'`,
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
        `select * from Detail_Last_Data_Bill where ID_bill = '${ID_Bill}'`,
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
      `SELECT * FROM Last_Data_Binding WHERE RFID = '${payload.RFID}'`,
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

exports.quickScanBorrow = async (companyname, payload) => {
  try {
    const depID = payload.DepID;
    const userID = payload.UserID || payload.userId || "SYSTEM";
    const officerId = payload.OfficerId || "";
    const epcListRaw = payload.EPCList || payload.epcList || payload.ListEPC || [];

    if (!companyname || !depID || !Array.isArray(epcListRaw) || epcListRaw.length === 0) {
      return {
        status: "Error",
        statusCode: 400,
        data: [],
        message: "Thiếu companyName, DepID hoặc danh sách EPC.",
      };
    }

    const epcList = [...new Set(epcListRaw.map((x) => `${x}`.trim()).filter(Boolean))];
    if (epcList.length === 0) {
      return {
        status: "Error",
        statusCode: 400,
        data: [],
        message: "Danh sách EPC không hợp lệ.",
      };
    }

    const inClause = epcList.map((epc) => `'${epc.replace(/'/g, "''")}'`).join(",");
    const phomData = await db.Execute(
      companyname,
      `SELECT RFID, LastMatNo, LastNo, LastSize, LastSide, isOut, isLost
       FROM Last_Data_Binding
       WHERE RFID IN (${inClause})`,
    );

    const foundList = phomData?.jsonArray || [];
    const foundMap = new Map(foundList.map((item) => [item.RFID, item]));

    const notFoundEPC = epcList.filter((epc) => !foundMap.has(epc));
    const outEPC = foundList.filter((x) => Number(x.isOut) === 1).map((x) => x.RFID);
    const lostEPC = foundList
      .filter((x) => x.isLost === 1 || x.isLost === "1" || x.isLost === true)
      .map((x) => x.RFID);

    const validList = foundList.filter(
      (x) =>
        Number(x.isOut) !== 1 &&
        !(x.isLost === 1 || x.isLost === "1" || x.isLost === true),
    );

    if (validList.length === 0) {
      return {
        status: "Error",
        statusCode: 400,
        data: [],
        invalidEPC: {
          notFoundEPC,
          outEPC,
          lostEPC,
        },
        message: "Không có EPC hợp lệ để tạo phiếu mượn.",
      };
    }

    const matNoGroupMap = {};
    for (const item of validList) {
      if (!matNoGroupMap[item.LastMatNo]) {
        matNoGroupMap[item.LastMatNo] = [];
      }
      matNoGroupMap[item.LastMatNo].push(item);
    }

    const dateBorrow = payload.DateBorrow || new Date().toISOString().slice(0, 19).replace("T", " ");
    const dateReceive = payload.DateReceive || dateBorrow;

    const createdBills = [];
    for (const [lastMatNo, matNoItems] of Object.entries(matNoGroupMap)) {
      const groupedMap = {};
      for (const item of matNoItems) {
        const key = `${item.LastMatNo}__${item.LastNo}__${item.LastSize}`;
        if (!groupedMap[key]) {
          groupedMap[key] = {
            LastMatNo: item.LastMatNo,
            LastName: item.LastNo,
            LastSize: item.LastSize,
            LastSum: 0,
          };
        }

        const step = item.LastSide === "Left" || item.LastSide === "Right" ? 0.5 : 1;
        groupedMap[key].LastSum = Number(groupedMap[key].LastSum) + step;
      }

      const details = Object.values(groupedMap);

      const createBill = await db.Execute(
        companyname,
        `EXEC Insert_Last_Data_Bill
            @Userid = '${userID}',
            @DepID = '${depID}',
            @DateBorrow = '${dateBorrow}',
            @DateReceive = '${dateReceive}',
            @LastMatNo = '${lastMatNo}',
            @isConfirm = 1,
            @StateLastBill = 0,
            @OfficerId = '${officerId}'`,
      );

      const ID_BILL = createBill?.jsonArray?.[0]?.ID_bill;
      if (!ID_BILL) {
        return {
          status: "Error",
          statusCode: 500,
          data: [],
          message: `Không tạo được phiếu mượn cho LastMatNo ${lastMatNo}.`,
        };
      }

      for (const item of details) {
        await db.Execute(
          companyname,
          `EXEC Insert_Detail_Last_Data_Bill
              @ID_bill = '${ID_BILL}',
              @DepID = '${depID}',
              @LastMatNo = '${item.LastMatNo}',
              @LastName = N'${item.LastName}',
              @LastSize = '${item.LastSize}',
              @LastSum = ${item.LastSum}`,
        );
      }

      const LO = await db.Execute(companyname, `EXEC sp_GenerateLastInOutNo`);
      const LastInOutNo = LO?.jsonArray?.[0]?.NewLastInOutNo;

      for (const item of matNoItems) {
        await db.Execute(
          companyname,
          `INSERT INTO Last_Detail_Scan_Out (ID_BILL, DepID, RFID, ScanDate, StateScan, LastInOutNo, USERID)
           VALUES ('${ID_BILL}', '${depID}', '${item.RFID}', GETDATE(), 0, '${LastInOutNo}', '${userID}')`,
        );

        await db.Execute(
          companyname,
          `UPDATE Last_Data_Binding SET isOut = 1 WHERE RFID = '${item.RFID}'`,
        );
      }

      await db.Execute(
        companyname,
        `UPDATE Last_Data_Bill
         SET StateLastBill = 1,
             LastInOutNo = '${LastInOutNo}',
             ToTalPhomNotBinding = 0
         WHERE ID_bill = '${ID_BILL}'`,
      );

      const lastInOutQty = details.reduce((acc, item) => acc + Number(item.LastSum || 0), 0);

      await db.Execute(
        companyname,
        `INSERT INTO LastInOut_M (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo)
         VALUES ('${LastInOutNo}', ${lastInOutQty}, '${userID}', GETDATE(), 'Y', '${lastMatNo}')`,
      );

      await db.Execute(
        companyname,
        `INSERT INTO LastInOut_A (LastInOutNo, LastInOutDate, LastInOutType, LastInOutItem, LastLocation, Printed, YN, CreID, CreDate, CfmID, CfmDate)
         VALUES ('${LastInOutNo}', GETDATE(), 'Out', 'BorrowOut', '${depID}', NULL, 'Y', '${userID}', GETDATE(), NULL, NULL)`,
      );

      for (const item of details) {
        await db.Execute(
          companyname,
          `INSERT INTO LastInOut_D (LastInOutNo, LastSize, LastQty, YN, CreID, CreDate, Country, LastMatNo)
           VALUES ('${LastInOutNo}', '${item.LastSize}', ${Number(item.LastSum || 0)}, 'Y', '${userID}', GETDATE(), 'ZZZZ', '${item.LastMatNo}')`,
        );
      }

      createdBills.push({
        ID_BILL,
        LastInOutNo,
        DepID: depID,
        LastMatNo: lastMatNo,
        details,
        scannedEPC: matNoItems.map((x) => x.RFID),
      });
    }

    return {
      status: "Success",
      statusCode: 200,
      data: {
        DepID: depID,
        totalBills: createdBills.length,
        bills: createdBills,
      },
      invalidEPC: {
        notFoundEPC,
        outEPC,
        lostEPC,
      },
      message: "Scan nhanh thành công.",
    };
  } catch (error) {
    console.error("Lỗi quickScanBorrow:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi scan nhanh phiếu mượn.",
    };
  }
};

exports.getRFIDPhom = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `
select * from Last_Data_Binding where RFID='${payload.RFID}'
`,
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
    WHERE ldb.ID_bill = '${payload.ID_BILL}';`,
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
          where rb.ID_BILL='${results.jsonArray[0].ID_bill}'`,
      );
      const lastdatabill = await db.Execute(
        companyname,
        `select * from Last_Data_Bill where ID_bill='${payload.ID_BILL}'`,
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
    `SELECT * FROM Return_Bill WHERE ID_BILL = '${payload.ID_BILL}'`,
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
      @ReturnRequestDate = '${payload.ReturnRequestDate}'`,
  );
  const checkInsert = await db.Execute(
    companyname,
    `SELECT * FROM Return_Bill WHERE ID_BILL = '${payload.ID_BILL}'`,
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
  try {
    const results = await db.Execute(
      companyname,
      `
SELECT 
    ldb.LastNo,
    ldb.LastSize,
    ldb.LastSide,
    ldb.RFID_Shortcut,
    CASE 
        WHEN ISNULL(o.OutCount, 0) = 0 THEN -1
        ELSE ISNULL(o.OutYN, 0) + ISNULL(r.ReturnYN, 0)
    END AS isReturn
FROM Last_Data_Binding ldb
LEFT JOIN (
    SELECT RFID, COUNT(*) AS OutCount, SUM(YN) AS OutYN
    FROM Last_Detail_Scan_Out
    GROUP BY RFID
) o ON o.RFID = ldb.RFID
LEFT JOIN (
    SELECT RFID, SUM(YN) AS ReturnYN
    FROM Details_Last_Scan_Return
    GROUP BY RFID
) r ON r.RFID = ldb.RFID
WHERE ldb.RFID = '${payload.RFID}';
`,
    );
    console.log("results", results);
    if (results.jsonArray[0].isReturn === -1) {
      return {
        status: -1,
        statusCode: 500,
        data: results.jsonArray,
        message: "Phom chưa được mượn",
      };
    }
    if (results.jsonArray[0].isReturn === 1) {
      return {
        status: 1,
        statusCode: 200,
        data: results.jsonArray,
        message: "Hợp lệ để trả",
      };
    }
    if (results.jsonArray[0].isReturn === 0) {
      return {
        status: 0,
        statusCode: 200,
        data: results.jsonArray,
        message: "Không hợp lệ, phom đã được trả",
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
  console.log("DEBUG payload:", JSON.stringify(payload));

  // 1. Sinh số Return mới
  const LastInOutNo = await db.Execute(
    companyname,
    `EXEC sp_GenerateLastInOutNo`,
  );
  const NewLastInOutNo = LastInOutNo.jsonArray[0].NewLastInOutNo;

  try {
    const resultsInsert = [];

    for (const RFID of payload.RFID_LIST) {
  // insert return
  await db.Execute(
    companyname,
    `
    INSERT INTO Details_Last_Scan_Return
        (ID_Return, RFID, ScanDate, YN, DepID)
    VALUES
        ('${NewLastInOutNo}', '${RFID}', GETDATE(), -1, '${payload.DepID}')
    `
  );

  // Update binding
  await db.Execute(
    companyname,
    `
    UPDATE Last_Data_Binding
    SET isOut = 0
    WHERE RFID = '${RFID}'
    `
  );

  // Trả kết quả cho API
  resultsInsert.push({
    RFID,
    Status: "Returned",
  });
}

    // 5. Gom dữ liệu chi tiết Last
    const DataLastInOut = await db.Execute(
      companyname,
      `SELECT 
          ldb.LastMatNo,
          ldb.LastSize,
          COUNT(*) as lastsum,
          COUNT(*) * 0.5 AS LastQty
        FROM Details_Last_Scan_Return dlsr
        JOIN Last_Data_Binding ldb ON dlsr.RFID = ldb.RFID
        WHERE dlsr.ID_Return='${NewLastInOutNo}'
        GROUP BY ldb.LastMatNo, ldb.LastSize;`,
    );

    const newDetaLastInOut = DataLastInOut.jsonArray;

    // 6. Insert LastInOut_M
    await db.Execute(
      companyname,
      `INSERT INTO LastInOut_M (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo)
       VALUES ('${NewLastInOutNo}', ${parseFloat(payload.RFID_LIST.length)}, '${
         payload.Userid
       }', GETDATE(), 'Y', '${newDetaLastInOut[0].LastMatNo}')`,
    );

    // 7. Insert LastInOut_A
    await db.Execute(
      companyname,
      `INSERT INTO LastInOut_A (LastInOutNo, LastInOutDate, LastInOutType, LastInOutItem, LastLocation, Printed, YN, CreID, CreDate, CfmID, CfmDate)
       VALUES ('${NewLastInOutNo}', GETDATE(), 'Return', 'BorrowReturn', '${payload.DepID}', NULL, 'Y', '${payload.Userid}', GETDATE(), NULL, NULL)`,
    );

    // 8. Insert LastInOut_D
    for (const item of newDetaLastInOut) {
      await db.Execute(
        companyname,
        `INSERT INTO LastInOut_D (LastInOutNo, LastSize, LastQty, YN, CreID, CreDate, Country, LastMatNo)
         VALUES ('${NewLastInOutNo}', '${item.LastSize}', ${item.LastQty}, 'Y', '${payload.Userid}', GETDATE(), 'ZZZZ', '${item.LastMatNo}')`,
      );
    }

    return {
      status: "Success",
      statusCode: 200,
      message: "Xử lí thành công đơn trả. Tổng số phom trả: " + payload.RFID_LIST.length,
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
       WHERE ID_bill = '${payload.ID_bill}'`,
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
      WHERE ldb.Userid = '${payload}'`,
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
      WHERE rb.Userid = '${payload}'`,
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
    AND dldb.LastSize = UnreturnedRFIDs.LastSize;`,
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
    STUFF((
        SELECT ',' + ldb2.RFID
        FROM Last_Data_Binding ldb2
        WHERE ldb2.LastNo = ldb.LastNo 
          AND ldb2.LastSize = ldb.LastSize
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 1, '') AS RFID_List,

    MIN(ldb.LastMatNo) AS LastMatNo,
    MIN(ldb.LastName)  AS LastName,
    MIN(ldb.Material)  AS Material,
    MIN(ldb.LastType)  AS LastType,
    MIN(ldb.DateIn)    AS DateIn,
    MIN(ldb.UserID)    AS UserID,

    COUNT(*) AS TotalQty,
    CAST(COUNT(*) / 2.0 AS DECIMAL(10,1)) AS TotalPairs,

    -- Tổng số chiếc còn trong kho
    SUM(CASE WHEN ldb.isOut = 0 THEN 1 ELSE 0 END) AS QtyInStock_Total,
    CAST(SUM(CASE WHEN ldb.isOut = 0 THEN 1 ELSE 0 END) / 2.0 AS DECIMAL(10,1)) AS QtyInStock_Pairs,

    -- Tổng số mượn (số đôi)
    CAST((
        SELECT COUNT(*) / 2.0
        FROM Last_Detail_Scan_Out lso
        INNER JOIN Last_Data_Binding ldbx ON ldbx.RFID = lso.RFID
        WHERE ldbx.LastNo = ldb.LastNo 
          AND ldbx.LastSize = ldb.LastSize
    ) AS DECIMAL(10,1)) AS TotalBorrowed_Pairs,

    -- Tổng số trả (số đôi)
    CAST((
        SELECT COUNT(*) / 2.0
        FROM Details_Last_Scan_Return lsr
        INNER JOIN Last_Data_Binding ldbx ON ldbx.RFID = lsr.RFID
        WHERE ldbx.LastNo = ldb.LastNo 
          AND ldbx.LastSize = ldb.LastSize
    ) AS DECIMAL(10,1)) AS TotalReturned_Pairs

FROM
    Last_Data_Binding ldb
GROUP BY
    ldb.LastNo,
    ldb.LastSize
ORDER BY
    ldb.LastNo,
    ldb.LastSize;
`,
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
      `,
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
      "==============CAP NHAT STATE AND ID PHIEU MUON CHI TIET==========================",
    );
    for (var item of payload.BILL_BORROW.RFIDDetails) {
      await db.Execute(
        companyname,
        `UPDATE Last_Detail_Scan_Out SET ID_bill='${newIDBill}' WHERE RFID = '${item.RFID}'`,
      );
      await db.Execute(
        companyname,
        `UPDATE Last_Detail_Scan_Out SET DepID='${item.DepID}' WHERE RFID = '${item.RFID}'`,
      );
      await db.Execute(
        companyname,
        `UPDATE Last_Detail_Scan_Out SET StateScan=1 WHERE RFID = '${item.RFID}'`,
      );
    }

    const LO = await db.Execute(companyname, `EXEC sp_GenerateLastInOutNo`);
    const LastInOutNo = LO.jsonArray[0].NewLastInOutNo;

    const LastSumQty = payload.BILL_BORROW.scannedRfidDetailsList.reduce(
      (acc, item) => {
        return acc + (Number(item.LastSum) || 0);
      },
      0,
    );

    let borrowQtyForM = parseFloat(LastSumQty / 2);
    if (isNaN(borrowQtyForM)) {
      borrowQtyForM = 0;
    }

    await db.Execute(
      companyname,
      `
  INSERT INTO LastInOut_A (LastInOutNo, LastInOutDate, LastInOutType, LastInOutItem, LastLocation, Printed,
  YN, CreID, CreDate, CfmID, CfmDate) VALUES(
  '${LastInOutNo}',GETDATE(),'Out','BorrowOut', '${payload.BILL_BORROW.RFIDDetails[0].DepID}',NULL,'Y',
  '${payload.userId}',GETDATE(),NULL,NULL 
  )`,
    ); // Bỏ dấu ) thừa

    await db.Execute(
      companyname,
      `
  INSERT INTO LastInOut_M (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo) VALUES(
  '${LastInOutNo}', ${borrowQtyForM}, '${payload.userId}', GETDATE(), 'Y', '${payload.BILL_BORROW.RFIDDetails[0].LastMatNo}'
  )
`,
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
  `,
      );
    }
    console.log("==============XONG TẠO PHIẾU MƯỢN==========================");

    //========================XỬ LÍ TRẢ==========================
    console.log("==============TẠO PHIẾU TRẢ==========================");
    // !!! QUAN TRỌNG: Đảm bảo sp_GenerateLastInOutNo trả về ID mới khác với LastInOutNo ở trên
    const LO_Return = await db.Execute(
      companyname,
      `EXEC sp_GenerateLastInOutNo`,
    );
    const LastInOutNoReturn = LO_Return.jsonArray[0].NewLastInOutNo;

    // Ghi log để kiểm tra xem LastInOutNo và LastInOutNoReturn có khác nhau không
    console.log(`Generated LastInOutNo for Borrow: ${LastInOutNo}`);
    console.log(`Generated LastInOutNo for Return: ${LastInOutNoReturn}`);

    if (LastInOutNo === LastInOutNoReturn) {
      console.error(
        "CRITICAL ERROR: sp_GenerateLastInOutNo returned the same ID for borrow and return operations. This will cause PK violations.",
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
  )`,
    ); // Bỏ dấu ) thừa

    await db.Execute(
      companyname,
      `
  INSERT INTO LastInOut_M (LastInOutNo, LastInOutQty, CreID, CreDate, YN, LastMatNo) VALUES(
  '${LastInOutNoReturn}', ${returnQtyForM}, '${payload.userId}', GETDATE(), 'Y', '${payload.BILL_RETURN[0].LastMatNo}'
  )
`,
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
  `,
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
      `UPDATE Last_Data_Binding SET RFID = '${payload.RFID}' WHERE RFID_Shortcut = '${payload.RFID_Shortcut}'`,
    );
    const results = await db.Execute(
      `select * from Last_Data_Binding where  RFID = '${payload.RFID}'`,
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

exports.getMissingPhom = async (companyname, payload) => {
  try {
    const results = await db.Execute(
      companyname,
      `WITH LastStatus AS (
    SELECT 
        BD.DepName AS DepName,
        ldb.RFID AS RFID_Check,
        ldb.LastNo AS LastNo,
        ldb.LastSize AS LastSize,
        dlsr.StatusRFIDReturn,
		ldb.isLost as isLost,
        dlsr.ScanDate,
        ROW_NUMBER() OVER (PARTITION BY dlsr.RFID ORDER BY dlsr.ScanDate DESC) AS rn
    FROM Details_Last_Scan_Return dlsr
    LEFT JOIN BDepartment BD ON BD.ID = dlsr.DepID
    LEFT JOIN Last_Data_Binding ldb ON ldb.RFID = dlsr.RFID
)
SELECT DepName, RFID_Check, LastNo, LastSize, ScanDate, StatusRFIDReturn,isLost
FROM LastStatus
WHERE rn = 1
  AND StatusRFIDReturn = 'Missing'
ORDER BY DepName,LastNo, LastSize

`,
    );
    if (results.rowCount === 0) {
      return {
        status: "NULL",
        statusCode: 203,
        data: [],
        message: "Không có phom nào bị mất.",
      };
    }
    return {
      status: "Success",
      statusCode: 200,
      data: results.jsonArray,
      message: "Danh sách phom mất.",
    };
  } catch (error) {
    console.error("Lỗi khi lấy phom missing:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi lấy phom missing.",
    };
  }
};

exports.confirmMissingPhom = async (companyname, payload) => {
  try {
    // xác định giá trị update
    const isLostValue = payload.isLost === true ? 1 : 0;

    // chạy update
    const results = await db.Execute(
      companyname,
      `UPDATE Last_Data_Binding
       SET isLost = ${isLostValue}
       OUTPUT INSERTED.*
       WHERE RFID = '${payload.RFID}'`,
    );

    if (results.rowCount === 0) {
      return {
        status: "Error",
        statusCode: 400,
        data: [],
        message: "Không tìm thấy phiếu missing nào.",
      };
    }

    return {
      status: "Success",
      statusCode: 200,
      data: results.jsonArray, // record vừa update trả về
      message:
        isLostValue === 1
          ? "Xác nhận phom mất thành công."
          : "Hủy trạng thái mất phom thành công.",
    };
  } catch (error) {
    console.error("Lỗi khi xác nhận phom missing:", error);
    return {
      status: "Error",
      statusCode: 500,
      data: [],
      message: "Lỗi khi xác nhận phom missing.",
    };
  }
};
