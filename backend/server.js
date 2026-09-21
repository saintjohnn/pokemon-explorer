import app from "./app.js";
import { env } from "./src/config/env.js";

const port = env.port;

app.listen(port, () => {
  console.log(`server running on port ${port}!!!`);
});
