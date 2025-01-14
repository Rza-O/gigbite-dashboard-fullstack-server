require('dotenv').config();
const cookieParser = require('cookie-parser');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
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

// MONGODB starts here


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kbg9j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   }
});

async function run() {
   try {

      const usersCollections = client.db('GigBite').collection('users');

      app.get('/users', async (req, res) => {
         const result = await usersCollections.find().toArray();
         res.send(result);
      })


      // posting single user data to the db if doesn't exist
      app.post('/users', async (req, res) => {
         const userData = req.body;
         console.log('full data->', userData)
         const email = userData.email
         console.log('email we are looking-> email')
         const isExist = await usersCollections.findOne({ email })
         if (isExist) {
            return res.send({ message: 'User already exists' });
         }
         const result = await usersCollections.insertOne(userData);
         console.log('result: ', result)
         res.send(result);
      })



      // Connect the client to the server	(optional starting in v4.7)
      // await client.connect();
      // Send a ping to confirm a successful connection
      // await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
   } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
   }
}
run().catch(console.dir);



app.get('/', (req, res) => {
   res.send('Gig is Up')
})
app.listen(port, () => {
   console.log(`Find Gig on port: ${port}`)
})