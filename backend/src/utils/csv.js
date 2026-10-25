// Simple CSV stringifier — avoids external dependency
exports.createObjectCsvStringifier = ({ header }) => ({
  getHeaderString: () => header.map(h => h.title).join(",") + "\n",
  stringifyRecords: (records) =>
    records.map(r => header.map(h => `"${r[h.id] ?? ""}"`).join(",")).join("\n"),
});
