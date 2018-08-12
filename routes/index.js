const express = require("express");
const router = express.Router();
const graphHelper = require("../utils/graphHelper.js");
const emailer = require("../utils/emailer.js");
const passport = require("passport");

router.get("/", (req, res) => {
  if (!req.isAuthenticated()) {
    res.render("login");
  } else {
    renderSendMail(req, res);
  }
});

router.get(
  "/login",
  passport.authenticate("azuread-openidconnect", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
  }
);

router.get(
  "/token",
  passport.authenticate("azuread-openidconnect", { failureRedirect: "/" }),
  (req, res) => {
    graphHelper.getUserData(req.user.accessToken, (err, user) => {
      if (!err) {
        req.user.profile.displayName = user.body.displayName;
        req.user.profile.emails = [
          { address: user.body.mail || user.body.userPrincipalName }
        ];
        renderSendMail(req, res);
      } else {
        renderError(err, res);
      }
    });
  }
);

function renderSendMail(req, res) {
  res.render("sendMail", {
    display_name: req.user.profile.displayName,
    email_address: req.user.profile.emails[0].address
  });
}

function prepForEmailMessage(req, callback) {
  const accessToken = req.user.accessToken;
  const displayName = req.user.profile.displayName;
  const destinationEmailAddress = req.body.default_email;
  graphHelper.getProfilePhoto(accessToken, (errPhoto, profilePhoto) => {
    if (errPhoto) renderError(errPhoto);
    graphHelper.uploadFile(accessToken, profilePhoto, (errFile, file) => {
      if (errFile) renderError(errFile);
      graphHelper.getSharingLink(accessToken, file.id, (errLink, link) => {
        if (errLink) renderError(errLink);
        const mailBody = emailer.generateMailBody(
          displayName,
          destinationEmailAddress,
          link.webUrl,
          profilePhoto
        );
        callback(null, mailBody);
      });
    });
  });
}

router.post("/sendMail", (req, res) => {
  const response = res;
  const templateData = {
    display_name: req.user.profile.displayName,
    email_address: req.user.profile.emails[0].address,
    actual_recipient: req.body.default_email
  };
  prepForEmailMessage(req, (errMailBody, mailBody) => {
    if (errMailBody) renderError(errMailBody);
    graphHelper.postSendMail(
      req.user.accessToken,
      JSON.stringify(mailBody),
      errSendMail => {
        if (!errSendMail) {
          response.render("sendMail", templateData);
        } else {
          if (hasAccessTokenExpired(errSendMail)) {
            errSendMail.message +=
              " Expired token. Please sign out and sign in again.";
          }
          renderError(errSendMail, response);
        }
      }
    );
  });
});

router.get("/disconnect", (req, res) => {
  req.session.destroy(() => {
    req.logOut();
    res.clearCookie("graphNodeCookie");
    res.status(200);
    res.redirect("/");
  });
});

function hasAccessTokenExpired(e) {
  let expired;
  if (!e.innerError) {
    expired = false;
  } else {
    expired =
      e.forbidden &&
      e.message === "InvalidAuthenticationToken" &&
      e.response.error.message === "Access token has expired.";
  }
  return expired;
}

function renderError(e, res) {
  e.innerError = e.response ? e.response.text : "";
  res.render("error", {
    error: e
  });
}

module.exports = router;
