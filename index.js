const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5500;

// node_modules
app.use("/three", express.static(path.join(__dirname, "node_modules/three")));

// static web
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
