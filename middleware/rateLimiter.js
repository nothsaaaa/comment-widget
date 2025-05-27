import rateLimit from 'express-rate-limit';

const cooldown = rateLimit({
  windowMs: 10 * 1000,
  max: 2,
  message: 'Too many requests, please wait a few seconds.',
  skip: (req) => req.method === 'GET' // skip rate limit on GET requests
});


export default cooldown;
