import app from "./app.js";

const defaultPort = 3000;

const configuredPort = process.env.PORT;

const port =
  configuredPort === undefined ? defaultPort : Number(configuredPort);

if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

app.listen(port, () => {
  console.log(`server running on port ${port}!!!`);
});
