module.exports=(asyncfn)=>{
    return(req, res, next)=>{
        asyncfn(req, res, next).catch((error)=>{
            next(error); 
        });
    }
}