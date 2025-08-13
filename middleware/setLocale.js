// middleware/setLocale.js
const i18n = require('../i18n');

module.exports = (req, _res, next) => {
  const lang =
    req.user?.language ||
    req.query.lang ||                     // ← use query string
    req.headers['accept-language']?.split(',')[0]?.slice(0,2) ||
    'en';

  i18n.setLocale(lang);
  req.lang = lang;
  next();
};
