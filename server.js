const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for HTTPS deployment
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (your HTML form)
app.use(express.static(path.join(__dirname)));

// Path to the Excel file and backup JSON/CSV files
// On hosting (production) use OS temp directory to avoid read-only filesystem
const HOSTING = (process.env.NODE_ENV === 'production' ||
                 process.env.HEROKU ||
                 process.env.VERCEL ||
                 process.env.RAILWAY_PROJECT_ID ||
                 process.env.RENDER ||
                 process.env.CYCLIC_APP_ID);
const STORAGE_DIR = HOSTING ? os.tmpdir() : __dirname;

const excelFilePath = path.join(STORAGE_DIR, 'feedback_data.xlsx');
const jsonBackupPath = path.join(STORAGE_DIR, 'feedback_data.json');
const csvBackupPath = path.join(STORAGE_DIR, 'feedback_data.csv');

// Detect hosting environment
const isHostingEnvironment = () => {
    return process.env.NODE_ENV === 'production' || 
           process.env.HEROKU || 
           process.env.VERCEL || 
           process.env.RAILWAY_PROJECT_ID ||
           process.env.RENDER ||
           process.env.CYCLIC_APP_ID ||
           !fs.existsSync(path.join(__dirname, 'package.json')); // Simple check for read-only filesystem
};

// Get current environment info
const getEnvironmentInfo = () => {
    const hosting = isHostingEnvironment();
    const platform = process.env.HEROKU ? 'Heroku' :
                     process.env.VERCEL ? 'Vercel' :
                     process.env.RAILWAY_PROJECT_ID ? 'Railway' :
                     process.env.RENDER ? 'Render' :
                     process.env.CYCLIC_APP_ID ? 'Cyclic' :
                     hosting ? 'Unknown Hosting' : 'Local';
    
    return { hosting, platform };
};

console.log('Environment detected:', getEnvironmentInfo());

// JSON Data Handler Functions
async function saveToJSON(data) {
    try {
        const headers = [
            'Submission Date',
            'Submission Time', 
            'Liked Most',
            'Planning to Buy',
            'Interested In',
            'Experience Rating',
            'Name',
            'WhatsApp Number'
        ];

        // Read existing JSON data
        let existingData = [];
        if (fs.existsSync(jsonBackupPath)) {
            try {
                const jsonContent = fs.readFileSync(jsonBackupPath, 'utf8');
                existingData = JSON.parse(jsonContent);
            } catch (parseError) {
                console.warn('Error reading existing JSON, starting fresh:', parseError.message);
                existingData = [];
            }
        }

        // Prepare new entry
        const now = new Date();
        const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
        const timeStr = now.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const likedMost = Array.isArray(data.liked_most) ? data.liked_most.join(', ') : (data.liked_most || '');
        const jewelTypes = Array.isArray(data.jewel_types) ? data.jewel_types.join(', ') : (data.jewel_types || '');

        const newEntry = {
            'Submission Date': dateStr,
            'Submission Time': timeStr,
            'Liked Most': likedMost,
            'Planning to Buy': data.planning_to_buy || '',
            'Interested In': jewelTypes,
            'Experience Rating': data.experience_rating || '',
            'Name': data.name || '',
            'WhatsApp Number': data.whatsapp || '',
            'Timestamp': now.toISOString()
        };

        // Add to existing data
        existingData.push(newEntry);

        // Save back to JSON
        fs.writeFileSync(jsonBackupPath, JSON.stringify(existingData, null, 2), 'utf8');
        console.log('Data saved to JSON backup successfully');
        
        return { success: true, message: 'Data saved to JSON backup successfully!' };
    } catch (error) {
        console.error('Error saving to JSON:', error);
        return { success: false, message: 'Error saving to JSON: ' + error.message };
    }
}

