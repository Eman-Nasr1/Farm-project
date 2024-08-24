const mongoose = require('mongoose');  

// Assuming your Breeding model is already defined  
const Breeding = require('./Models/breeding.model');

// Function to get the birth entries for today  
async function getBirthEntriesCount(userId) {  
    const today = new Date();  
    today.setUTCHours(0, 0, 0, 0); // Set to midnight of today  
    const tomorrow = new Date(today);  
    tomorrow.setUTCDate(today.getUTCDate() + 1); // Set to midnight of tomorrow  

    try {  
        const result = await Breeding.aggregate([  
            {   
                $match: {   
                    owner: userId, // Match by owner  
                    createdAt: {   
                        $gte: today,   
                        $lt: tomorrow   
                    }   
                }   
            },  
            { $unwind: '$birthEntries' }, // Deconstruct the birthEntries array  
            {   
                $match: {   
                    'birthEntries.createdAt': {   
                        $gte: today,   
                        $lt: tomorrow   
                    }   
                }   
            },  
            {   
                $group: {  
                    _id: null,  
                    totalBirthEntries: { $sum: 1 },  
                    totalMales: { $sum: { $cond: [{ $eq: ['$birthEntries.gender', 'male'] }, 1, 0] } },  
                    totalFemales: { $sum: { $cond: [{ $eq: ['$birthEntries.gender', 'female'] }, 1, 0] } }  
                }   
            }  
        ]);  

        console.log(result); // Output the result  
        return result;  
        
    } catch (error) {  
        console.error('Error fetching birth entries:', error);  
        throw error; // Rethrow to handle in the calling function  
    }  
}  

// Example usage  
getBirthEntriesCount('669155f90b8f914540933f0d')  
    .then((data) => {  
        // Process the data as needed  
        console.log('Birth Entries Count:', data);  
    })  
    .catch((error) => {  
        console.error('Error:', error);  
    });