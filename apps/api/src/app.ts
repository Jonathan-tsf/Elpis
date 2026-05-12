import { Hono } from 'hono';
import { healthcheckRoute } from './routes/healthcheck';
import { meRoute } from './routes/me';
import { dailyLogRoute } from './routes/daily-log';
import { workoutsRoute } from './routes/workouts';
import { measurementsRoute } from './routes/measurements';
import { photosRoute } from './routes/photos';
import { statsRoute } from './routes/stats';
import { streaksRoute } from './routes/streaks';
import { questsRoute } from './routes/quests';
import { authMiddleware, type JwtVerifier } from './middlewares/auth';

export interface AppDeps {
  version: string;
  jwtVerifierStub: JwtVerifier;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.route('/healthcheck', healthcheckRoute(deps.version));
  app.use('/me/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/me', authMiddleware(deps.jwtVerifierStub));
  app.route('/me', meRoute());
  app.use('/daily-log/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/daily-log', authMiddleware(deps.jwtVerifierStub));
  app.route('/daily-log', dailyLogRoute());
  app.use('/workouts/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/workouts', authMiddleware(deps.jwtVerifierStub));
  app.route('/workouts', workoutsRoute());
  app.use('/measurements/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/measurements', authMiddleware(deps.jwtVerifierStub));
  app.route('/measurements', measurementsRoute());
  app.use('/photos/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/photos', authMiddleware(deps.jwtVerifierStub));
  app.route('/photos', photosRoute());
  app.use('/stats/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/stats', authMiddleware(deps.jwtVerifierStub));
  app.route('/stats', statsRoute());
  app.use('/streaks/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/streaks', authMiddleware(deps.jwtVerifierStub));
  app.route('/streaks', streaksRoute());
  app.use('/quests/*', authMiddleware(deps.jwtVerifierStub));
  app.use('/quests', authMiddleware(deps.jwtVerifierStub));
  app.route('/quests', questsRoute());
  return app;
}
