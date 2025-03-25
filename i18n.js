const i18n = require('i18n');

i18n.configure({
  locales: ['en', 'ar'], // English and Arabic
  directory: __dirname + '/locales', // Path to locales directory
  defaultLocale: 'en', // Default locale
  cookie: 'lang', // Cookie to store locale preference
  queryParameter: 'lang', // Query parameter to switch locale
  autoReload: true, // Reload locales when they change
  updateFiles: false, // Do not update locale files automatically
});

module.exports = i18n;