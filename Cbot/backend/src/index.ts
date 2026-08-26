import { config } from "./config.js";
import { app } from "./app.js";

app.listen(config.port, () => {
  console.log(`Cbot backend listening on http://localhost:${config.port}`);
  console.log(`Health: http://localhost:${config.port}/health`);
  console.log(`Authorize YouTube: http://localhost:${config.port}/auth/youtube`);
});