async function saveToCSV(data) {
    try {
        const headers = 'Submission Date,Submission Time,Liked Most,Planning to Buy,Interested In,Experience Rating,Name,WhatsApp Number\n';
        
        // Prepare new entry
        const now = new Date();
        const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
        const timeStr = now.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const likedMost = Array.isArray(data.liked_most) ? data.liked_most.join('; ') : (data.liked_most || '');
        const jewelTypes = Array.isArray(data.jewel_types) ? data.jewel_types.join('; ') : (data.jewel_types || '');

        // Escape quotes and commas for CSV
        const escapeCSV = (str) => {
            if (typeof str !== 'string') str = String(str || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const csvRow = [
            escapeCSV(dateStr),
            escapeCSV(timeStr),
            escapeCSV(likedMost),
            escapeCSV(data.planning_to_buy || ''),
            escapeCSV(jewelTypes),
            escapeCSV(data.experience_rating || ''),
            escapeCSV(data.name || ''),
            escapeCSV(data.whatsapp || '')
        ].join(',') + '\n';

        // Check if file exists, if not create with headers
        if (!fs.existsSync(csvBackupPath)) {
            fs.writeFileSync(csvBackupPath, headers, 'utf8');
        }

        // Append new row
        fs.appendFileSync(csvBackupPath, csvRow, 'utf8');
        console.log('Data saved to CSV backup successfully');
        
        return { success: true, message: 'Data saved to CSV backup successfully!' };
    } catch (error) {
        console.error('Error saving to CSV:', error);
        return { success: false, message: 'Error saving to CSV: ' + error.message };
    }
}

// Enhanced data saving function with multiple fallbacks
async function saveDataWithFallbacks(data) {
    const envInfo = getEnvironmentInfo();
    const results = [];
    let primarySuccess = false;

    // Try Excel first (preferred method)
    if (!envInfo.hosting || envInfo.platform === 'Local') {
        try {
            const excelResult = await appendToExcel(data);
            results.push({ method: 'Excel', result: excelResult });
            if (excelResult.success) {
                primarySuccess = true;
            }
        } catch (excelError) {
            results.push({ method: 'Excel', result: { success: false, message: excelError.message } });
            console.warn('Excel save failed, trying fallbacks...');
        }
    } else {
        console.log('Hosting environment detected, skipping Excel and using fallbacks');
    }

    // Always save to JSON as backup
    try {
        const jsonResult = await saveToJSON(data);
        results.push({ method: 'JSON', result: jsonResult });
        if (!primarySuccess && jsonResult.success) {
            primarySuccess = true;
        }
    } catch (jsonError) {
        results.push({ method: 'JSON', result: { success: false, message: jsonError.message } });
    }

    // Always save to CSV as additional backup
    try {
        const csvResult = await saveToCSV(data);
        results.push({ method: 'CSV', result: csvResult });
        if (!primarySuccess && csvResult.success) {
            primarySuccess = true;
        }
    } catch (csvError) {
        results.push({ method: 'CSV', result: { success: false, message: csvError.message } });
    }

    console.log('Save results:', results);
    
    if (primarySuccess) {
        const successMethods = results.filter(r => r.result.success).map(r => r.method);
        return { 
            success: true, 
            message: `Data saved successfully! Methods: ${successMethods.join(', ')}`,
            methods: successMethods,
            details: results
        };
    } else {
        return { 
            success: false, 
            message: 'All save methods failed. Please try again.',
            details: results
        };
    }
}

// Function to create Excel file if it doesn't exist
async function createExcelFileIfNotExists() {
    try {
        if (!fs.existsSync(excelFilePath)) {
            console.log('Creating new Excel file...');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Feedback Data');
            
            // Create headers for the feedback data - ensure exact match with append function
            const headers = [
                'Submission Date',
                'Submission Time',
                'Liked Most',
                'Planning to Buy',
                'Interested In',
                'Experience Rating',
                'Name',
                'WhatsApp Number'
            ];
            
            console.log('Adding headers:', headers);
            
            // Add headers to worksheet as first row
            const headerRow = worksheet.addRow(headers);
            
            // Style the header row
            headerRow.font = { bold: true, color: { argb: 'FF000000' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6E6E6' }
            };
            
            // Set column widths
            worksheet.columns = [
                { width: 15 }, // Submission Date
                { width: 15 }, // Submission Time
                { width: 20 }, // Liked Most
                { width: 15 }, // Planning to Buy
                { width: 20 }, // Interested In
                { width: 12 }, // Experience Rating
                { width: 20 }, // Name
                { width: 18 }  // WhatsApp Number
            ];
            
            // Write the file
            await workbook.xlsx.writeFile(excelFilePath);
            
            console.log('Excel file created successfully at:', excelFilePath);
        } else {
            console.log('Excel file already exists at:', excelFilePath);
        }
    } catch (error) {
        console.error('Error creating Excel file:', error.message);
        console.error('Full error:', error);
        console.warn('Note: Excel file operations may not work on some hosting platforms.');
        console.warn('Consider using a database for production deployments.');
    }
}
// Normalize headers and legacy data in existing worksheets
function normalizeWorksheet(worksheet) {
    if (!worksheet) return;

    // Ensure header row matches expected headers exactly
    const expectedHeaders = [
        'Submission Date',
        'Submission Time',
        'Liked Most',
        'Planning to Buy',
        'Interested In',
        'Experience Rating',
        'Name',
        'WhatsApp Number'
    ];

    const headerRow = worksheet.getRow(1);
    expectedHeaders.forEach((header, idx) => {
        const cell = headerRow.getCell(idx + 1);
        const current = (cell.value || '').toString().trim();
        if (current !== header) {
            cell.value = header;
        }
    });
    if (typeof headerRow.commit === 'function') headerRow.commit();

    // Fix existing data rows: date format D/M/YYYY and time to 12-hour with am/pm
    const timeHasAmPm = (s) => /am|pm/i.test(s);
    for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);

        // Fix date in column 1
        let dVal = row.getCell(1).value;
        if (dVal != null && dVal !== '') {
            const s = dVal.toString().trim();
            const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (m) {
                const d = parseInt(m[1], 10);
                const mth = parseInt(m[2], 10);
                const y = parseInt(m[3], 10);
                // Normalize to D/M/YYYY (no leading zeros)
                row.getCell(1).value = `${d}/${mth}/${y}`;
            }
        }

        // Fix time in column 2
        let tVal = row.getCell(2).value;
        if (tVal != null && tVal !== '') {
            let s = tVal.toString().trim();

            // If time has AM/PM but uppercase, normalize to lowercase "am"/"pm"
            if (/AM|PM/.test(s)) {
                let tlc = s.toLowerCase();
                // remove leading zero from hour e.g. "08:12:01 am" -> "8:12:01 am"
                tlc = tlc.replace(/^0(\d:)/, '$1');
                row.getCell(2).value = tlc;
            } else if (!timeHasAmPm(s)) {
                // If no am/pm, assume 24h "HH:MM[:SS]" and convert to 12h with am/pm
                const mt = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
                if (mt) {
                    let h = parseInt(mt[1], 10);
                    const min = mt[2];
                    const sec = mt[3] || '00';
                    let suffix = 'am';
                    if (h === 0) { h = 12; suffix = 'am'; }
                    else if (h === 12) { suffix = 'pm'; }
                    else if (h > 12) { h = h - 12; suffix = 'pm'; }
                    // do not pad hour with leading zero
                    row.getCell(2).value = `${h}:${min}:${sec} ${suffix}`;
                }
            }
        }
        if (typeof row.commit === 'function') row.commit();
    }
}

// Function to fix existing Excel file with overlapping data
async function fixExcelFile() {
    try {
        if (!fs.existsSync(excelFilePath)) {
            console.log('No Excel file to fix.');
            return;
        }

        console.log('Fixing Excel file with overlapping data...');
        
        // Read existing data
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFilePath);
        let worksheet = workbook.getWorksheet('Feedback Data');
        
        if (!worksheet) {
            console.log('No worksheet to fix.');
            return;
        }

        // Extract all unique data rows (skip duplicates)
        const uniqueRows = [];
        const seenRows = new Set();
        
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header
            
            // Create a string representation of the row for comparison
            const rowData = [];
            row.eachCell((cell, colNumber) => {
                if (colNumber <= 8) { // Only consider first 8 columns
                    rowData.push((cell.value || '').toString().trim());
                }
            });
            
            const rowStr = rowData.join('|');
            if (rowStr && rowStr !== '|||||||' && !seenRows.has(rowStr)) {
                seenRows.add(rowStr);
                uniqueRows.push(rowData);
            }
        });
        
        console.log('Found', uniqueRows.length, 'unique data rows');
        
        // Recreate the worksheet
        const newWorkbook = new ExcelJS.Workbook();
        const newWorksheet = newWorkbook.addWorksheet('Feedback Data');
        
        // Add headers
        const headers = [
            'Submission Date',
            'Submission Time',
            'Liked Most',
            'Planning to Buy',
            'Interested In',
            'Experience Rating',
            'Name',
            'WhatsApp Number'
        ];
        
        const headerRow = newWorksheet.addRow(headers);
        headerRow.font = { bold: true, color: { argb: 'FF000000' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6E6' }
        };
        
        // Add unique data rows with normalized date and time
        uniqueRows.forEach(rowData => {
            try {
                // Normalize date in column 0 (Submission Date) to D/M/YYYY (no leading zeros)
                if (rowData[0]) {
                    const dstr = rowData[0].toString().trim();
                    const md = dstr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (md) {
                        const d = parseInt(md[1], 10);
                        const m = parseInt(md[2], 10);
                        const y = parseInt(md[3], 10);
                        rowData[0] = `${d}/${m}/${y}`;
                    }
                }
                // Normalize time in column 1 (Submission Time) to h:mm:ss am/pm (no leading zero hour)
                if (rowData[1]) {
                    let tstr = rowData[1].toString().trim().toLowerCase();
                    // Remove leading zero from hour like "08:12:01 am" => "8:12:01 am"
                    tstr = tstr.replace(/^0(\d:)/, '$1');
                    rowData[1] = tstr;
                }
            } catch (e) {
                console.warn('Normalize error for row:', e.message);
            }
            newWorksheet.addRow(rowData);
        });
        
        // Set column widths
        newWorksheet.columns = [
            { width: 15 }, // Submission Date
            { width: 15 }, // Submission Time
            { width: 20 }, // Liked Most
            { width: 15 }, // Planning to Buy
            { width: 20 }, // Interested In
            { width: 12 }, // Experience Rating
            { width: 20 }, // Name
            { width: 18 }  // WhatsApp Number
        ];
        
        // Save the fixed file
        await newWorkbook.xlsx.writeFile(excelFilePath);
        console.log('Excel file fixed successfully! Removed duplicates and organized data properly.');
        
    } catch (error) {
        console.error('Error fixing Excel file:', error);
    }
}

