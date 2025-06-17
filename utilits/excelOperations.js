const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');
const i18n = require('../i18n');
const AppError = require('./AppError');
const httpstatustext = require('./httpstatustext');

// Generic Excel upload middleware
const uploadExcelFile = (req, res, next) => {
    upload(req, res, function (err) {
        if (err) {
            return next(AppError.create(i18n.__('FILE_UPLOAD_FAILED'), 400, httpstatustext.FAIL));
        }
        next();
    });
};

// Generic function to read Excel file
const readExcelFile = (buffer) => {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet, { header: 1 });
};

// Generic function to create Excel file
const createExcelFile = (data, headers, sheetName) => {
    const workbook = xlsx.utils.book_new();
    const worksheetData = [headers, ...data];
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    return workbook;
};

// Generic function to set Excel response headers
const setExcelResponseHeaders = (res, filename) => {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

// Generic function to write Excel buffer
const writeExcelBuffer = (workbook) => {
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

// Function to set column widths
const setColumnWidths = (worksheet, widths) => {
    worksheet['!cols'] = widths.map(width => ({ wch: width }));
    return worksheet;
};

// Headers for different languages and types
const headers = {
    animal: {
        en: {
            template: [
                'Tag ID',
                'Breed',
                'Animal Type',
                'Birth Date (YYYY-MM-DD)',
                'Purchase Date (YYYY-MM-DD)',
                'Purchase Price',
                'Trader Name',
                'Mother ID',
                'Father ID',
                'Location Shed',
                'Gender (male, female)',
                'Female Condition (pregnant, not pregnant)',
                'Teething'
            ],
            export: [
                'Tag ID',
                'Breed',
                'Animal Type',
                'Birth Date',
                'Age in Days',
                'Purchase Date',
                'Purchase Price',
                'Trader Name',
                'Mother ID',
                'Father ID',
                'Location Shed',
                'Gender',
                'Female Condition',
                'Teething'
            ]
        },
        ar: {
            template: [
                'رقم التعريف',
                'السلالة',
                'نوع الحيوان',
                'تاريخ الميلاد (YYYY-MM-DD)',
                'تاريخ الشراء (YYYY-MM-DD)',
                'سعر الشراء',
                'اسم التاجر',
                'رقم تعريف الأم',
                'رقم تعريف الأب',
                'موقع الحظيرة',
                'الجنس (male, female)',
                'حالة الأنثى (pregnant, not pregnant)',
                'الأسنان'
            ],
            export: [
                'رقم التعريف',
                'السلالة',
                'نوع الحيوان',
                'تاريخ الميلاد',
                'العمر بالأيام',
                'تاريخ الشراء',
                'سعر الشراء',
                'اسم التاجر',
                'رقم تعريف الأم',
                'رقم تعريف الأب',
                'موقع الحظيرة',
                'الجنس (ذكر, أنثى)',
                'حالة الأنثى',
                'الأسنان'
            ]
        }
    },
    weight: {
        en: {
            template: [
                'Tag ID',
                'Date (YYYY-MM-DD)',
                'Weight (kg)',
                'Height (cm)',
                'Weight Type (birth, Weaning, regular)'
            ],
            export: [
                'Tag ID',
                'Date',
                'Weight (kg)',
                'Height (cm)',
                'Weight Type',
                'Created At'
            ]
        },
        ar: {
            template: [
                'رقم التعريف',
                'التاريخ (YYYY-MM-DD)',
                'الوزن (كجم)',
                'الارتفاع (سم)',
                'نوع الوزن (birth, Weaning, regular)'
            ],
            export: [
                'رقم التعريف',
                'التاريخ',
                'الوزن (كجم)',
                'الارتفاع (سم)',
                'نوع الوزن',
                'تاريخ الإنشاء'
            ]
        }
    },
    excluded: {
        en: {
            template: [
                'Tag ID',
                'Excluded Date (YYYY-MM-DD)',
                'Excluded Type (death, sale)',
                'Price',
                'Cause',
                'Notes'
            ],
            export: [
                'Tag ID',
                'Animal Type',
                'Excluded Date',
                'Excluded Type',
                'Price',
                'Cause',
                'Notes',
                'Created At'
            ]
        },
        ar: {
            template: [
                'رقم التعريف',
                'تاريخ الاستبعاد (YYYY-MM-DD)',
                'نوع الاستبعاد (death, sale)',
                'السعر',
                'السبب',
                'ملاحظات'
            ],
            export: [
                'رقم التعريف',
                'نوع الحيوان',
                'تاريخ الاستبعاد',
                'نوع الاستبعاد',
                'السعر',
                'السبب',
                'ملاحظات',
                'تاريخ الإنشاء'
            ]
        }
    },
    mating: {
        en: {
            template: [
                'Tag ID',
                'Male Tag ID',
                'Mating Type',
                'Mating Date (YYYY-MM-DD)',
                'Check Days (45, 60, 90)',
                'Sonar Date (YYYY-MM-DD)',
                'Sonar Result (positive, negative)'
            ],
            export: [
                'Tag ID',
                'Male Tag ID',
                'Mating Type',
                'Mating Date',
                'Check Days',
                'Sonar Date',
                'Sonar Result',
                'Expected Delivery Date',
                'Created At'
            ]
        },
        ar: {
            template: [
                'رقم التعريف',
                'رقم تعريف الذكر',
                'نوع التلقيح',
                'تاريخ التلقيح (YYYY-MM-DD)',
                'أيام الفحص (45, 60, 90)',
                'تاريخ السونار (YYYY-MM-DD)',
                'نتيجة السونار (positive, negative)'
            ],
            export: [
                'رقم التعريف',
                'رقم تعريف الذكر',
                'نوع التلقيح',
                'تاريخ التلقيح',
                'أيام الفحص',
                'تاريخ السونار',
                'نتيجة السونار',
                'تاريخ الولادة المتوقع',
                'تاريخ الإنشاء'
            ]
        }
    },
    vaccine: {
        en: {
            template: [
                'Tag ID',
                'Vaccine Name',
                'Entry Type (First Dose, Booster Dose, Annual Dose)',
                'Date (YYYY-MM-DD)'
            ],
            export: [
                'Tag ID',
                'Vaccine Name',
                'Entry Type',
                'Date',
                'Location Shed',
                'Dose Price',
                'Created At'
            ]
        },
        ar: {
            template: [
                'رقم التعريف',
                'اسم اللقاح',
                'نوع الجرعة (جرعة أولى, جرعة منشطة, جرعة سنوية)',
                'التاريخ (YYYY-MM-DD)'
            ],
            export: [
                'رقم التعريف',
                'اسم اللقاح',
                'نوع الجرعة',
                'التاريخ',
                'موقع الحظيرة',
                'سعر الجرعة',
                'تاريخ الإنشاء'
            ]
        }
    },
    treatment: {
        en: {
            template: [
                'Tag ID',
                'Treatment Name',
                'Volume (ml)',
                'Date (YYYY-MM-DD)'
            ],
            export: [
                'Tag ID',
                'Treatment Name',
                'Volume (ml)',
                'Date',
                'Location Shed',
                'Cost',
                'Created At'
            ]
        },
        ar: {
            template: [
                'رقم التعريف',
                'اسم العلاج',
                'الكمية (مل)',
                'التاريخ (YYYY-MM-DD)'
            ],
            export: [
                'رقم التعريف',
                'اسم العلاج',
                'الكمية (مل)',
                'التاريخ',
                'موقع الحظيرة',
                'التكلفة',
                'تاريخ الإنشاء'
            ]
        }
    }
};

// Example data for templates
const templateExamples = {
    animal: {
        en: ['123', 'Arabic', 'goat', '2024-01-01', '2024-01-01', '1000', 'Mohammed', '456', '789', 'Shed 1', 'female', 'pregnant', '2'],
        ar: ['123', 'عربي', 'ماعز', '2024-01-01', '2024-01-01', '1000', 'محمد', '456', '789', 'حظيرة 1', 'female', 'pregnant', '2']
    },
    weight: {
        en: ['123', '2024-01-01', '50.5', '120', 'regular'],
        ar: ['123', '2024-01-01', '50.5', '120', 'regular']
    },
    excluded: {
        en: ['123', '2024-01-01', 'sale', '1000', 'Low productivity', 'Sold to local market'],
        ar: ['123', '2024-01-01', 'sale', '1000', 'إنتاجية منخفضة', 'تم البيع في السوق المحلي']
    },
    mating: {
        en: ['123', '456', 'natural', '2024-01-01', '45', '2024-02-15', 'positive'],
        ar: ['123', '456', 'طبيعي', '2024-01-01', '45', '2024-02-15', 'positive']
    },
    vaccine: {
        en: ['123', 'Foot and Mouth Disease', 'First Dose', '2024-01-01', 'Shed 1'],
        ar: ['123', 'مرض الحمى القلاعية', 'جرعة أولى', '2024-01-01', 'حظيرة 1']
    },
    treatment: {
        en: ['123', 'Antibiotic', '10', '2024-01-01'],
        ar: ['123', 'مضاد حيوي', '10', '2024-01-01']
    }
};

// Sheet names for different languages
const sheetNames = {
    animal: {
        template: {
            en: 'Animals Template',
            ar: 'نموذج الحيوانات'
        },
        export: {
            en: 'Animal Records',
            ar: 'سجلات الحيوانات'
        }
    },
    weight: {
        template: {
            en: 'Weight Template',
            ar: 'نموذج الوزن'
        },
        export: {
            en: 'Weight Records',
            ar: 'سجلات الوزن'
        }
    },
    excluded: {
        template: {
            en: 'Excluded Template',
            ar: 'نموذج الاستبعاد'
        },
        export: {
            en: 'Excluded Records',
            ar: 'سجلات الاستبعاد'
        }
    },
    mating: {
        template: {
            en: 'Mating Template',
            ar: 'نموذج التلقيح'
        },
        export: {
            en: 'Mating Records',
            ar: 'سجلات التلقيح'
        }
    },
    vaccine: {
        template: {
            en: 'Vaccine Template',
            ar: 'نموذج التطعيم'
        },
        export: {
            en: 'Vaccine Records',
            ar: 'سجلات التطعيم'
        }
    },
    treatment: {
        template: {
            en: 'Treatment Template',
            ar: 'نموذج العلاج'
        },
        export: {
            en: 'Treatment Records',
            ar: 'سجلات العلاج'
        }
    }
};

module.exports = {
    uploadExcelFile,
    readExcelFile,
    createExcelFile,
    setExcelResponseHeaders,
    writeExcelBuffer,
    setColumnWidths,
    headers,
    templateExamples,
    sheetNames
}; 