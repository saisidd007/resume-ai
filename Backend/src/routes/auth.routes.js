const express = require('express')
const authController = require('../controller/auth.controller')
const authRouter = express.Router();
const authMiddleware =require('../middleware/auth.middleware')

authRouter.post("/register",authController.registerUserController);
authRouter.post("/login",authController.loginUserController);
authRouter.get("/logout",authController.logoutUserController)
console.log("authUser:", authMiddleware.authUser);
authRouter.get("/get-me",authMiddleware.authUser,authController.getMeController)

module.exports = authRouter;