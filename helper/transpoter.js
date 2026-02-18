const dotenv = require("dotenv");
dotenv.config({ path: "../.env" });

const { sendMail } = require("./sendmail");

/**
 * Convert Nodemailer-style mailOptions to sendmail (ZeptoMail API) options.
 * Keeps the same contract so all existing helpers work without change.
 */
function mailOptionsToSendmail(mailOptions) {
  const opts = {
    to: mailOptions.to,
    subject: mailOptions.subject,
    from: mailOptions.from,
    bcc: mailOptions.bcc,
    cc: mailOptions.cc,
    replyTo: mailOptions.replyTo,
    html: mailOptions.html,
    text: mailOptions.text,
    attachments: mailOptions.attachments || [],
  };
  return opts;
}

/**
 * Fake transporter object so existing transporter.sendMail(mailOptions, callback) still works.
 * All sending goes through sendmail.js (ZeptoMail API).
 */
const transporterInstance = {
  sendMail(mailOptions, callback) {
    const opts = mailOptionsToSendmail(mailOptions);
    sendMail(opts, callback);
  },
};

exports.transporter = transporterInstance;

/**
 * Promise wrapper - same API as before. Resolve with info-like object, reject on error.
 * Email logs (logEmailSuccess / logEmailOutcome) are unchanged; they run after this in each helper.
 */
exports.sendMailPromise = (mailOptions) => {
  return new Promise((resolve, reject) => {
    const opts = mailOptionsToSendmail(mailOptions);
    sendMail(opts, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info || { messageId: "zeptomail" });
      }
    });
  });
};
