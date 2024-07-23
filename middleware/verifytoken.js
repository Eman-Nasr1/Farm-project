
const jwt=require('jsonwebtoken');
const AppError=require('../utilits/AppError');
const httpstatustext=require('../utilits/httpstatustext');

const verifytoken=(req,res,next)=>{
  const authtoken=req.headers['authorization'];
  if(!authtoken){
    const error=AppError.create('token is required',401,httpstatustext.ERROR)
        return next(error);
  }

  const token = authtoken.split(' ')[1];
  try{
    const currentuser= jwt.verify(token,process.env.JWT_SECRET_KEY);
     //console.log(currentuser);
     req.userId = currentuser.id;
     //console.log(req.userId);
    req.currentuser=currentuser;
    
     
     next();
}catch{
    const error=AppError.create('token is invalid',401,httpstatustext.ERROR)
        return next(error);
}
 
}

module.exports=verifytoken;