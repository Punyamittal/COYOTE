/**
 * Reads "IR Student List and Details 2026.xlsx" (All Students sheet)
 * and writes login credentials for ScheduleHub.
 *
 * Usage: node scripts/generate-ir-student-credentials.mjs
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = join(root, "IR Student List and Details 2026.xlsx");
const outputPath = join(
  root,
  "IR Student List and Details 2026 - Login Credentials.xlsx"
);

const PASSWORD_CHARS =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";

function generatePassword(length = 12) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
  }
  return out;
}

function normalizeReg(reg) {
  return String(reg ?? "").trim().toUpperCase();
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

const wb = XLSX.read(readFileSync(inputPath), { type: "buffer" });
const sheetName = "All Students";
const sheet = wb.Sheets[sheetName];
if (!sheet) {
  console.error(`Sheet "${sheetName}" not found.`);
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const seen = new Set();
const credentials = [];

for (const row of rows) {
  const reg = normalizeReg(row["Registration Number"]);
  if (!reg) continue;
  if (seen.has(reg)) continue;
  seen.add(reg);

  const loginId = reg;
  const password = generatePassword(12);

  credentials.push({
    "Sl no": row["Sl no"] ?? "",
    Name: row.Name ?? "",
    "Registration Number": reg,
    "VIT email ID": normalizeEmail(row["VIT email ID"]),
    School: row.School ?? "",
    Department: row["Department\r\n(Eg., CSE AI Robotics, Mechatronics...)"] ?? row.Department ?? "",
    "Login ID (username)": loginId,
    Password: password,
    Role: "USER",
    "First login": "Use Login ID + Password, then change password when prompted",
  });
}

const outWb = XLSX.utils.book_new();
const outSheet = XLSX.utils.json_to_sheet(credentials);
XLSX.utils.book_append_sheet(outWb, outSheet, "Credentials");

const summary = [
  { Metric: "Students", Value: credentials.length },
  { Metric: "Login ID format", Value: "Registration Number (e.g. 23BCE5034)" },
  { Metric: "Password format", Value: "Random 12 characters" },
  { Metric: "Generated at", Value: new Date().toISOString() },
];
XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(summary), "README");

writeFileSync(outputPath, XLSX.write(outWb, { type: "buffer", bookType: "xlsx" }));

console.log(`Wrote ${credentials.length} credentials to:\n${outputPath}`);
