import http from "http";
import { createApp } from "./app";
import { initSocket } from "./modules/notifications/socket";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const app = createApp();
const httpServer = http.createServer(app);

initSocket(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`API + Socket.IO listening on port ${env.PORT}`);
});
