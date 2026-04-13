const app = require('./src/app');
const connectDB = require('./src/config/db')
require("dotenv").config()

app.listen(3000, async () => {
    try {
        await connectDB();
        console.log("Server running on port 3000 with DB connected");
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
});
