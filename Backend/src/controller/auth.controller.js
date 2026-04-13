const userModel = require('../models/user.model');
const blacklistModel = require('../models/blacklist.model')
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ================= REGISTER =================
async function registerUserController(req, res) {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        // Check if user exists
        const isUserExists = await userModel.findOne({
            $or: [{ username }, { email }]
        });

        if (isUserExists) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        // Hash password
        const hash = await bcryptjs.hash(password, 10);

        // Create user
        const newUser = await userModel.create({
            username,
            email,
            password: hash
        });

        // Generate token
        const token = jwt.sign(
            {
                id: newUser._id,
                username: newUser.username
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        // Set cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // set true in production (HTTPS)
            sameSite: "lax"
        });

        return res.status(201).json({
            message: "User registered successfully",
            user: newUser
        });

    } catch (err) {
        return res.status(500).json({
            message: err.message
        });
    }
}

// ================= LOGIN =================
async function loginUserController(req, res) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                message: "Invalid credentials"
            });
        }

        // Find user
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(400).json({
                message: "Invalid credentials"
            });
        }

        // Compare password (correct order)
        const isPassValid = await bcryptjs.compare(password, user.password);

        if (!isPassValid) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        // Generate token
        const token = jwt.sign(
            {
                id: user._id,
                username: user.username
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        // Set cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: false, // set true in production
            sameSite: "lax"
        });

        return res.status(200).json({
            message: "User logged in successfully",
            user: user
        });

    } catch (err) {
        return res.status(500).json({
            message: err.message
        });
    }
}

async function logoutUserController(req,res) {
    const token = req.cookies.token;
    if(token){
        await blacklistModel.create({
            token
        })
    }
    res.clearCookie("token");
    res.status(200).json({
        message: "User logged out successfully"
    })

}
async function getMeController(req, res) {
    try {
        const user = await userModel.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (err) {
        return res.status(500).json({
            message: err.message
        });
    }
}
module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController
};
