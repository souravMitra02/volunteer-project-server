// =======================
// IMPORTS
// =======================
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const nodemailer = require("nodemailer");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");

// =======================
// BASIC SETUP
// =======================
const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// =======================
// MONGODB CONNECTION
// =======================
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ssk8yog.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1 } });

async function startServer() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db("volunteerDB");
    const volunteerCollection = db.collection("volunteerPosts");
    const volunteerRequests = db.collection("volunteerRequests");

    // =======================
    // EMAIL SETUP
    // =======================
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

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
                  <a href="https://volunteer-project.netlify.app" style="display: inline-block; margin-top: 20px; background-color: #FF7F50; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none;">Go to Dashboard</a>
                </div>
                <div style="background-color: #f1f1f1; padding: 10px; text-align: center; font-size: 12px; color: #555;">
                  &copy; 2025 Volunteer Hub. All rights reserved.
                </div>
              </div>
            </div>
          `,
        };
        await transporter.sendMail(mailOptions);
        console.log("📧 Email sent to:", to);
      } catch (error) {
        console.error("❌ Email sending failed:", error);
      }
    };

    // =======================
    // ROUTES
    // =======================
    app.get("/", (req, res) => res.send("Volunteer Management Server is running!"));

    // Volunteer Posts CRUD
    app.get("/volunteer-now", async (req, res) => {
      const posts = await volunteerCollection.find().sort({ deadline: 1 }).limit(6).toArray();
      res.send(posts);
    });

    app.get("/volunteer-posts", async (req, res) => {
      const search = req.query.search || "";
      const query = { postTitle: { $regex: search, $options: "i" } };
      const posts = await volunteerCollection.find(query).toArray();
      res.send(posts);
    });

    app.post("/volunteer-posts", async (req, res) => {
      const result = await volunteerCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/volunteer-posts/:id", async (req, res) => {
      const result = await volunteerCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.put("/volunteer-posts/:id", async (req, res) => {
      const result = await volunteerCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.delete("/volunteer-posts/:id", async (req, res) => {
      const result = await volunteerCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Volunteer Requests
    app.get("/volunteer-requests", async (req, res) => {
      const email = req.query.email;
      const result = await volunteerRequests.find({ volunteerEmail: email }).toArray();
      res.send(result);
    });

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

    app.delete("/cancel-request/:id", async (req, res) => {
      const id = req.params.id;
      const request = await volunteerRequests.findOne({ _id: new ObjectId(id) });
      const deleteResult = await volunteerRequests.deleteOne({ _id: new ObjectId(id) });

      if (request) {
        await volunteerCollection.updateOne(
          { _id: new ObjectId(request.postId) },
          { $inc: { volunteersNeeded: 1 } }
        );
      }

      res.send({ deleteResult });
    });

  } catch (error) {
    console.error("❌ Error starting server:", error);
  }
}

// =======================
// START SERVER
// =======================
startServer();

server.listen(port, () => console.log(`Server running on port ${port}`));
