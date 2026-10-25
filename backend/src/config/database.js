const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/staypredict";
  try {
    await mongoose.connect(uri);
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => console.warn("[DB] MongoDB disconnected"));
mongoose.connection.on("error", (err) => console.error("[DB] Error:", err.message));

module.exports = connectDB;
