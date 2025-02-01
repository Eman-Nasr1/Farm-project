const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Vaccine=require('../Models/vaccine.model');
const Animal=require('../Models/animal.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');


// const getallVaccine =asyncwrapper(async(req,res)=>{

//     const userId = req.userId;
//     const query=req.query;
//     const limit=query.limit||10;
//     const page=query.page||1;
//     const skip=(page-1)*limit;

//     const filter = { owner: userId };
//     const vaccinationLogFilter = {};

//     if (query.tagId) {
//         vaccinationLogFilter["vaccinationLog.tagId"] = query.tagId; // e.g., filter by tagId
//     }

//     if (query.locationShed) {
//         vaccinationLogFilter["vaccinationLog.locationShed"] = query.locationShed; // e.g., filter by locationShed
//     }

//     if (query.DateGiven) {
//         vaccinationLogFilter["vaccinationLog.DateGiven"] = { $gte: new Date(query.DateGiven) }; // filter by DateGiven
//     }
    
//     if (query.vaccineName) {
//         filter.vaccineName = query.vaccineName; // e.g., 
//     }

//     const vaccine = await Vaccine.find(filter, { "__v": false })  
//     .populate({  
//         path: 'animalId', // This is the field in the Mating schema that references Animal  
//         select: 'animalType' // Select only the animalType field from the Animal model  
//     })  
//     .limit(limit)  
//     .skip(skip);  

//     if (query.animalType) {  
//         const filteredvaccineData = vaccine.filter(vaccine => vaccine.animalId && vaccine.animalId.animalType === query.animalType);  
//         return res.json({ status: httpstatustext.SUCCESS, data: { vaccine: filteredvaccineData } });  
//     }  

//     res.json({status:httpstatustext.SUCCESS,data:{vaccine}});
// })

const getAllVaccine = asyncwrapper(async (req, res) => {
    const userId = req.userId;
    const query = req.query;
    const limit = parseInt(query.limit) || 10;
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;

    const filter = { owner: userId };

    // Create an array to hold the vaccination log filters  
    const vaccinationLogFilters = {};

    if (query.tagId || query.locationShed || query.DateGiven) {
        vaccinationLogFilters.$elemMatch = {}; // Create an $elemMatch object for filtering  

        if (query.tagId) {
            vaccinationLogFilters.$elemMatch.tagId = query.tagId; // Filter by tagId  
        }

        if (query.locationShed) {
            vaccinationLogFilters.$elemMatch.locationShed = query.locationShed; // Filter by locationShed  
        }

        if (query.DateGiven) {
            vaccinationLogFilters.$elemMatch.DateGiven = { $gte: new Date(query.DateGiven) }; // Filter by DateGiven  
        }

        // Add the vaccinationLog filter to the main filter  
        filter.vaccinationLog = vaccinationLogFilters;
    }

    if (query.vaccineName) {
        filter.vaccineName = query.vaccineName; // e.g., 
    }

    // Get the total count of documents that match the filter
    const totalCount = await Vaccine.countDocuments(filter);

    // Find the paginated results
    const vaccine = await Vaccine.find(filter, { "__v": false })
        .populate({
            path: 'animalId',
            select: 'animalType'
        })
        .limit(limit)
        .skip(skip);

    // If animalType is provided in the query, filter the results
    if (query.animalType) {
        const filteredVaccineData = vaccine.filter(vaccine => vaccine.animalId && vaccine.animalId.animalType === query.animalType);
        return res.json({
            status: httpstatustext.SUCCESS,
            data: {
                vaccine: filteredVaccineData,
                pagination: {
                    total: filteredVaccineData.length,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(filteredVaccineData.length / limit)
                }
            }
        });
    }

    // If no animalType filter is applied, return all vaccine data with pagination metadata
    res.json({
        status: httpstatustext.SUCCESS,
        data: {
            vaccine,
            pagination: {
                total: totalCount,
                page: page,
                limit: limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        }
    });
});


const exportVaccinesToExcel = asyncwrapper(async (req, res, next) => {
    const userId = req.userId;

    // Fetch vaccines based on filter logic
    const query = req.query;
    const filter = { owner: userId };

    if (query.vaccineName) filter.vaccineName = query.vaccineName;
    if (query.DateGiven) filter['vaccinationLog.DateGiven'] = { $gte: new Date(query.DateGiven) };
    if (query.locationShed) filter['vaccinationLog.locationShed'] = query.locationShed;

    const vaccines = await Vaccine.find(filter).populate({
        path: 'animalId',
        select: 'tagId locationShed animalType'
    });

    if (!vaccines.length) {
        return next(AppError.create('No vaccines found for the specified filters', 404, httpstatustext.FAIL));
    }

    // Prepare data for Excel
    const data = [];
    data.push(['Vaccine Name', 'Tag ID', 'Animal Type', 'Location Shed', 'Date Given', 'Valid Till']);

    vaccines.forEach(vaccine => {
        vaccine.vaccinationLog.forEach(log => {
            data.push([
                vaccine.vaccineName,
                log.tagId || '',
                vaccine.animalId?.animalType || '',
                log.locationShed || '',
                log.DateGiven ? new Date(log.DateGiven).toLocaleDateString() : '',
                log.vallidTell ? new Date(log.vallidTell).toLocaleDateString() : ''
            ]);
        });
    });

    // Create a new workbook and add the data
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Vaccines');

    // Write the workbook to a buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers and send the file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="vaccines.xlsx"');

    res.send(buffer);
});

const importVaccineFromExcel = asyncwrapper(async (req, res, next) => {
    upload(req, res, async function (err) {
        if (err) {
            return next(AppError.create('File upload failed', 400, httpstatustext.FAIL));
        }

        const fileBuffer = req.file.buffer;
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON format (array of objects)
        const data = xlsx.utils.sheet_to_json(worksheet);

        const createdVaccines = [];

        // Iterate over the rows
        for (const [index, row] of data.entries()) {
            const { tagId, vaccineName, DateGiven, givenEvery, locationShed } = row;

            // Validate required fields
            if (!tagId || !vaccineName || !DateGiven || !givenEvery) {
                return next(AppError.create(`Missing required fields in row ${index + 2}`, 400, httpstatustext.FAIL));
            }

            // Find the animal by tagId
            const animal = await Animal.findOne({ tagId });
            if (!animal) {
                return next(AppError.create(`Animal not found for tagId: ${tagId} in row ${index + 2}`, 404, httpstatustext.FAIL));
            }

            // Create a new vaccine record
            const newVaccine = new Vaccine({
                vaccineName,
                vaccinationLog: [{
                    tagId,
                    DateGiven: new Date(DateGiven),
                    locationShed: locationShed || animal.locationShed,
                    vallidTell: new Date(new Date(DateGiven).getTime() + (givenEvery * 24 * 60 * 60 * 1000)),
                    createdAt: new Date()
                }],
                givenEvery,
                owner: req.userId,
                animalId: animal._id
            });

            await newVaccine.save();
            createdVaccines.push(newVaccine);
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: 'Vaccines imported successfully',
            data: createdVaccines,
        });
    });
});

const getVaccineforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const vaccine = await Vaccine.find({ animalId: animal._id });

    if (!vaccine) {
        const error = AppError.create('Vaccine information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, vaccine } });

})


const getsinglevaccine = asyncwrapper(async (req, res, next) => {
    const vaccineId = req.params.vaccineId;

    // Find the vaccine document by its ID
    const vaccine = await Vaccine.findById(vaccineId);
    if (!vaccine) {
        const error = AppError.create('vaccine information not found', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Return the single vaccine record
    return res.json({ status: httpstatustext.SUCCESS, data: { vaccine } });
});

const addvaccine = asyncwrapper(async (req, res, next) => {  
    const userId = req.userId;  
    const { vaccinationLog, ...vaccineData } = req.body;  
    const createdVaccines = []; // Array to keep track of created vaccines  
  
    // Check if vaccinationLog is empty  
    if (!vaccinationLog || vaccinationLog.length === 0) {  
        return next(new AppError('Vaccination log is empty', 400, httpstatustext.FAIL));  
    }  
    
    // Process each log in the vaccinationLog array  
    for (const log of vaccinationLog) {  
        const { locationShed, ...vaccineData2 } = log; // Destructure locationShed and other vaccine data  

        // Find all animals that match the provided locationShed  
        const animals = await Animal.find({ locationShed });  

        // If no animals are found for the provided locationShed  
        if (animals.length === 0) {  
            const error = AppError.create('No animals found for the provided locationShed', 404, httpstatustext.FAIL);  
            return next(error);  
        }  

        // Create and save a new vaccine for each found animal  
        for (const animal of animals) {  
            const newVaccine = new Vaccine({   
                vaccinationLog: [{
                    tagId: animal.tagId,  // Adding the tagId from the animal
                    DateGiven: vaccinationLog[0].DateGiven,
                    locationShed: locationShed, // Using the location shed from the request
                    vallidTell: new Date(new Date(vaccinationLog[0].DateGiven).getTime() + (vaccineData.givenEvery * 24 * 60 * 60 * 1000)),
                    createdAt: new Date()
                }],  // Pass the current log as vaccinationLog  
                ...vaccineData, // Includes global vaccine data  
                ...vaccineData2, // Includes vaccine data from the current log  
                owner: userId,  
                animalId: animal._id  
            });  
            await newVaccine.save();  
            createdVaccines.push(newVaccine); // Store the created vaccine in the array  
        }  
    }  

    // Send back the array of created vaccines  
    res.json({ status: httpstatustext.SUCCESS, data: { vaccines: createdVaccines } });  
});

// const addvaccine = asyncwrapper(async (req, res, next) => {
//     const userId = req.userId;  
//     const { vaccinationLog, ...vaccineData } = req.body;  
//     const createdVaccines = []; // Array to keep track of created vaccines

//     // Check if vaccinationLog has a valid entry for DateGiven
//     if (!vaccinationLog || vaccinationLog.length === 0 || !vaccinationLog[0].DateGiven) {
//         return next(new AppError('Vaccination log must include at least one entry with DateGiven', 400, httpstatustext.FAIL));
//     }

//     // Check if locationShed is provided
//     const locationShed = vaccinationLog[0].locationShed; // Assuming locationShed is part of the first log entry
//     if (locationShed) {
//         // Fetch all animals in the specified shed
//         const animals = await Animal.find({ locationShed });
        
//         if (animals.length === 0) {
//             return next(new AppError('No animals found in the specified location shed', 404, httpstatustext.FAIL));
//         }

//         // Create vaccine for each animal in the shed
//         for (const animal of animals) {
//             const newVaccine = new Vaccine({
//                 ...vaccineData,  // Include vaccine name and givenEvery
//                 vaccinationLog: [{
//                     tagId: animal.tagId,  // Adding the tagId from the animal
//                     DateGiven: vaccinationLog[0].DateGiven,
//                     locationShed: locationShed, // Using the location shed from the request
//                     vallidTell: new Date(new Date(vaccinationLog[0].DateGiven).getTime() + (vaccineData.givenEvery * 24 * 60 * 60 * 1000)),
//                     createdAt: new Date()
//                 }],
//                 owner: userId,
//                 animalId: animal._id // Reference to the animal
//             });

//             await newVaccine.save();
//             createdVaccines.push(newVaccine);  // Store the created vaccine in the array
//         }

//         return res.json({ status: httpstatustext.SUCCESS, data: { vaccines: createdVaccines } });
//     }

//     // If neither tagId nor locationShed is provided, return an error
//     return next(new AppError('Either tagId or locationShed must be provided', 400, httpstatustext.FAIL));
// });


const addvaccineforanimal = asyncwrapper(async (req, res, next) => {
    const userId = req.userId;  
    const { vaccinationLog, ...vaccineData } = req.body;  
    const createdVaccines = []; // Array to keep track of created vaccines

    // Check if the vaccinationLog is valid and has DateGiven and tagId
    if (!vaccinationLog || vaccinationLog.length === 0 || !vaccinationLog[0].DateGiven || !vaccinationLog[0].tagId) {
        return next(new AppError('Vaccination log must include at least one entry with DateGiven and tagId', 400, httpstatustext.FAIL));
    }

    const tagId = vaccinationLog[0].tagId; // Extract tagId from the first log entry
    if (tagId) {
        const animal = await Animal.findOne({ tagId });
        if (!animal) {
            return next(new AppError('Animal not found for the provided tagId', 404, httpstatustext.FAIL));
        }

        // Create the vaccination log for the single animal
        const newVaccine = new Vaccine({
            ...vaccineData,
            vaccinationLog: [{
                tagId: animal.tagId,
                DateGiven: vaccinationLog[0].DateGiven,
                locationShed: vaccinationLog[0].locationShed || animal.locationShed,
                vallidTell: new Date(new Date(vaccinationLog[0].DateGiven).getTime() + (vaccineData.givenEvery * 24 * 60 * 60 * 1000)),
                createdAt: new Date()
            }],
            owner: userId,
            animalId: animal._id
        });

        await newVaccine.save();
        createdVaccines.push(newVaccine);

        return res.json({ status: httpstatustext.SUCCESS, data: { vaccines: createdVaccines } });
    }


    return next(new AppError(' tagId must be provided', 400, httpstatustext.FAIL));
});



const updateVaccine = asyncwrapper(async (req,res,next)=>{
    const userId = req.userId;
    const vaccineId = req.params.vaccineId;
    const updatedData = req.body;

    let vaccine = await Vaccine.findOne({ _id: vaccineId, owner: userId });
        if (!vaccine) {
            const error = AppError.create('Vaccine information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        vaccine = await Vaccine.findOneAndUpdate({ _id: vaccineId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { vaccine } });
})

const deleteVaccine= asyncwrapper(async(req,res,next)=>{
    const userId = req.userId;
    const vaccineId = req.params.vaccineId;

    // Find the document by its ID
    const vaccine = await Vaccine.findOne({ _id: vaccineId, owner: userId });
    if (!vaccine) {
        const error = AppError.create('Vaccine information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await vaccine.deleteOne({ _id: vaccineId });

    res.json({ status: httpstatustext.SUCCESS, message: 'Vaccine information deleted successfully' });

})

module.exports={
    deleteVaccine,
    updateVaccine,
    addvaccine,
    addvaccineforanimal,
    getVaccineforspacficanimal,
    getsinglevaccine,
    getAllVaccine,
    exportVaccinesToExcel,
    importVaccineFromExcel

}