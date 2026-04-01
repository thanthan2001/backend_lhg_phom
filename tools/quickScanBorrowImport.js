require("dotenv").config();

const fs = require("fs");
const path = require("path");
const phomModel = require("../src/features/phom_control/phom.model");

function getArgValue(flagNames) {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (flagNames.includes(arg)) {
      return argv[i + 1];
    }
    for (const flag of flagNames) {
      if (arg.startsWith(`${flag}=`)) {
        return arg.slice(flag.length + 1);
      }
    }
  }
  return undefined;
}

function printUsage() {
  console.log("Usage:");
  console.log(
    "  node tools/quickScanBorrowImport.js --file <path_to_txt> [--company <company_name>] [--officer <OfficerId>] [--dateBorrow \"YYYY-MM-DD HH:mm:ss\"] [--dateReceive \"YYYY-MM-DD HH:mm:ss\"]",
  );
  console.log("  Default companyName: lhg");
  console.log("");
  console.log("TXT format:");
  console.log("  Line 1: DepID");
  console.log("  Line 2: UserID");
  console.log("  Line 3..N: EPC (one per line)");
}

async function main() {
  const fileArg = getArgValue(["epc.txt", "-f"]);
  const companyName = getArgValue(["--company", "-c"]) || "lhg";
  const officerId = getArgValue(["--officer", "-o"]);
  const dateBorrow = getArgValue(["--dateBorrow"]);
  const dateReceive = getArgValue(["--dateReceive"]);

  if (!fileArg) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`Input file not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 3) {
    console.error("Invalid file format: need at least 3 non-empty lines.");
    console.error("Line 1 = DepID, Line 2 = UserID, Line 3..N = EPC list.");
    process.exitCode = 1;
    return;
  }

  const depID = lines[0];
  const userID = lines[1] || "SYSTEM";
  const epcList = lines.slice(2);

  const payload = {
    companyName,
    DepID: depID,
    UserID: userID,
    EPCList: epcList,
  };

  if (officerId) {
    payload.OfficerId = officerId;
  }
  if (dateBorrow) {
    payload.DateBorrow = dateBorrow;
  }
  if (dateReceive) {
    payload.DateReceive = dateReceive;
  }

  console.log("Starting quick import with payload summary:");
  console.log(
    JSON.stringify(
      {
        companyName,
        DepID: depID,
        UserID: userID,
        totalEPCInput: epcList.length,
      },
      null,
      2,
    ),
  );

  const result = await phomModel.quickScanBorrow(companyName, payload);

  console.log("Result:");
  console.log(JSON.stringify(result, null, 2));

  if (!result || result.status === "Error" || Number(result.statusCode) >= 400) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Import tool failed:", error);
  process.exitCode = 1;
});
