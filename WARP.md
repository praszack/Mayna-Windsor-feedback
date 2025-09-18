# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a **Mayna Diamonds Feedback System** - a Node.js web application that collects customer feedback through a responsive form and stores data in Excel files. The project includes multiple deployment configurations (Firebase, Google Cloud, Render, Docker) and supports both file-based and Firestore data storage options.

## Architecture

### Core Components
- **Backend**: Express.js server (`server.js`) handling REST API endpoints
- **Frontend**: Static HTML pages with vanilla JavaScript (no build process)
- **Data Storage**: Dual approach - Excel files (ExcelJS) for development/simple deployments, Firebase Firestore for production
- **Multi-deployment Ready**: Configured for Firebase Hosting, Google Cloud Run, Render, and Docker deployment

### Key Files Structure
- `server.js` - Main Express server with Excel file handling
- `mayna-diamonds-feedback.html` - Customer feedback form (responsive design)
- `index.html` - Landing page with navigation
- `admin-dashboard.html` - Admin interface for viewing feedback
- `firebase-config.js` - Firebase/Firestore configuration and helpers
- `feedback_data.xlsx` - Auto-generated Excel file (created at runtime)

### Data Flow
1. Customer submits feedback via HTML form
2. Frontend JavaScript sends POST to `/submit-feedback`
3. Server processes data and writes to Excel file using ExcelJS
4. Admin can view data via `/view-feedback` endpoint or admin dashboard
5. Alternative: Firebase integration for cloud storage (configuration provided)

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start development server (runs on port 8080)
npm start
# or
npm run dev

# Access points:
# http://localhost:8080 - Landing page
# http://localhost:8080/mayna-diamonds-feedback.html - Feedback form
# http://localhost:8080/admin-dashboard.html - Admin dashboard
# http://localhost:8080/view-feedback - Raw feedback data (JSON)
# http://localhost:8080/health - Health check
```

### Testing Endpoints
```bash
# Health check
curl http://localhost:8080/health

# View feedback data
curl http://localhost:8080/view-feedback

# Test feedback submission
curl -X POST http://localhost:8080/submit-feedback \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","whatsapp":"1234567890","experience_rating":"5","liked_most":["Service","Quality"],"planning_to_buy":"Yes","jewel_types":["Rings","Necklaces"]}'
```

## Deployment Commands

### Docker
```bash
# Build Docker image
docker build -t mayna-diamonds-feedback .

# Run container locally
docker run -p 8080:8080 mayna-diamonds-feedback
```

### Google Cloud Build
```bash
# Deploy using Cloud Build (requires gcloud CLI)
gcloud builds submit --config cloudbuild.yaml
```

### Firebase Deployment
```bash
# Deploy to Firebase Hosting (static files only)
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

### Render Deployment
- Uses `render.yaml` configuration
- Auto-deploys from Git repository
- Build: `npm install`, Start: `npm start`

## Development Guidelines

### Excel File Handling
- Excel files are created automatically on server start if they don't exist
- File path: `./feedback_data.xlsx`
- Headers are auto-generated with proper styling
- Data is appended to existing files (no overwriting)
- **Important**: Excel operations may fail on some hosting platforms - consider using Firestore for production

### Frontend Development
- No build process required - static HTML/CSS/JS
- Uses Google Fonts (Poppins, Cormorant Garamond)
- Responsive design with mobile-first approach
- Vanilla JavaScript (no framework dependencies)
- Form submissions handled via fetch API

### API Response Format
All endpoints return consistent JSON structure:
```json
{
  "success": boolean,
  "message": "string",
  "data": object|array (optional)
}
```

### Firebase Integration
- Optional Firestore backend configured in `firebase-config.js`
- Replace placeholder config with actual Firebase project settings
- Provides real-time data sync and better scalability
- Firestore security rules defined in `firestore.rules`

### Error Handling
- Excel file operations include comprehensive error handling
- Server logs Excel-related warnings for hosting platform compatibility
- Graceful degradation when file operations fail
- Health check endpoint for monitoring deployment status

## Environment Considerations

### Development
- Uses local Excel files for data storage
- Port defaults to 8080 (configurable via PORT env var)
- File system writes work without restrictions

### Production
- Set `NODE_ENV=production` for optimized performance
- Excel files may not persist across deployments on some platforms
- Consider migrating to Firestore for production data persistence
- Proxy trust enabled for HTTPS deployments

## Key API Endpoints

- `GET /` - Serves landing page (redirects to index.html)
- `GET /mayna-diamonds-feedback.html` - Feedback form
- `POST /submit-feedback` - Accept feedback submissions
- `GET /view-feedback` - Retrieve all feedback as JSON
- `GET /admin-dashboard.html` - Admin interface
- `GET /health` - Server health status

## Data Schema

### Feedback Data Structure
```javascript
{
  "name": "string",
  "whatsapp": "string", 
  "experience_rating": "1-5",
  "liked_most": ["array", "of", "strings"],
  "planning_to_buy": "string",
  "jewel_types": ["array", "of", "strings"]
}
```

### Excel Columns
1. Submission Date
2. Submission Time  
3. Liked Most (comma-separated)
4. Planning to Buy
5. Jewel Types (comma-separated)
6. Experience Rating
7. Name
8. WhatsApp Number

## Performance Notes

- Static file serving optimized for production
- Excel file operations are synchronous and may impact performance with high traffic
- Consider implementing database migration for production scalability
- CORS enabled for cross-origin requests
- Proxy configuration for production HTTPS deployments