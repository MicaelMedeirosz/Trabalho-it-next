import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { registerUser, loginUser } from "./auth.service";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email e password são obrigatórios" });
    }
    const user = await registerUser(name, email, password);
    res.status(201).json(user);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email e password são obrigatórios" });
    }
    const result = await loginUser(email, password);
    res.json(result);
  })
);