// Function to append data to Excel file
async function appendToExcel(data) {
    let fileLocked = false;
    try {
        console.log('Appending data to Excel:', data);

        // Check if file exists before reading
        if (!fs.existsSync(excelFilePath)) {
            console.log('Excel file not found, creating new one...');
            await createExcelFileIfNotExists();
        }

        // Check if file is currently locked (being used by another process like Excel)
        try {
            const testStream = fs.createWriteStream(excelFilePath, { flags: 'r+' });
            testStream.end();
        } catch (lockError) {
            console.warn('Excel file appears to be locked by another application (like Excel). This may prevent updates.');
            fileLocked = true;
        }

        // Read existing workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFilePath);
        let worksheet = workbook.getWorksheet('Feedback Data');

        if (!worksheet) {
            console.log('Worksheet not found, creating new one...');
            worksheet = workbook.addWorksheet('Feedback Data');

            // Add headers if worksheet is new
            const headers = [
                'Submission Date',
                'Submission Time',
                'Liked Most',
                'Planning to Buy',
                'Interested In',
                'Experience Rating',
                'Name',
                'WhatsApp Number'
            ];
            worksheet.addRow(headers);
        }

        // Normalize headers and legacy date/time for existing rows
        normalizeWorksheet(worksheet);

        // Ensure worksheet integrity - fix any structural issues
        try {
            // Count actual rows with data
            let dataRowCount = 0;
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                
                // Check if row has any data
                let hasData = false;
                row.eachCell((cell) => {
                    if (cell.value && cell.value.toString().trim() !== '') {
                        hasData = true;
                    }
                });
                
                if (hasData) {
                    dataRowCount++;
                }
            });
            
            console.log('Found', dataRowCount, 'existing data rows');
        } catch (countError) {
            console.warn('Error counting rows:', countError.message);
        }

        // Prepare new row data
        const now = new Date();
        // Use consistent date format: D/M/YYYY (no leading zeros)
        const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
        // Use consistent time format: HH:MM:SS AM/PM
        const timeStr = now.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        // Format arrays as comma-separated strings
        const likedMost = Array.isArray(data.liked_most) ? data.liked_most.join(', ') : (data.liked_most || '');
        const jewelTypes = Array.isArray(data.jewel_types) ? data.jewel_types.join(', ') : (data.jewel_types || '');

        // Create row data as an object for better control
        const rowData = {
            'Submission Date': dateStr,
            'Submission Time': timeStr,
            'Liked Most': likedMost,
            'Planning to Buy': data.planning_to_buy || '',
            'Interested In': jewelTypes,
            'Experience Rating': data.experience_rating || '',
            'Name': data.name || '',
            'WhatsApp Number': data.whatsapp || ''
        };

        console.log('Adding row data:', rowData);

        // Get the actual row count to determine next row number
        let actualRowCount = 1; // Start with 1 for header row
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > actualRowCount) {
                actualRowCount = rowNumber;
            }
        });
        const nextRowNumber = actualRowCount + 1;
        console.log('Current row count:', actualRowCount);
        console.log('Adding to row number:', nextRowNumber);

        // Add the row using array format for better compatibility
        const newRowArray = [
            dateStr,
            timeStr,
            likedMost,
            data.planning_to_buy || '',
            jewelTypes, // This will be under "Interested In" column
            data.experience_rating || '',
            data.name || '',
            data.whatsapp || ''
        ];

        // Add row at the end (addRow is more reliable than insertRow)
        const newRow = worksheet.addRow(newRowArray);
        console.log('Row added at position:', newRow.number);

        // Ensure Excel stores proper date/time types and displays them correctly
        try {
            // Column 1: Date
            const dateCell = newRow.getCell(1);
            dateCell.value = now; // store as Date object
            dateCell.numFmt = 'd/m/yyyy'; // show as D/M/YYYY

            // Column 2: Time
            const timeCell = newRow.getCell(2);
            timeCell.value = now; // store as Date object, displayed as time only
            timeCell.numFmt = 'hh:mm:ss am/pm'; // show 12-hour time with am/pm
        } catch (fmtErr) {
            console.warn('Failed to apply date/time formats to new row:', fmtErr.message);
        }

        // Auto-fit columns after adding data
        worksheet.columns.forEach((column, index) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.max(maxLength + 2, 12);
        });

        // Save the file with retry mechanism
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                await workbook.xlsx.writeFile(excelFilePath);
                console.log('Excel file updated successfully!');
                console.log(`Total rows in worksheet: ${worksheet.rowCount}`);
                console.log(`Data written to row ${nextRowNumber}:`, newRowArray);

                if (fileLocked) {
                    console.warn('⚠️  File was locked during write operation. Close Excel and try again if updates don\'t appear.');
                }

                return { success: true, message: 'Data saved successfully!' };
            } catch (writeError) {
                retryCount++;
                console.warn(`Write attempt ${retryCount} failed:`, writeError.message);

                if (retryCount < maxRetries) {
                    console.log(`Retrying in 1 second...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw writeError;
                }
            }
        }

    } catch (error) {
        console.error('Error writing to Excel:', error);
        console.error('Error stack:', error.stack);

        let errorMessage = 'Error saving data: ' + error.message;
        if (fileLocked) {
            errorMessage += ' (File may be locked by Excel - close Excel and try again)';
        }

        return { success: false, message: errorMessage };
    }
}

// Initialize Excel file
(async () => {
    const envInfo = getEnvironmentInfo();
    if (!envInfo.hosting) {
        await createExcelFileIfNotExists();
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(excelFilePath);
            const worksheet = workbook.getWorksheet('Feedback Data');
            if (worksheet) {
                normalizeWorksheet(worksheet);
                await workbook.xlsx.writeFile(excelFilePath);
                console.log('Normalized existing Excel data (headers and date/time formats)');
            }
        } catch (e) {
            console.warn('Normalization at startup failed:', e.message);
        }
    } else {
        console.log('Hosting environment detected: skipping Excel init at startup. Using JSON/CSV storage dir:', STORAGE_DIR);
    }
})();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mayna-diamonds-feedback.html'));
});

// Admin dashboard route (explicit path for hosting platforms)
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});


// Feedback submission endpoint
app.post('/submit-feedback', async (req, res) => {
    console.log('Received feedback data:', req.body);
    const envInfo = getEnvironmentInfo();
    console.log('Processing in environment:', envInfo);
    
    try {
        // Use the new fallback system
        const result = await saveDataWithFallbacks(req.body);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Thank you for your valuable feedback! Your response has been recorded.',
                environment: envInfo.platform,
                storage_methods: result.methods || ['Unknown'],
                details: process.env.NODE_ENV === 'development' ? result.details : undefined
            });
        } else {
            console.error('All storage methods failed:', result.details);
            res.status(500).json({
                success: false,
                message: 'Unable to save your feedback. Please try again later.',
                environment: envInfo.platform,
                details: process.env.NODE_ENV === 'development' ? result.details : undefined
            });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error occurred while saving your feedback.',
            environment: envInfo.platform
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const envInfo = getEnvironmentInfo();
    const filesExist = {
        excel: fs.existsSync(excelFilePath),
        json: fs.existsSync(jsonBackupPath),
        csv: fs.existsSync(csvBackupPath)
    };
    
    res.json({ 
        status: 'Server is running!', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        platform: envInfo.platform,
        hosting: envInfo.hosting,
        port: PORT,
        uptime: process.uptime(),
        data_files: filesExist,
        storage_priority: envInfo.hosting ? ['JSON', 'CSV', 'Excel'] : ['Excel', 'JSON', 'CSV']
    });
});

// Fix Excel file endpoint
app.post('/fix-excel', async (req, res) => {
    try {
        await fixExcelFile();
        res.json({
            success: true,
            message: 'Excel file has been fixed successfully! Duplicates removed and data organized.'
        });
    } catch (error) {
        console.error('Error fixing Excel file:', error);
        res.status(500).json({
            success: false,
            message: 'Error fixing Excel file: ' + error.message
        });
    }
});

// Get feedback data (optional - for viewing data) with multiple source fallback
app.get('/view-feedback', async (req, res) => {
    const envInfo = getEnvironmentInfo();
    let data = [];
    let source = '';
    let success = false;

    try {
        // Try Excel first (if not in hosting environment)
        if (!envInfo.hosting && fs.existsSync(excelFilePath)) {
            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.readFile(excelFilePath);
                const worksheet = workbook.getWorksheet('Feedback Data');
                
                if (worksheet) {
                    const headers = [];
                    
                    // Get headers from first row
                    worksheet.getRow(1).eachCell((cell, cellNumber) => {
                        headers[cellNumber - 1] = cell.value;
                    });
                    
                    // Get data from subsequent rows
                    worksheet.eachRow((row, rowNumber) => {
                        if (rowNumber > 1) { // Skip header row
                            const rowData = {};
                            row.eachCell((cell, cellNumber) => {
                                const header = headers[cellNumber - 1];
                                if (header) {
                                    let v = cell.value;

                                    // Normalize date/time for API output
                                    if (v && header === 'Submission Date') {
                                        if (v instanceof Date) {
                                            v = `${v.getDate()}/${v.getMonth() + 1}/${v.getFullYear()}`;
                                        } else {
                                            v = v.toString();
                                        }
                                    } else if (v && header === 'Submission Time') {
                                        if (v instanceof Date) {
                                            v = v.toLocaleTimeString('en-IN', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                second: '2-digit',
                                                hour12: true
                                            });
                                        } else {
                                            v = v.toString().replace(/\bAM\b|\bPM\b/g, (m) => m.toLowerCase());
                                        }
                                    }

                                    rowData[header] = v;
                                }
                            });
                            data.push(rowData);
                        }
                    });
                    source = 'Excel';
                    success = true;
                }
            } catch (excelError) {
                console.warn('Error reading Excel file:', excelError.message);
            }
        }

        // Fallback to JSON if Excel failed or in hosting environment
        if (!success && fs.existsSync(jsonBackupPath)) {
            try {
                const jsonContent = fs.readFileSync(jsonBackupPath, 'utf8');
                data = JSON.parse(jsonContent);
                source = 'JSON';
                success = true;
            } catch (jsonError) {
                console.warn('Error reading JSON file:', jsonError.message);
            }
        }

        // Final fallback to CSV
        if (!success && fs.existsSync(csvBackupPath)) {
            try {
                const csvContent = fs.readFileSync(csvBackupPath, 'utf8');
                const lines = csvContent.trim().split('\n');
                
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                    data = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                        const rowData = {};
                        
                        headers.forEach((header, index) => {
                            rowData[header] = values[index] || '';
                        });
                        
                        data.push(rowData);
                    }
                }
                source = 'CSV';
                success = true;
            } catch (csvError) {
                console.warn('Error reading CSV file:', csvError.message);
            }
        }

        if (success) {
            res.json({
                success: true,
                data: data,
                total: data.length,
                source: source,
                environment: envInfo.platform,
                message: `Data loaded from ${source} file`
            });
        } else {
            res.json({
                success: true,
                data: [],
                total: 0,
                source: 'None',
                environment: envInfo.platform,
                message: 'No feedback data found yet.'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error reading feedback data: ' + error.message,
            environment: envInfo.platform
        });
    }
});

// Download CSV endpoint
app.get('/download-csv', async (req, res) => {
    try {
        if (fs.existsSync(csvBackupPath)) {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="mayna_feedback_data.csv"');
            
            const csvContent = fs.readFileSync(csvBackupPath, 'utf8');
            res.send(csvContent);
        } else {
            res.status(404).json({
                success: false,
                message: 'CSV file not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error downloading CSV: ' + error.message
        });
    }
});

// Download JSON endpoint
app.get('/download-json', async (req, res) => {
    try {
        if (fs.existsSync(jsonBackupPath)) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename="mayna_feedback_data.json"');
            
            const jsonContent = fs.readFileSync(jsonBackupPath, 'utf8');
            res.send(jsonContent);
        } else {
            res.status(404).json({
                success: false,
                message: 'JSON file not found'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error downloading JSON: ' + error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    const envInfo = getEnvironmentInfo();
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${envInfo.platform} (${envInfo.hosting ? 'Hosting' : 'Local'})`);
    console.log(`📊 Data storage: ${envInfo.hosting ? 'JSON + CSV (Excel disabled)' : 'Excel + JSON + CSV'}`);
    console.log(`📝 Submit feedback at: http://localhost:${PORT}`);
    console.log(`👀 View feedback data at: http://localhost:${PORT}/view-feedback`);
    console.log(`📥 Download CSV at: http://localhost:${PORT}/download-csv`);
    console.log(`📥 Download JSON at: http://localhost:${PORT}/download-json`);
    console.log(`🔧 Health check at: http://localhost:${PORT}/health`);
    
    // Storage file paths info
    if (!envInfo.hosting) {
        console.log(`📁 Excel file: ${excelFilePath}`);
    }
    console.log(`📁 JSON backup: ${jsonBackupPath}`);
    console.log(`📁 CSV backup: ${csvBackupPath}`);
});
