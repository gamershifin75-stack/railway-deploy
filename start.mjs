// start.mjs
// Ensure MINDSERVER_PORT is set to the platform PORT before importing main.js
process.env.MINDSERVER_PORT = process.env.PORT || process.env.MINDSERVER_PORT || '8080';
console.log('MINDSERVER_PORT=', process.env.MINDSERVER_PORT);
import './main.js';
