# Mayna Diamonds Feedback System

A complete feedback form system that stores data in Excel files with a modern, responsive design.

## 🚀 Features

- ✨ Modern, responsive feedback form
- 📊 Data storage in Excel (.xlsx) format
- 🌟 5-star rating system
- ✅ Multi-select options for preferences
- 📱 Mobile-friendly design
- 🔄 Real-time form submission
- 📈 Easy data viewing and export

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## 🛠️ Local Setup Instructions

### 1. Install Dependencies
```bash
cd "C:\Users\prash\OneDrive\Documents\New workflow"
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Access the Application
- Open your browser and go to: `http://localhost:8080`
- The feedback form will be accessible at the root URL
- View submitted data at: `http://localhost:8080/view-feedback`

## 📁 File Structure

```
├── package.json              # Dependencies and scripts
├── server.js                 # Backend server with Excel integration
├── mayna-diamonds-feedback.html  # Frontend form
├── feedback_data.xlsx        # Excel file (auto-created)
└── README.md                 # This file
```

## 📊 Excel File Structure

The system automatically creates an Excel file with these columns:
- **Submission Date**: Date of form submission
- **Submission Time**: Time of form submission  
- **Liked Most**: What customers liked most (can be multiple)
- **Planning to Buy**: Customer's purchase intentions
- **Jewel Types**: Types of jewelry they're interested in
- **Experience Rating**: 1-5 star rating
- **Name**: Customer name
- **WhatsApp Number**: Contact number

## 🔗 API Endpoints

- `GET /` - Serves the feedback form
- `POST /submit-feedback` - Submits feedback data
- `GET /view-feedback` - View all feedback data as JSON
- `GET /health` - Server health check

## 🌐 Hosting Options (Zero Cost)

### 1. **Render** (Recommended) ⭐
- **Free Tier**: 750 hours/month
- **Pros**: Easy deployment, automatic SSL, custom domains
- **Cons**: Sleeps after 15 mins of inactivity
- **Setup**: Connect GitHub repo and deploy

### 2. **Railway**
- **Free Tier**: $5 credit monthly
- **Pros**: Very easy setup, good performance
- **Cons**: Limited free credit
- **Setup**: Connect repo and deploy

### 3. **Cyclic**
- **Free Tier**: Unlimited for personal use
- **Pros**: No sleep mode, fast deployment
- **Cons**: Newer platform
- **Setup**: GitHub integration

### 4. **Glitch**
- **Free Tier**: Always available
- **Pros**: Great for prototyping, web-based editor
- **Cons**: Limited storage and CPU
- **Setup**: Import from GitHub

### 5. **Heroku** (Limited Free)
- **Free Tier**: 550-1000 hours/month
- **Pros**: Very reliable, good documentation
- **Cons**: Requires credit card for verification
- **Setup**: Use Heroku CLI or GitHub integration

## 🚀 Deployment Steps (Render Example)

1. Push your code to GitHub
2. Go to [render.com](https://render.com)
3. Create account and connect GitHub
4. Create "New Web Service"
5. Select your repository
6. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node.js
7. Deploy!

## ⚠️ Important Notes for Hosting

- Excel files will be stored in the server's file system
- For production, consider using a database instead of Excel
- Make sure to backup your Excel files regularly
- Some free hosting platforms may reset file storage on deploys

## 🔧 Production Considerations

For a production setup, consider:
- Using a proper database (MongoDB, PostgreSQL)
- Adding form validation
- Implementing rate limiting
- Adding authentication for viewing data
- Using environment variables for configuration
- Setting up automated backups

## 💡 Tips

- The Excel file is automatically created when the server starts
- Data is appended to the Excel file with each submission
- You can download the Excel file directly from the server
- For large amounts of data, consider switching to a database solution