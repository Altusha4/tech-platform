const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
    {},
    { strict: false, collection: "content" }
);

module.exports = mongoose.model("Content", contentSchema);
