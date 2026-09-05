import 'dotenv/config';

import {
  createApp,
} from './app.js';

import {
  checkDatabaseConnection,
} from './db/database.js';


const PORT =
  process.env.PORT || 4000;


async function startServer() {

  try {

    await checkDatabaseConnection();

    const app =
      createApp();

    app.listen(
      PORT,
      '0.0.0.0',
      () => {
        console.log(
          `MarketPulse backend listening on http://localhost:${PORT}`
        );
      }
    );

  } catch (error) {

    console.error(
      'Failed to start MarketPulse backend:',
      error
    );

    process.exit(1);
  }
}


startServer();