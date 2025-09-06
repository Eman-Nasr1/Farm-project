const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isValidDate(d) { return d instanceof Date && !Number.isNaN(d.getTime()); }
function daysUntil(from, to) { return Math.ceil((to - from) / MS_PER_DAY); }

function getStage(daysUntilDue) {
  if (daysUntilDue <= 0) return 'expired'; // اليوم/متأخر
  if (daysUntilDue <= 7) return 'week';    // خلال أسبوع
  return 'month';                           // خلال 30 يوم
}

function fmt(d) {
  const x = new Date(d);
  return `${x.getDate()}-${x.getMonth() + 1}-${x.getFullYear()}`;
}
const addDays   = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const addMonths = (d,n)=>{ const x=new Date(d), day=x.getDate(); x.setMonth(x.getMonth()+n); if(x.getDate()<day) x.setDate(0); return x; };
module.exports = { MS_PER_DAY, isValidDate, daysUntil, getStage, fmt ,addDays,addMonths};
