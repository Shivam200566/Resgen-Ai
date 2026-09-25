const mongoose = require('mongoose');
async function connectToDB(){

try{
    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000
    });
    console.log("connected to database");
} catch (error) {
    console.error("Error connecting to database:", error);
    throw error;
}
}
module.exports = connectToDB;