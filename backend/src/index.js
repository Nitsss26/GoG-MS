require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));
app.use(cors());

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/financials', require('./routes/financials'));
app.use('/api/operations', require('./routes/operations'));
app.use('/api/communications', require('./routes/communications'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`🚀 Institutional Server started on port ${PORT}`));
