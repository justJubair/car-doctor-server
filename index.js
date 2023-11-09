const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;
require("dotenv").config();

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_KEY}@cluster0.hf0b3tt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


// middlewares related to JWT
const verifyToken = (req, res, next)=>{
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message: "unauthorized"});
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded)=>{
    //error
    if(error){
      return res.status(401).send({message: "unauthorized"})
    }
    //if token is valid then only it would be decoded
    req.user = decoded;
   
    next()
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // service collection
    const servicesCollection = client.db("carDoctorDB").collection("services");
    // order collection
    const ordersCollection = client.db("carDoctorDB").collection("orders");

    // auth related api
    app.post("/jwt", (req,res)=>{
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h"
      })
       res
        .cookie("token", token, {
          httpOnly: true,
          secure: true
        })
        .send({success:true})
    })
    // clear cookie api, JWT
    app.post("/logout", (req,res)=>{
      const user = req.body;
     
      res.clearCookie("token", {maxAge:0}).send({success:true})
    })

    // get services endpoint
    app.get("/services", async (req, res) => {
      const filter = req.query;
      const query = {
        // price: {$lt: 150}
        title: {$regex: filter.search, $options: "i"}
      }
      const options = {
        sort: {
          price: filter.sort === "asc" ? 1 : -1
        }
      }
      const cursor = servicesCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });
    // get a single service
    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.send(result);
    });

    // get endpoint of orders
    app.get("/orders", verifyToken, async (req, res) => {
      if(req.query?.email !== req.user?.email){
        return res.status(403).send({message: "forbidden"})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await ordersCollection.find(query).toArray();
      res.send(result);
    });

    // post a order by user, POST endpoint
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    // order, delete endpoint
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // order, patch endpoint
    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateOrder = req.body;
      const updatedDoc = {
        $set: {
          status: updateOrder.status,
        },
      };
      const result = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Car doctor server is RUNNING!");
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});
