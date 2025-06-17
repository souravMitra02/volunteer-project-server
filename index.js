const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ssk8yog.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("volunteerDB");
    const volunteerCollection = db.collection("volunteerPosts");
    const volunteerRequests = db.collection("volunteerRequests");

 
    app.get("/volunteer-now", async (req, res) => {
      const posts = await volunteerCollection
        .find()
        .sort({ deadline: 1 })
        .limit(6)
        .toArray();
      res.send(posts);
    });

    
    app.get("/volunteer-posts", async (req, res) => {
      const search = req.query.search || "";
      const query = {
        postTitle: { $regex: search, $options: "i" },
      };
      const posts = await volunteerCollection.find(query).toArray();
      res.send(posts);
    });


    app.post("/volunteer-posts", async (req, res) => {
      const newPost = req.body;
      const result = await volunteerCollection.insertOne(newPost);
      res.send(result);
    });

    app.get("/volunteer-posts/:id", async (req, res) => {
      const id = req.params.id;
      const result = await volunteerCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

   
    app.get("/my-posts", async (req, res) => {
      const email = req.query.email;
      const posts = await volunteerCollection.find({ organizerEmail: email }).toArray();
      res.send(posts);
    });

    app.post("/volunteer-request", async (req, res) => {
      const requestData = req.body;

      const insertResult = await volunteerRequests.insertOne(requestData);

      const updateResult = await volunteerCollection.updateOne(
        { _id: new ObjectId(requestData.postId)},
        { $inc: { volunteersNeeded: -1 } }
      );

      res.send({ insertResult, updateResult });
    });

    
    app.get("/my-volunteer-requests", async (req, res) => {
      const email = req.query.email;
      const result = await volunteerRequests.find({ volunteerEmail: email }).toArray();
      res.send(result);
    });

     app.delete("/cancel-request/:id", async (req, res) => {
      const id = req.params.id;
      const request = await volunteerRequests.findOne({ _id: new ObjectId(id) });

      const deleteResult = await volunteerRequests.deleteOne({ _id: new ObjectId(id) });

      const updatePost = await volunteerCollection.updateOne(
        { _id: new ObjectId(request.postId) },
        { $inc: { volunteersNeeded: 1 } }
      );

      res.send({ deleteResult, updatePost });
    });

     app.put("/volunteer-posts/:id", async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;
    const result = await volunteerCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    res.send(result);
  
}); 
      app.delete("/volunteer-posts/:id", async (req, res) => {
  const id = req.params.id;
  
    const result = await volunteerCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
});

    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected!");
  } finally {
    // await client.close(); 
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Volunteer Management Server is running!");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
