const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const keys = require("./config/keys");
const cookieSession = require("cookie-session");
const mongoose = require("mongoose");
const passport = require("passport");
const publicPath = path.join(__dirname, "client/public");
const staticMiddleware = express.static(publicPath);
require("dotenv").config();

mongoose.Promise = global.Promise;
// Still need to configure keys
mongoose.connect(keys.mongoURI);

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: "16mb" }));
app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000,
    keys: [keys.cookieKey]
  })
);
app.use(passport.initialize());
app.use(passport.session());

if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));

  const path = require("path");
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "client", "build", "index.html"));
  });
}

app.use(staticMiddleware);

const PORT = process.env.PORT || 5000;
app.listen(PORT);
