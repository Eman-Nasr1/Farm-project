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
                type: String
               
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

Vaccineschema.pre('findOneAndUpdate', async function(next) {
    const update = this.getUpdate();

    // Check if givenEvery or vaccinationLog.DateGiven are being updated
    if (update.givenEvery || (update.vaccinationLog && update.vaccinationLog.length > 0)) {
        const vaccine = await this.model.findOne(this.getQuery());

        if (vaccine) {
            const givenEvery = update.givenEvery || vaccine.givenEvery;

            // Iterate over vaccinationLog entries if they exist
            if (update.vaccinationLog) {
                update.vaccinationLog.forEach((log, index) => {
                    if (log.DateGiven) {
                        update.vaccinationLog[index].vallidTell = new Date(log.DateGiven.getTime() + (givenEvery * 24 * 60 * 60 * 1000));
                    }
                });
            }
        }
    }
    
    next();
});


module.exports= mongoose.model('Vaccine',Vaccineschema)