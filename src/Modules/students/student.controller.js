import express from "express";
import { authentication } from "../../Middelwares/auth.middlewares.js";
import UserModel from "../../DB/model/user.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";

const router = express.Router();

router.get("/search", authentication, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return successResponse({
        res,
        message: "Query parameter is empty",
        data: [],
      });
    }

    // Search by email only and role must be Student
    const students = await UserModel.find({
      email: { $regex: q, $options: "i" },
      role: "Student",
    }).select("name email _id");

    return successResponse({
      res,
      message: "Students searched successfully",
      data: students,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
