class AppError extends Error{
     constructor(){
        super();
     }

     create(message, statusCode, statustext){
        this.message=message;
        this.statusCode =statusCode;
        this.statustext=statustext;
        return this;
     }

   

}

module.exports= new AppError();