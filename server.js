const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

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

// Path to the Excel file
const excelFilePath = path.join(__dirname, 'feedback_data.xlsx');

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
                'Jewel Types',
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
                { width: 20 }, // Jewel Types
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
                'Jewel Types',
                'Experience Rating',
                'Name',
                'WhatsApp Number'
            ];
            worksheet.addRow(headers);
        }

        // Prepare new row data
        const now = new Date();
        // Use consistent date format: DD/MM/YYYY
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
        // Use consistent time format: HH:MM:SS AM/PM
        const timeStr = now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
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
            'Jewel Types': jewelTypes,
            'Experience Rating': data.experience_rating || '',
            'Name': data.name || '',
            'WhatsApp Number': data.whatsapp || ''
        };

        console.log('Adding row data:', rowData);

        // Get the next row number
        const nextRowNumber = worksheet.lastRow ? worksheet.lastRow.number + 1 : 2;
        console.log('Adding to row number:', nextRowNumber);

        // Add the row using array format for better compatibility
        const newRowArray = [
            dateStr,
            timeStr,
            likedMost,
            data.planning_to_buy || '',
            jewelTypes,
            data.experience_rating || '',
            data.name || '',
            data.whatsapp || ''
        ];

        const newRow = worksheet.addRow(newRowArray);

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
    await createExcelFileIfNotExists();
})();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mayna-diamonds-feedback.html'));
});


// Feedback submission endpoint
app.post('/submit-feedback', async (req, res) => {
    console.log('Received feedback data:', req.body);
    
    try {
        const result = await appendToExcel(req.body);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Thank you for your valuable feedback! Your response has been recorded.'
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error occurred while saving your feedback.'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Server is running!', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        uptime: process.uptime()
    });
});

// Get feedback data (optional - for viewing data)
app.get('/view-feedback', async (req, res) => {
    try {
        if (fs.existsSync(excelFilePath)) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(excelFilePath);
            const worksheet = workbook.getWorksheet('Feedback Data');
            
            if (worksheet) {
                const data = [];
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
                                rowData[header] = cell.value;
                            }
                        });
                        data.push(rowData);
                    }
                });
                
                res.json({
                    success: true,
                    data: data,
                    total: data.length
                });
            } else {
                res.json({
                    success: true,
                    data: [],
                    total: 0,
                    message: 'Feedback Data worksheet not found.'
                });
            }
        } else {
            res.json({
                success: true,
                data: [],
                total: 0,
                message: 'No feedback data found yet.'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error reading feedback data: ' + error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Excel file will be saved as: ${excelFilePath}`);
    console.log(`📝 Submit feedback at: http://localhost:${PORT}`);
    console.log(`👀 View feedback data at: http://localhost:${PORT}/view-feedback`);
});