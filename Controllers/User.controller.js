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


 const forgotPassword = asyncwrapper(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(AppError.create('Email is required', 400, httpstatustext.FAIL));
  }

  const user = await User.findOne({ email });

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.ERROR));
  }

  // Generate a 6-digit verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Store the verification code and its expiration time in the user's document
  user.resetPasswordToken = verificationCode; // Store the verification code
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

  await user.save();

  // Send email with the verification code
  const transporter = nodemailer.createTransport({
    service: 'Gmail', // Using Gmail as an example
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    to: email,
    subject: 'Password Reset Verification Code',
    html: `<p>Your password reset verification code is:</p>
           <h2>${verificationCode}</h2>
           <p>This code will expire in 1 hour. Please use it to reset your password.</p>`,
  };

  await transporter.sendMail(mailOptions);

  res.status(200).json({ status: httpstatustext.SUCCESS, message: 'Verification code sent to your email' });
});

 
const verifyCode = asyncwrapper(async (req, res, next) => {
  const { verificationCode } = req.body;

  if (!verificationCode) {
    return next(AppError.create('Verification code is required', 400, httpstatustext.FAIL));
  }

  const user = await User.findOne({
    resetPasswordToken: verificationCode,
    resetPasswordExpires: { $gt: Date.now() }, // Ensure the token is not expired
  });

  if (!user) {
    return next(AppError.create('Invalid or expired verification code', 400, httpstatustext.ERROR));
  }

  // Generate a token (JWT) with the user's ID
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });

  // Send the token back to the user
  res.status(200).json({ status: httpstatustext.SUCCESS, message: 'Verification code is valid', token });
});




// Function to handle password reset  
const resetPassword = asyncwrapper(async (req, res, next) => {
  const { newPassword } = req.body;
  const token = req.headers.authorization?.split(' ')[1]; // Extract the token from the Authorization header

  if (!newPassword) {
    return next(AppError.create('New password is required', 400, httpstatustext.FAIL));
  }

  if (!token) {
    return next(AppError.create('No token provided', 401, httpstatustext.FAIL));
  }

  // Verify the token and extract the user's ID
  const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  const userId = decoded.id;

  // Find the user by ID
  const user = await User.findById(userId);

  if (!user) {
    return next(AppError.create('User not found', 404, httpstatustext.ERROR));
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 7);

  // Update the user's password
  user.password = hashedPassword;
  user.resetPasswordToken = undefined; // Clear the token fields
  user.resetPasswordExpires = undefined;

  // Save the updated user
  await user.save();

  // Send success response
  res.status(200).json({ status: httpstatustext.SUCCESS, message: 'Password has been reset successfully' });
});



 module.exports={
    getallusers,
    register,
    login,
    resetPassword ,
    forgotPassword

}