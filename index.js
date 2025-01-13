require('dotenv').config();
const cookieParser = require('cookie-parser');
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));


app.get('/', (req, res) => {
   res.send('Gig is Up')
})
app.listen(port, () => {
   console.log(`Find Gig on port: ${port}`)
})