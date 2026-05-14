import dotenv from "dotenv";
dotenv.config();

import express from 'express'
import bootStrap from "./src/app.controller.js"

const app = express()
const port = process.env.PORT

await bootStrap(app, express)


app.listen(port, () => console.log(`Server app listening on port ${port}!`))

export default app;
