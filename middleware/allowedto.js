const AppError=require('../utilits/AppError');

module.exports=(...roles)=>{
   // console.log(roles)
    return (req,res,next)=>{
        if(!roles.includes(req.currentuser.role)){
            const error=AppError.create('the role not valid',401);
            return next(error);
        }
        next();

    }

}