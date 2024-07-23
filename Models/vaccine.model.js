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
            }
        }],

        owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
         }
       
  
    }
)

module.exports= mongoose.model('Vaccine',Vaccineschema)