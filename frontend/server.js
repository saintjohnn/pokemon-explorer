import app from "./app.js";
import { env } from "../config/env.js";

const port = env.frontendPort;

app.listen(port, () => {
  console.log(`frontend running on http://localhost:${port}`);
});
