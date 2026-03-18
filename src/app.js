const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middlewares/error.middleware');
const initCronJobs = require('./workers/cronJobs');

const authRoutes = require('./routes/auth.routes');
const targetRoutes = require('./routes/target.routes');
const alertRoutes = require('./routes/alert.routes');

const app = express();

app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/alerts', alertRoutes);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
    initCronJobs();
}

module.exports = app;