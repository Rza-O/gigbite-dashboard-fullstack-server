require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const morgan = require('morgan');
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SECRET)
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
      const submissionsCollections = client.db('GigBite').collection('submissions');
      const withdrawalsCollections = client.db('GigBite').collection('withdrawals');
      const paymentsCollections = client.db('GigBite').collection('payments');
      const notificationCollections = client.db('GigBite').collection('notification');

      app.get('/users', verifyToken, async (req, res) => {
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
            return res.status(403).send({ message: 'Forbidden Access' })
         }
         const token = req.headers.authorization.split(' ')[1];
         if (!token) {
            return res.status(400).send({ message: 'Bad Request' })
         }
         jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
            if (error) {
               return res.status(401).send({ message: "Unauthorized Access" })
            }
            req.decoded = decoded;
            next()
         }
         )
      }

      // Verify Admin middleware
      const verifyAdmin = async (req, res, next) => {
         const email = req.decoded?.email;
         const query = { email };
         const result = await usersCollections.findOne(query);
         if (!result || result?.role !== 'admin') {
            return res.status(403).send({ message: "Forbidden Access" });
         }
         next();
      }

      // Verify buyer middleware
      const verifyBuyer = async (req, res, next) => {
         const email = req.decoded?.email;
         const query = { email };
         const result = await usersCollections.findOne(query);
         if (!result || result?.role !== 'buyer') {
            return res.status(403).send({ message: 'Forbidden Access' })
         }
         next();
      }

      // Verify worker middleware
      const verifyWorker = async (req, res, next) => {
         const email = req.decoded?.email;
         const query = { email };
         const result = await usersCollections.findOne(query);
         if (!result || result?.role !== 'worker') {
            return res.status(403).send({ message: 'Forbidden Access' })
         }
         next();
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
      app.get('/user/role/:email', verifyToken, async (req, res) => {
         const { email } = req.params;
         const result = await usersCollections.findOne({ email });
         const role = result?.role
         res.send(role);
      })

      // getting specific user data 
      app.get('/user/:email', verifyToken, async (req, res) => {
         const { email } = req.params;
         const result = await usersCollections.findOne({ email });
         res.send(result);
      })



      // task related apis

      // add task api
      // TODO: add buyer verification middleware
      app.post('/task', verifyToken, verifyBuyer, async (req, res) => {
         const taskInfo = req.body;
         const email = req.decoded.email;
         const filter = { email };
         await usersCollections.updateOne(filter, {
            $inc: { coin: -taskInfo.totalCost }
         })
         const result = await tasksCollections.insertOne(taskInfo);
         res.send(result)
      })

      // get all tasks where required worker gt 1
      // TODO: add worker middleware
      app.get('/tasks', verifyToken, verifyWorker, async (req, res) => {
         const result = await tasksCollections.find({ required_workers: { $gt: 0 } }).toArray();
         res.send(result);
      })

      // getting single task details by id
      // add worker middleware
      app.get('/task/:id', verifyToken, verifyWorker, async (req, res) => {
         const { id } = req.params;
         const filter = { _id: new ObjectId(id) };
         const result = await tasksCollections.findOne(filter);
         res.send(result);
      })

      // getting all tasks added by a single user
      // TODO: add buyer middleware
      app.get('/tasks/:email', verifyToken, verifyBuyer, async (req, res) => {
         const { email } = req.params;
         const filter = { 'buyer.buyer_email': email }
         const result = await tasksCollections.find(filter).sort({ deadline: -1 }).toArray();
         res.send(result);
      })

      // update a single task
      // TODO: Add buyer middleware
      app.patch('/task/:id', verifyToken, verifyBuyer, async (req, res) => {
         const { id } = req.params;
         const filter = { _id: new ObjectId(id) };
         const updateData = req.body;
         const result = await tasksCollections.updateOne(filter, {
            $set: updateData
         })
         res.send(result);
      })

      // delete a task
      // TODO: have to implement coin for already submitted works
      // TODO: Add buyer
      app.delete('/task/:id', verifyToken, verifyBuyer, async (req, res) => {
         const { id } = req.params;
         const { email } = req.decoded;
         const filter = { _id: new ObjectId(id) };

         // isn't letting delete the ask util there's no pending submission with same taskId
         const pendingSubmission = await submissionsCollections.findOne({
            taskId: id,
            status: 'pending'
         })

         if (pendingSubmission) {
            return res.status(400).send({ message: 'Please review all submissions related to this task before deleting' })
         }

         const taskData = await tasksCollections.findOne(filter);
         console.log(taskData)
         const totalCost = taskData.totalCost;
         console.log(totalCost)
         const updateCoin = await usersCollections.updateOne({ email }, {
            $inc: { coin: totalCost }
         })
         console.log(updateCoin)
         const result = await tasksCollections.deleteOne(filter);
         console.log(result)
         res.send(result);
      })

      // Getting buyer dashboard stats
      app.get('/buyer-dashboard/stats/:email', async (req, res) => {
         const { email } = req.params;
         // getting all the task added by a buyer
         const query = { 'buyer.buyer_email': email }
         const totalAddedTask = await tasksCollections.countDocuments(query);

         // getting all the pending tasks
         const pendingWorkersData = await tasksCollections.aggregate([
            { $match: query },
            { $group: { _id: null, pendingWorkers: { $sum: "$required_workers" } } },
         ]).toArray();
         const pendingWorkerCount = pendingWorkersData[0]?.pendingWorkers || 0;

         // total payment made by a user
         const paymentQuery = { email };
         const totalPaymentsData = await paymentsCollections.aggregate([
            { $match: paymentQuery },
            { $group: { _id: null, totalPaid: { $sum: { $toInt: '$price' } } } },
         ]).toArray();
         const totalPaid = totalPaymentsData[0]?.totalPaid || 0;

         res.send({
            totalAddedTask,
            pendingWorkerCount,
            totalPaid
         })
      })

      // Submission save to the database
      // TODO: ADD worker middleware
      app.post('/work-submit', verifyToken, verifyWorker, async (req, res) => {
         const submissionData = req.body;
         const { taskId, task_title, buyer_name, buyer_email } = submissionData;
         const option = { _id: new ObjectId(taskId) }
         const workerDecrement = await tasksCollections.updateOne(option, {
            $inc: { required_workers: -1 }
         });

         const result = await submissionsCollections.insertOne(submissionData);

         // sending a notification to the notification collection
         const notification = {
            message: `You have submission request from ${buyer_name} for ${task_title}`,
            toEmail: buyer_email,
            actionRoute: '/dashboard',
            time: new Date(),
            status: 'unread'
         }
         await notificationCollections.insertOne(notification);

         res.send(result);
      })

      // Getting all the submissions made by a user
      // TODO: add worker middleware
      app.get('/my-submissions/:email', verifyToken, verifyWorker, async (req, res) => {
         const { email } = req.params;
         const { page = 1, limit = 5 } = req.query;

         const currentPage = parseInt(page);
         const itemsPerPage = parseInt(limit);
         const skip = (currentPage - 1) * itemsPerPage;

         const filter = { worker_email: email };
         const submissions = await submissionsCollections
            .find(filter)
            .skip(skip)
            .limit(itemsPerPage)
            .toArray();

         const totalSubmissions = await submissionsCollections.countDocuments(filter);
         const totalPages = Math.ceil(totalSubmissions / itemsPerPage);

         res.send({
            submissions,
            totalSubmissions,
            currentPage,
            totalPages,
         });
      })

      // Getting all submission for a buyers work
      // TODO: add buyer middleware
      app.get('/my-work/submissions/:email', verifyToken, verifyBuyer, async (req, res) => {
         const { email } = req.params;
         const filter = { buyer_email: email, status: 'pending' };
         const result = await submissionsCollections.find(filter).toArray();
         res.send(result);
      })

      // Changing status to approved and rejected
      // TODO: Add Buyer middleWare
      app.patch('/submission/status/:id', verifyToken, verifyBuyer, async (req, res) => {
         const { status } = req.body;
         const { id } = req.params;
         const filter = { _id: new ObjectId(id) };

         // find the doc to update
         const submissionData = await submissionsCollections.findOne(filter);

         // now change the total cost, add coin and status change if status is 'approved'
         if (submissionData) {
            const { taskId, payable_amount, worker_email, task_title, buyer_name } = submissionData;

            // update status in the submission collection
            await submissionsCollections.updateOne(filter, {
               $set: { status }
            })

            if (status === 'approved') {
               // decreasing the total cost so that when task deleted i can easily add the total cost back to the buyer coin
               await tasksCollections.updateOne(
                  { _id: new ObjectId(taskId) },
                  { $inc: { totalCost: -payable_amount } }
               );

               // adding the payable coin to the worker total coin
               await usersCollections.updateOne(
                  { email: worker_email },
                  { $inc: { coin: payable_amount } }
               );

               // adding a notification to the notification collection
               const notification = {
                  message: `You have earned ${payable_amount} coins from ${buyer_name} for ${task_title}`,
                  toEmail: worker_email,
                  actionRoute: '/dashboard/my-submissions',
                  time: new Date(),
                  status: 'unread'
               }
               await notificationCollections.insertOne(notification);
            } else if (status === 'rejected') {
               // increasing required worker by 1 in task collection
               await tasksCollections.updateOne(
                  { _id: new ObjectId(taskId) },
                  { $inc: { required_workers: 1 } }
               )
               // sending notification to notification collection for rejection of work
               const notification = {
                  message: `Your submission for ${task_title} was rejected by ${buyer_name}`,
                  toEmail: worker_email,
                  actionRoute: '/dashboard/my-submissions',
                  time: new Date(),
                  status: 'unread'
               }
               await notificationCollections.insertOne(notification);
            }
         }
         res.send({ message: 'Submission status updated' })
      })

      // Getting worker dashboard stats
      // TODO: add worker middleware
      app.get('/worker-dashboard/stats/:email', verifyToken, verifyWorker, async (req, res) => {
         const { email } = req.params;
         const totalSubmission = await submissionsCollections.countDocuments({ worker_email: email });
         const pendingSubmission = await submissionsCollections.countDocuments({
            worker_email: email,
            status: 'pending',
         });
         const totalEarningsData = await submissionsCollections.aggregate([
            { $match: { worker_email: email, status: 'approved' } },
            { $group: { _id: null, totalEarnings: { $sum: '$payable_amount' } } },
         ]).toArray();
         const totalEarnings = totalEarningsData[0]?.totalEarnings || 0;
         res.send({
            totalSubmission,
            pendingSubmission,
            totalEarnings
         })
      })


      // getting all the submission that only is approved
      // TODO: add worker middleware
      app.get('/approved-submission/:email', verifyToken, verifyWorker, async (req, res) => {
         const { email } = req.params;
         const result = await submissionsCollections.find({ worker_email: email, status: 'approved' }).toArray();
         res.send(result);
      })

      // posting withdrawal request
      // TODO: add worker middleware
      app.post('/withdrawals/:email', verifyToken, verifyWorker, async (req, res) => {
         const withdrawalData = req.body;
         // const { email } = req.params;
         // TODO: do this operation when
         // const increaseCoin = await usersCollections.updateOne({ email }, {
         //    $inc: { coin: -withdrawalData.withdrawal_coin }
         // })
         // console.log(increaseCoin)
         const result = await withdrawalsCollections.insertOne(withdrawalData);
         res.send(result);
      })

      // Payment related apis

      // Payment intent api
      app.post('/create-payment-intent', verifyToken, verifyBuyer, async (req, res) => {
         const { coins, price } = req.body;
         console.log('this is body-> ', req.body)
         const paymentIntent = await stripe.paymentIntents.create({
            amount: price * 100,
            currency: 'usd',
            payment_method_types: ['card'],
            description: `${coins} Coins Purchased`
         })
         console.log(paymentIntent)
         console.log('this is secret=> ', paymentIntent.client_secret)
         res.send({ clientSecret: paymentIntent.client_secret });
      })

      // saving payment data to the db
      app.post('/save-payment', verifyToken, verifyBuyer, async (req, res) => {
         const paymentData = req.body;
         const { email, coins } = paymentData;
         const result = await paymentsCollections.insertOne(paymentData);

         // updating user coin
         const updateCoin = await usersCollections.updateOne({ email }, {
            $inc: { coin: parseInt(coins) }
         })
         res.send([result, updateCoin]);
      })

      // payment history for a single buyer
      app.get('/payment-history/:email', verifyToken, verifyBuyer, async (req, res) => {
         const { email } = req.params;
         const result = await paymentsCollections.find({ email }).toArray();
         res.send(result);
      })


      // admin Stats
      app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
         const totalWorker = await usersCollections.countDocuments({ role: 'worker' });
         const totalBuyer = await usersCollections.countDocuments({ role: 'buyer' });
         const totalAvailableCoins = await usersCollections.aggregate([
            {
               $group: { _id: null, totalCoin: { $sum: '$coin' } }
            }
         ]).toArray();
         const totalPayment = await paymentsCollections.countDocuments();
         const totalWithdrawals = await withdrawalsCollections.countDocuments({ status: 'approved' });
         res.send({ totalWorker, totalBuyer, totalAvailableCoin: totalAvailableCoins[0].totalCoin || 0, totalWithdrawals, totalPayment })
      })

      // getting all the withdrawal requests
      app.get('/admin/withdrawal-requests', verifyToken, verifyAdmin, async (req, res) => {
         const result = await withdrawalsCollections.find({ status: 'pending' }).toArray();
         res.send(result);
      })

      // changing the status of withdrawals and decreasing coin from the worker
      app.patch('/admin/approval/:id', verifyToken, verifyAdmin, async (req, res) => {
         const { id } = req.params;
         const filter = { _id: new ObjectId(id) };

         const withdrawalRequestData = await withdrawalsCollections.findOne(filter);
         const { worker_email, withdrawal_coin,
            withdrawal_amount } = withdrawalRequestData;
         await usersCollections.updateOne({ email: worker_email }, {
            $inc: { coin: -withdrawal_coin }
         });
         // console.log(updateUserCoin)
         const result = await withdrawalsCollections.updateOne(filter, {
            $set: { status: 'approved' }
         });

         //sending notification after successfully approving withdrawal 
         const notification = {
            message: `Your request of ${withdrawal_amount}$ has been approved by admin`,
            toEmail: worker_email,
            actionRoute: '/dashboard/withdrawals',
            time: new Date(),
            status: 'unread'
         }
         await notificationCollections.insertOne(notification);
         res.send(result)
      })

      // fetch all users
      app.get('/admin/users', verifyToken, verifyAdmin, async (req, res) => {
         const result = await usersCollections.find().toArray();
         res.send(result)
      })

      // Fetch all tasks
      app.get('/admin/tasks', verifyToken, verifyAdmin, async (req, res) => {
         const result = await tasksCollections.find().toArray();
         res.send(result)
      })

      // delete a specific users
      app.delete('/admin/users/:id', verifyToken, verifyAdmin, async (req, res) => {
         const { id } = req.params;
         const query = { _id: new ObjectId(id) }
         const result = await usersCollections.deleteOne(query);
         res.send(result);
      })
      // delete a specific tasks
      app.delete('/admin/tasks/:id', verifyToken, verifyAdmin, async (req, res) => {
         const { id } = req.params;
         const query = { _id: new ObjectId(id) }
         const result = await tasksCollections.deleteOne(query);
         res.send(result);
      })

      // update a specific user
      app.patch('/admin/users/:id', verifyToken, verifyAdmin, async (req, res) => {
         const { id } = req.params;
         const { role } = req.body;
         const query = { _id: new ObjectId(id) };
         const result = await usersCollections.updateOne(query, {
            $set: { role }
         });
         res.send(result);
      })

      // getting all the notification for a specific user
      app.get('/notifications/:email', verifyToken, async (req, res) => {
         const { email } = req.params;
         const notification = await notificationCollections
            .find({ toEmail: email })
            .sort({ time: -1 })
            .toArray();
         res.send(notification);
      })

      // patching notification mark as read end point
      app.patch('/notifications/read/:id', verifyToken, async (req, res) => {
         const { id } = req.params;
         const filter = { _id: new ObjectId(id) }
         const result = await notificationCollections.updateOne(filter, {
            $set: { status: 'read' }
         });
         res.send(result);
      })

      // Getting Best workers
      app.get('/best-workers', async (req, res) => {
         const result = await usersCollections.find({ role: "worker" }, {
            projection: { name: 1, image: 1, coin: 1, _id: 0 }
         }).sort({ coin: -1 }).limit(6).toArray();
         res.send(result);
      })




      // Connect the client to the server	(optional starting in v4.7)
      // await client.connect();
      // Send a ping to confirm a successful connection
      // await client.db("admin").command({ ping: 1 });
      // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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