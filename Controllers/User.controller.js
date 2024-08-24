const User=require('../Models/user.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const bcrypt=require('bcryptjs');
const jwt =require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); 

const getallusers=asyncwrapper(async(req,res)=>{
    // console.log(req.headers);
     const query=req.query;
     const limit=query.limit||10;
     const page=query.page||1; 
     const skip=(page-1)*limit;
 
     const users= await User.find({},{"__v":false,"password":false,"confirmpassword":false}).limit(limit).skip(skip);
     res.json({status:httpstatustext.SUCCESS,data:{users}});
 })

 const register=asyncwrapper(async(req,res,next)=>{
    const {name,email,password,confirmpassword,phone,country,role,usertype}=req.body;

    const olderuser=await User.findOne({email:email});
    if(olderuser){
        const error=AppError.create('user already exists',400,httpstatustext.FAIL);
         return next(error);
    }
    if (password !== confirmpassword) {
        const error=AppError.create('password and confirmpassword do not match',400,httpstatustext.FAIL);
        return next(error);
      }

     const hashpassword= await bcrypt.hash(password,7);
     const newuser=new User({
        name,
        email,
        password:hashpassword,
        confirmpassword:hashpassword,
        phone,
        role,
        country,
        usertype

     })
     const token=await jwt.sign(
        { email: newuser.email, id: newuser._id, role: newuser.role }, // Include 'role' in the payload
        process.env.JWT_SECRET_KEY,
        { expiresIn: '30d' }) 

        newuser.token= token;
        await newuser.save(); 
        
        res.status(201).json({status:httpstatustext.SUCCESS,data:{user:newuser}});

 })

 const login=asyncwrapper(async(req,res,next)=>{
    const{email,password}=req.body;
    if(!email && !password){
        const error=AppError.create('email and password are required',400,httpstatustext.FAIL);
        return next(error);
    }
    const user=await User.findOne({email:email});

    if(!user){
      const error=AppError.create('user not found',404,httpstatustext.ERROR);
      return next(error);
    }

    const matchedpassword=bcrypt.compare(password,user.password);
    if(user && matchedpassword){
        const token = await jwt.sign(
          { email: user.email, id: user._id, role: user.role }, // Include 'role' in the payload
          process.env.JWT_SECRET_KEY,
          { expiresIn: '30d' }
      );
        res.status(201).json({status:httpstatustext.SUCCESS,data:{token}});
      } 
      else {
        const error=AppError.create('something wrong',500,httpstatustext.ERROR);
        return next(error);
      }

 })


 const forgotPassword = asyncwrapper(async(req, res, next) => {  
  const { email } = req.body; 
  
  if (!email) {  
      return next(AppError.create('Email is required', 400, httpstatustext.FAIL));  
  }  

  const user = await User.findOne({ email });  
  if (!user) {  
      return next(AppError.create('User not found', 404, httpstatustext.ERROR));  
  }  

  // Create a token for password reset  
  const resetToken = crypto.randomBytes(32).toString('hex');  
  user.resetPasswordToken = resetToken;  
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour  

  await user.save();  

  // Send email with the reset link (using nodemailer or any other email service)  
  const transporter = nodemailer.createTransport({  
      service: 'Gmail', // Using Gmail as an example  
      auth: {  
          user: process.env.EMAIL_USER,  
          pass: process.env.EMAIL_PASS,  
      },  
  });  

  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;  

  const mailOptions = {  
    to: email,  
    subject: 'Password Reset',  
    html: `<p>You are receiving this email because you (or someone else) have requested the reset of a password.</p>  
           <p>Please click on the following button to reset your password:</p>  
           <a href="${resetUrl}" style="display:inline-block; background-color:#4CAF50; color:white; padding:10px 20px; text-align:center; text-decoration:none; border-radius:5px;">  
               Reset Password  
           </a>  
           <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>`,  
};
  await transporter.sendMail(mailOptions);  

  res.status(200).json({ status: httpstatustext.SUCCESS, message: 'Reset link sent to your email' });  
});  



// Function to handle password reset  
const resetPassword = asyncwrapper(async(req, res, next) => {  
  const { token, password, confirmpassword } = req.body;  

  if (password !== confirmpassword) {  
      return next(AppError.create('Passwords do not match', 400, httpstatustext.FAIL));  
  }  

  const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });  
  
  if (!user) {  
      return next(AppError.create('Password reset token is invalid or has expired', 400, httpstatustext.FAIL));  
  }  

  const hashPassword = await bcrypt.hash(password, 7);  
  user.password = hashPassword;  
  user.confirmpassword = hashPassword; // This may not be necessary depending on your implementation  
  user.resetPasswordToken = undefined; // Clear the token  
  user.resetPasswordExpires = undefined; // Clear the expiry  

  await user.save();  

  res.status(200).json({ status: httpstatustext.SUCCESS, message: 'Password has been reset successfully' });  
});  


 module.exports={
    getallusers,
    register,
    login,
    resetPassword ,
    forgotPassword

}