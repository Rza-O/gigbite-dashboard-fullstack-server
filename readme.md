# GigBite Server

The server-side implementation of **GigBite**, a micro-task and earning platform that bridges workers and buyers for task-based collaborations. The server is built with Node.js, Express.js, and MongoDB, offering secure and scalable APIs to manage tasks, payments, notifications, and user interactions.



## Features

### **API Overview**
- RESTful APIs for buyers, workers, and admin functionalities.
- Endpoints secured with JWT-based authentication.
- Role-based access control (Admin, Buyer, Worker).

### **Authentication**
- JWT for secure session handling.
- Middleware for verifying tokens and roles.

### **Buyer Features**
- Add, update, and delete tasks.
- Approve or reject task submissions.
- Manage payments via Stripe integration.

### **Worker Features**
- Browse available tasks.
- Submit work for approval.
- View total earnings and pending submissions.

### **Admin Features**
- Manage all users (update roles, remove users).
- Approve withdrawal requests.
- View platform-wide statistics, including total users, coins, and payments.

### **Notification System**
- Notifications triggered on task updates, payment approvals, and submission approvals/rejections.
- Notifications stored in MongoDB and retrieved dynamically.

### **Payment System**
- Stripe-based payment integration for coin purchases.
- Payment history stored and retrievable for buyers.
- Withdrawal requests and approval by admin.



## Installation

### Prerequisites
Ensure you have the following installed:
- Node.js
- npm or yarn
- MongoDB

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/gigbite-server.git
   ```

2. Navigate to the project directory:
   ```bash
   cd gigbite-server
   ```

3. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

4. Configure environment variables:
   Create a `.env` file in the root directory and add the following:
   ```env
   DB_USER=mongodb_username
   DB_PASS=your_mongodb_password
   ACCESS_TOKEN_SECRET=jwt_token_here
   PAYMENT_GATEWAY_SECRET=your_stripe_secret_key
   ```

5. Start the server:
   ```bash
   npm run start
   ```

6. The server will run at:
   ```
   http://localhost:8000
   ```


## Dependencies

Below is the list of dependencies used in the project:

- **Core**:
  - `express`: ^4.18.2
  - `dotenv`: ^16.0.3

- **Authentication**:
  - `jsonwebtoken`: ^9.0.0
  
- **Database**:
  - `mongodb`: ^5.6.0

- **Payment Integration**:
  - `stripe`: ^11.17.0

- **Utilities**:
  - `morgan`: ^1.10.0


## Folder Structure

```plaintext
├── .env               # Environment variables
├── index.js          # Server entry point
└── package.json       # Dependencies and scripts
```



## Key Endpoints

### **Authentication**
- **POST** `//users/:email` - Register a new user.
- **POST** `/jwt` - Log in a user and generate a JWT.

### **Buyer Features**
- **POST** `/tasks` - Add a new task.
- **GET** `/buyer-dashboard/stats/:email` - Get buyer stats (task count, pending workers, total payments).

### **Worker Features**
- **GET** `/tasks` - Get all available tasks.
- **POST** `/my-submissions/:email` - Submit a task for approval.

### **Admin Features**
- **GET** `/admin/users` - Get all users.
- **PATCH** `/admin/users/:id` - Update a user’s role.
- **PATCH** `/admin/approval/:id` - Approve a withdrawal request.


## Scripts

- **Start Server**:
  ```bash
  npm run start
  ```

- **Development Mode**:
  ```bash
  npm run dev
  ```


## Author

Developed by [Shah Reza](https://github.com/Rza-O). For any questions or feedback, feel free to reach out.


## Feedback

If you encounter any issues or have suggestions for improvement, please open an issue in this repository.
