// middleware/localeMiddleware.js
const i18n = require('../i18n');

const setLocale = (req, res, next) => {
  const locale = req.query.lang || req.headers['accept-language'] || 'en';
  i18n.setLocale(locale);
  next();
};

module.exports = setLocale;