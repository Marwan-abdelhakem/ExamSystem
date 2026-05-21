import dotenv from "dotenv";
// dotenv.config();
dotenv.config({ path: "./src/config/.env" });

import express from 'express'
import bootStrap from "./src/app.controller.js"

const app = express()
// const port = process.env.PORT
const port = process.env.PORT || 3000

await bootStrap(app, express)


app.listen(port, () => console.log(`Server app listening on port ${port}!`))

export default app;
