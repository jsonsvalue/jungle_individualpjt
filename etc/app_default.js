// Load the http module to create an HTTP server.
const http = require('http');

// Define a port number where the server will be listening.
const port = 3000;

// Create the server and define the response for every incoming request.
const server = http.createServer((req, res) => {
    res.statusCode = 200; // HTTP status code for a successful request.
    res.setHeader('Content-Type', 'text/html'); // Setting content type to HTML.
    res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>My Homepage</title>
        </head>
        <body>
            <h1>Welcome to My Homepage</h1>
            <p>This is a basic homepage created with Node.js.</p>
        </body>
        </html>
    `);
});

// Start the server on the specified port and log a message once it's running.
server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
