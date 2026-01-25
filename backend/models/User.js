const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({}, { strict: false, collection: "users" });

module.exports = mongoose.model("User", userSchema);
