import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import indexRouter from './routes/index.js';
import widgetRouter from './routes/widget.js';
import adminRouter from './routes/admin.js';
import cooldown from './middleware/rateLimiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

app.use(morgan('dev'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser('SuperSecret')); // CHANGE CHANGE CHANGE CHANGE CHANGE CHANGE CHANGE CHANGE CHANGE CHANGE

app.use('/', indexRouter);
app.use('/widget', cooldown, widgetRouter); // rate limited routes here
app.use('/admin', adminRouter);

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
