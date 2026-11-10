const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// Routes
app.use("/api/todos", require("./routes/todoRoutes"));

app.get("/", (req, res) => {
  res.send("Todo API is Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});