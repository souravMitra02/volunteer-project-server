
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const nodemailer = require("nodemailer");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// =======================
// Middleware
// =======================
app.use(cors());
app.use(express.json());

// =======================
// MongoDB Connection
// =======================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ssk8yog.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// =======================
// Nodemailer Setup
// =======================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

// =======================
// Email Sender Function (HTML Template)
// =======================
const sendVolunteerEmail = async (to, userName, postTitle) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: "Welcome Back to Volunteer Hub!",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 30px;">
          <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 15px; box-shadow: 0 0 10px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #FF7F50; padding: 20px; text-align: center; color: #fff;">
              <h1>Welcome Back!</h1>
            </div>
            <div style="padding: 20px; color: #333;">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>Thank you for volunteering for "<strong>${postTitle}</strong>". We’re excited to have you on board!</p>
              <p>Check out new volunteer opportunities and make a difference today.</p>
              <a href="http://localhost:3000" style="display: inline-block; margin-top: 20px; background-color: #FF7F50; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none;">Go to Dashboard</a>
            </div>
            <div style="background-color: #f1f1f1; padding: 10px; text-align: center; font-size: 12px; color: #555;">
              &copy; 2025 Volunteer Hub. All rights reserved.
            </div>
          </div>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to:", to);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
};

// =======================
// MongoDB Routes
// =======================
async function run() {
  try {
    const db = client.db("volunteerDB");
    const volunteerCollection = db.collection("volunteerPosts");
    const volunteerRequests = db.collection("volunteerRequests");

    app.get("/", (req, res) => {
      res.send("Volunteer Management Server is running!");
    });

    // Get 6 posts for homepage
    app.get("/volunteer-now", async (req, res) => {
      const posts = await volunteerCollection
        .find()
        .sort({ deadline: 1 })
        .limit(6)
        .toArray();
      res.send(posts);
    });

    // Get all volunteer posts
    app.get("/volunteer-posts", async (req, res) => {
      const search = req.query.search || "";
      const query = { postTitle: { $regex: search, $options: "i" } };
      const posts = await volunteerCollection.find(query).toArray();
      res.send(posts);
    });

    // Add new volunteer post
    app.post("/volunteer-posts", async (req, res) => {
      const newPost = req.body;
      const result = await volunteerCollection.insertOne(newPost);
      res.send(result);
    });

    // Get single post by ID
    app.get("/volunteer-posts/:id", async (req, res) => {
      const id = req.params.id;
      const result = await volunteerCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // My posts (for organizers)
    app.get("/my-posts", async (req, res) => {
      const email = req.query.email;
      const posts = await volunteerCollection.find({ organizerEmail: email }).toArray();
      res.send(posts);
    });

    // Volunteer requests by volunteer email
    app.get("/volunteer-requests", async (req, res) => {
      const email = req.query.email;
      const result = await volunteerRequests.find({ volunteerEmail: email }).toArray();
      res.send(result);
    });

    // Add new volunteer request + send email
    app.post("/volunteer-request", async (req, res) => {
      const newRequest = req.body;
      const insertResult = await volunteerRequests.insertOne(newRequest);

      if (newRequest.volunteerEmail) {
        await sendVolunteerEmail(
          newRequest.volunteerEmail,
          newRequest.volunteerName || "Volunteer",
          newRequest.postTitle
        );
      }

      res.send({ insertResult });
    });

    // Cancel volunteer request + update post
    app.delete("/cancel-request/:id", async (req, res) => {
      const id = req.params.id;
      const request = await volunteerRequests.findOne({ _id: new ObjectId(id) });

      const deleteResult = await volunteerRequests.deleteOne({ _id: new ObjectId(id) });

      if (request) {
        const updatePost = await volunteerCollection.updateOne(
          { _id: new ObjectId(request.postId) },
          { $inc: { volunteersNeeded: 1 } }
        );
        res.send({ deleteResult, updatePost });
      } else {
        res.send({ deleteResult, updatePost: null });
      }
    });

    // Update a post
    app.put("/volunteer-posts/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await volunteerCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    // Delete a post
    app.delete("/volunteer-posts/:id", async (req, res) => {
      const id = req.params.id;
      const result = await volunteerCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Direct Email API (optional)
    app.post("/send-email", async (req, res) => {
      const { email, userName, postTitle } = req.body;
      try {
        await sendVolunteerEmail(email, userName, postTitle);
        res.status(200).json({ message: "Email sent successfully!" });
      } catch (error) {
        res.status(500).json({ error: "Failed to send email" });
      }
    });

  } finally {
    // Do not close connection
  }
}

run().catch(console.dir);

// =======================
// Start Server
// =======================
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
