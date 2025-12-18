const express = require('express');
const app = express();
const mongoose = require('mongoose');
const httpstatustext=require('./utilits/httpstatustext');
const cronJobs = require('./utilits/cronJobs');

const notificationCron = require('./middleware/notificationCron');
const matingNotificationCron = require('./middleware/matingNotification');
 
const cors=require('cors');
require('dotenv').config();

const ALLOWLIST = [
  'http://localhost:3000',              // لوكال
  'https://online-farm.vercel.app',     // الدومين القديم لو لسه بتستخدميه
  'https://mazraaonline.com',           // الدومين الجديد
  'https://www.mazraaonline.com' ,
  'https://app.mazraaonline.com'         // لو فيه www
];
  
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);                 // Postman/Server-to-Server
      if (ALLOWLIST.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    credentials: true
  }));
const url=process.env.MONGO_URL;
mongoose.connect(url).then(()=>{
    console.log("mongoose start");
    // Start cron jobs after database connection
    cronJobs.scheduleExpiryCheck();
    cronJobs.scheduleSubscriptionRenewals();
})

// IMPORTANT: Webhook and payment routes must be registered BEFORE auth middleware
// These routes do NOT require authentication

// Stripe webhook needs raw body for signature verification
const webhookRoutes = require('./Routes/webhookRoutes');
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);

// Paymob webhook uses JSON (not raw body)
// POST /api/webhooks/paymob - Server-to-server webhook (HMAC verified)
const paymobWebhookRoutes = require('./Routes/paymobWebhookRoutes');
app.use('/api/webhooks/paymob', express.json(), paymobWebhookRoutes);

// Paymob payment return/redirect route
// GET /api/payments/paymob/return - User-facing redirect (no auth, no HMAC)
const paymentRoutes = require('./Routes/paymentRoutes');
app.use('/', paymentRoutes);

// Now use express.json() for all other routes
app.use (express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Public route - Get all plans (must be before any route files with middleware)
const planController = require('./Controllers/plan.controller');
app.get('/api/admin/plans', planController.getAllPlans);

const authrouter=require('./Routes/authRoutes');
app.use('/',authrouter)

notificationCron;
matingNotificationCron;
const animalRoutes=require('./Routes/animalRoutes');
app.use('/',animalRoutes)

const matingRoutes=require('./Routes/matingRoutes');
app.use('/',matingRoutes)

const breedingRoutes=require('./Routes/breedingRoutes');
app.use('/',breedingRoutes)

const vaccineRoutes=require('./Routes/vaccineRoutes');
app.use('/',vaccineRoutes)

const vaccineTypeRoutes=require('./Routes/vaccineTypeRoutes');
app.use('/',vaccineTypeRoutes)

const weightRoutes=require('./Routes/weightRoutes');
app.use('/',weightRoutes)

const reportRoutes=require('./Routes/reportRoutes');
app.use('/',reportRoutes)

const excludedRoutes=require('./Routes/excludedRoutes');
app.use('/',excludedRoutes)

const feedRoutes=require('./Routes/feedRoutes');
app.use('/',feedRoutes)

const treatmentRoutes=require('./Routes/treatmentRoutes');
app.use('/',treatmentRoutes)

const employeetRoutes=require('./Routes/employeeRoute');
app.use('/',employeetRoutes)

const locationshedRoutes=require('./Routes/locationshedRoutes');
app.use('/',locationshedRoutes)

const breedRoutes=require('./Routes/breedRoutes');
app.use('/',breedRoutes)

const notificationRoutes=require('./Routes/notificationRoutes');
app.use('/',notificationRoutes)

const supplierRoutes=require('./Routes/supplierRoutes');
app.use('/',supplierRoutes)

const StatisticsRoutes = require('./Routes/StatisticsRoutes');
app.use('/',StatisticsRoutes);

// Subscription and Plan routes
const subscriptionRoutes = require('./Routes/subscriptionRoutes');
app.use('/', subscriptionRoutes);

const planRoutes = require('./Routes/planRoutes');
app.use('/', planRoutes);

const settingsRoutes = require('./Routes/settingsRoutes');
app.use('/', settingsRoutes);

const discountCodeRoutes = require('./Routes/discountCodeRoutes');
app.use('/', discountCodeRoutes);

app.all('*',(req,res,next)=>{
    return res.status(400).json({status:httpstatustext.ERROR,message:"this resource is not aviliable"}) 
})

app.use((error, req, res, next) => {
    res.status(error.statusCode || 500).json({
        status: error.statustext || httpstatustext.ERROR,
        message: error.message,
        code: error.statusCode,
        data: null
    });
//   res.json(next);
    
})

app.listen(process.env.PORT,()=>{
    console.log('listening on port : 5000');
})