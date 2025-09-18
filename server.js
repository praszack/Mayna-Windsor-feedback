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
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Feedback Data');
            
            // Create headers for the feedback data
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
            
            // Add headers to worksheet
            worksheet.addRow(headers);
            
            // Style the header row
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6E6E6' }
            };
            
            // Auto-fit columns
            headers.forEach((header, index) => {
                worksheet.getColumn(index + 1).width = Math.max(15, header.length + 2);
            });
            
            // Write the file
            await workbook.xlsx.writeFile(excelFilePath);
            
            console.log('Excel file created successfully!');
        }
    } catch (error) {
        console.error('Error creating Excel file:', error.message);
        console.warn('Note: Excel file operations may not work on some hosting platforms.');
        console.warn('Consider using a database for production deployments.');
    }
}

// Function to append data to Excel file
async function appendToExcel(data) {
    try {
        // Check if file exists before reading
        if (!fs.existsSync(excelFilePath)) {
            console.log('Excel file not found, creating new one...');
            await createExcelFileIfNotExists();
        }
        
        // Read existing workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelFilePath);
        const worksheet = workbook.getWorksheet('Feedback Data');
        
        if (!worksheet) {
            throw new Error('Feedback Data worksheet not found in Excel file');
        }
        
        // Prepare new row data
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        
        // Format arrays as comma-separated strings
        const likedMost = Array.isArray(data.liked_most) ? data.liked_most.join(', ') : data.liked_most || '';
        const jewelTypes = Array.isArray(data.jewel_types) ? data.jewel_types.join(', ') : data.jewel_types || '';
        
        const newRowData = [
            dateStr,
            timeStr,
            likedMost,
            data.planning_to_buy || '',
            jewelTypes,
            data.experience_rating || '',
            data.name || '',
            data.whatsapp || ''
        ];
        
        // Add new row
        worksheet.addRow(newRowData);
        
        // Write back to file
        await workbook.xlsx.writeFile(excelFilePath);
        
        return { success: true, message: 'Data saved successfully!' };
        
    } catch (error) {
        console.error('Error writing to Excel:', error);
        return { success: false, message: 'Error saving data: ' + error.message };
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