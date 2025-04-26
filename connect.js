const sql = require("mssql");
const { Connection, Request } = require("tedious");
require("dotenv").config();
// lhg
const config_lhg = {
  authentication: {
    options: {
      userName: process.env.LHG_USERNAME,
      password: process.env.LHG_PASSWORD,
    },
    type: "default",
  },
  server: process.env.LHG_HOST,
  options: {
    validateBulkLoadParameters: false,
    rowCollectionOnRequestCompletion: true,
    database: process.env.LHG_DATABASE_NAME,
    encrypt: false,
    requestTimeout: 300000,
  },
};

// lyv
const config_lyv = {
  authentication: {
    options: {
      userName: process.env.LYV_USERNAME,
      password: process.env.LYV_PASSWORD,
    },
    type: "default",
  },

  server: process.env.LYV_HOST,
  options: {
    validateBulkLoadParameters: false,
    rowCollectionOnRequestCompletion: true,
    database: process.env.LYV_DATABASE_NAME,
    encrypt: false,
    requestTimeout: 300000,
  },
};

// LVL
const config_lvl = {
  authentication: {
    options: {
      userName: process.env.LVL_USERNAME,
      password: process.env.LVL_PASSWORD,
    },
    type: "default",
  },

  server: process.env.LVL_HOST,
  options: {
    validateBulkLoadParameters: false,
    rowCollectionOnRequestCompletion: true,
    database: process.env.LVL_DATABASE_NAME,
    encrypt: false,
    requestTimeout: 300000,
  },
};

// JAZ
const config_jaz = {
  authentication: {
    options: {
      userName: process.env.JAZ_USERNAME,
      password: process.env.JAZ_PASSWORD,
    },
    type: "default",
  },

  server: process.env.JAZ_HOST,
  options: {
    validateBulkLoadParameters: false,
    rowCollectionOnRequestCompletion: true,
    database: process.env.JAZ_DATABASE_NAME,
    encrypt: false,
    requestTimeout: 300000,
  },
};

// JZS
const config_jzs = {
  authentication: {
    options: {
      userName: process.env.JZS_USERNAME,
      password: process.env.JZS_PASSWORD,
    },
    type: "default",
  },

  server: process.env.JZS_HOST,
  options: {
    validateBulkLoadParameters: false,
    rowCollectionOnRequestCompletion: true,
    database: process.env.JZS_DATABASE_NAME,
    encrypt: false,
    requestTimeout: 300000,
  },
};

// JZS
const config_lym = {
  authentication: {
    options: {
      userName: process.env.LYM_USERNAME,
      password: process.env.LYM_PASSWORD,
    },
    type: "default",
  },

  server: process.env.LYM_HOST,
  options: {
    validateBulkLoadParameters: false,
    rowCollectionOnRequestCompletion: true,
    database: process.env.LYM_DATABASE_NAME,
    encrypt: false,
    requestTimeout: 300000,
  },
};

const executeSQL = (companyName, sql) => {
  return new Promise((resolve, reject) => {
    var config;
    if (companyName == "lhg") {
      config = config_lhg;
    }
    if (companyName == "lyv") {
      config = config_lyv;
    }
    if (companyName == "lvl") {
      config = config_lvl;
    }
    if (companyName == "jaz") {
      config = config_jaz;
    }
    if (companyName == "jzs") {
      config = config_jzs;
    }
    if (companyName == "lym") {
      config = config_lym;
    }
    let connection = new Connection(config);
    connection.connect((err) => {
      if (err) {
        connection.close();
        reject(err);
      }
      const request = new Request(sql, (err, rowCount, rows) => {
        connection.close();
        if (err) {
          reject(err);
        } else {
          jsonArray = [];
          rows.forEach(function (columns) {
            var rowObject = {};
            columns.forEach(function (column) {
              rowObject[column.metadata.colName] = column.value;
            });
            jsonArray.push(rowObject);
          });
          resolve({ rowCount, jsonArray });
        }
      });
      connection.execSql(request);
    });
  });
};

exports.Execute = async (companyName, query) => {
  try {
    // Thực hiện các thao tác với cơ sở dữ liệu ở đây
    const result = await executeSQL(companyName, query);
    return result;
  } catch (error) {
    console.error("Lỗi khi kết nối đến cơ sở dữ liệu MSSQL:", query, error);
  } finally {
    // await DB.close();
  }
};
// {
//   recordsets: [],
//   recordset: undefined,
//   output: {},
//   rowsAffected: [ 1 ]
// }
