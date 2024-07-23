const User=require('../Models/user.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const bcrypt=require('bcryptjs');
const jwt =require('jsonwebtoken');

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


 module.exports={
    getallusers,
    register,
    login

}