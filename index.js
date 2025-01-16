require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
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
      const tasksCollections = client.db('GigBite').collection('tasks');

      app.get('/users', async (req, res) => {
         const result = await usersCollections.find().toArray();
         res.send(result);
      })


      // jwt related api
      app.post('/jwt', (req, res) => {
         const user = req.body;
         const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6h' });
         res.send({ token });
      })

      // verify token middleware
      const verifyToken = async (req, res, next) => {
         console.log('inside middleware', req.headers.authorization);
         if (!req.headers.authorization) {
            return res.status(403).send({message: 'Forbidden Access'})
         }
         const token = req.headers.authorization.split(' ')[1];
         if (!token) {
            return res.status(400).send({ message: 'Bad Request' })
         }
         jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
            if (error) {
               return res.status(401).send({message: "Unauthorized Access"})
            }
            req.decoded = decoded;
            next()
         }
         )
      }


      // posting single user data to the db if doesn't exist
      app.post('/users/:email', async (req, res) => {
         const user = req.body;
         const { email } = req.params;
         const defaultCoin = req.body.role === 'worker' ? 10 : 50;
         const userData = { ...user, coin: defaultCoin }
         const isExist = await usersCollections.findOne({ email })
         if (isExist) {
            return res.send({ message: 'User already exists' });
         }
         const result = await usersCollections.insertOne(userData);
         res.send(result);
      })

      // Getting user role
      app.get('/user/role/:email', verifyToken,async (req, res) => {
         const { email } = req.params;
         const result = await usersCollections.findOne({ email });
         const role = result?.role
         res.send(role);
      })

      // getting specific user data 
      // TODO: Add admin verification here
      app.get('/user/:email', verifyToken, async (req, res) => {
         const { email } = req.params;
         const result = await usersCollections.findOne({ email });
         res.send(result);
      })


      // task related apis

      // add task api
      // TODO: add buyer verification middleware
      app.post('/task', verifyToken,async (req, res) => {
         const taskInfo = req.body;
         const email = req.decoded.email;
         const filter = { email };
         await usersCollections.updateOne(filter, {
            $inc: {coin: -taskInfo.totalCost}
         })
         const result = await tasksCollections.insertOne(taskInfo);
         res.send(result)
      })

      // getting all tasks added by a single user
      // TODO: add buyer middleware
      app.get('/tasks/:email', verifyToken, async (req, res) => {
         const { email } = req.params;
         const filter = {'buyer.buyer_email' : email}
         const result = await tasksCollections.find(filter).toArray();
         res.send(result);
      })

      // update a single task
      // TODO: Add buyer middleware
      app.patch('/task/:id', verifyToken, async (req, res) => {
         const { id } = req.params;
         const filter = { _id: new ObjectId(id) };
         const updateData = req.body;
         const result = await tasksCollections.updateOne(filter, {
            $set: updateData
         })
         res.send(result);
      })

      // delete a task 
      // 
      app.delete('/task/:id', verifyToken, async (req, res) => {
         const { id } = req.params;
         const filter = { _id: new ObjectId(id) };
         const result = await tasksCollections.deleteOne(filter);
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