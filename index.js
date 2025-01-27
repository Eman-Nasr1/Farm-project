const express = require('express');
const app = express();
const mongoose = require('mongoose');
const httpstatustext=require('./utilits/httpstatustext');

const notificationCron = require('./middleware/notificationCron');


const cors=require('cors');
require('dotenv').config();
app.use(cors());

const url=process.env.MONGO_URL;
mongoose.connect(url).then(()=>{
    console.log("mongoose start");
})


app.use (express.json());
const authrouter=require('./Routes/authRoutes');
app.use('/',authrouter)

notificationCron;
const animalRoutes=require('./Routes/animalRoutes');
app.use('/',animalRoutes)

const matingRoutes=require('./Routes/matingRoutes');
app.use('/',matingRoutes)

const breedingRoutes=require('./Routes/breedingRoutes');
app.use('/',breedingRoutes)

const vaccineRoutes=require('./Routes/vaccineRoutes');
app.use('/',vaccineRoutes)

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