const mongoose = require('mongoose');
const Vaccineschema=new mongoose.Schema(
    {
      
       
        vaccineName:{
            type: String,
           
        },
        givenEvery:{
            type: Number
            
        },
       
    

        vaccinationLog: [{
            tagId: {
                type: String,
                required: true
            },
            DateGiven:{
                type: Date
                
            },
            locationShed:{
                type: String
            },
            vallidTell:{
                type: Date
            },
            createdAt: {  
                type: Date,  
                default: Date.now  // Automatically set to the current date/time when created  
            }
        }],

        owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
         },
         animalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Animal'
             },
             createdAt: {  
                type: Date,  
                default: Date.now  // Automatically set to the current date/time when created  
            } 
  
    }
)
 

// Vaccineschema.pre('save',function(next){
//     if(this.givenEvery && this.DateGiven){
//        this.vallidTell=new Date(DateGiven.getTime() + (this.givenEvery * 24 * 60 * 60 * 1000));
//     }

//     next();
// });


Vaccineschema.pre('save', function(next) {  
    if (this.givenEvery && this.vaccinationLog.length > 0) {  
        this.vaccinationLog.forEach(log => {  
            if (log.DateGiven) {  
              log.vallidTell = new Date(log.DateGiven.getTime() + (this.givenEvery * 24 * 60 * 60 * 1000));  
            }  
        });  
    }  
    next();  
});

module.exports= mongoose.model('Vaccine',Vaccineschema)