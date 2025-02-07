const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const tmi = require('tmi.js'); // You'll need to install this: npm install tmi.js

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Update static file serving to use /public directory
app.use(express.static('public'));

// Store active connections and last 24 inputs
const activeUsers = new Map();
const lastInputs = [];
const MAX_INPUTS = 24;

// Twitch API credentials
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
const TWITCH_REFRESH_TOKEN = process.env.TWITCH_REFRESH_TOKEN;

// Twitch chat client setup with OAuth token
const twitchClient = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'pokepump', // Your channel name
        password: `oauth:${TWITCH_ACCESS_TOKEN}` // Use access token with oauth: prefix
    },
    channels: ['pokepump']
});

// Connect to Twitch
twitchClient.connect()
    .then(() => {
        console.log('Connected to Twitch chat');
        // Send test message
        twitchClient.say('pokepump', '🤖 Bot connected and ready!')
            .then(() => console.log('Test message sent successfully'))
            .catch(err => console.error('Error sending test message:', err));
    })
    .catch(err => console.error('Error connecting to Twitch:', err));

// Function to refresh token (implement if needed)
async function refreshTwitchToken() {
    try {
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: TWITCH_REFRESH_TOKEN,
                client_id: TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET
            })
        });

        const data = await response.json();
        // Update your stored tokens with data.access_token and data.refresh_token
        return data.access_token;
    } catch (error) {
        console.error('Error refreshing Twitch token:', error);
        throw error;
    }
}

// Function to append to commands.html
function appendToCommandsHtml(entry) {
    const commandsPath = path.join(__dirname, 'public', 'commands.html');
    
    // Create HTML entry
    const timestamp = new Date().toLocaleTimeString();
    let htmlEntry = '';
    
    if (entry.type === 'chat') {
        htmlEntry = `<div class="history-entry" style="text-align: left;"><span class="timestamp">${timestamp}</span> <strong>${entry.userId}</strong>: ${entry.message}</div>\n`;
    } else {
        htmlEntry = `<div class="history-entry" style="text-align: left;"><span class="timestamp">${timestamp}</span> <strong>${entry.userId}</strong> pressed <span class="button-name">${entry.button}</span></div>\n`;
    }

    // Append to commands.html
    fs.appendFile(commandsPath, htmlEntry, (err) => {
        if (err) {
            console.error('Error writing to commands.html:', err);
        }
    });
}

// Get configuration from environment variables
const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:5000';
const CONTROLLER_API_KEY = process.env.CONTROLLER_API_KEY || 'api_key'; // TODO: remove this

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on('user_connect', (userId) => {
        // Check if user is already connected
        if (activeUsers.has(userId)) {
            socket.emit('connection_rejected', 'User already connected');
            socket.disconnect();
            return;
        }

        // Store user connection
        activeUsers.set(userId, socket.id);
        socket.userId = userId;
        
       // // Send existing input history to new users
        socket.emit('input_history', lastInputs);

        socket.emit('connection_accepted', {
            message: 'Successfully connected',
            userId: userId
        });

        console.log(`User ${userId} connected. Active users: ${activeUsers.size}`);
    });

    socket.on('chat_message', async (data) => {
        console.log(`Chat message from ${data.userId}: ${data.message}`);
        
        try {
            // Send message to Twitch chat
            await twitchClient.say('pokepump', `${data.userId}: ${data.message}`);
            
            socket.emit('chat_received', {
                success: true,
                message: data.message
            });
        } catch (err) {
            console.error('Error sending message to Twitch:', err);
            
            // If error is due to invalid token, try refreshing
            if (err.message.includes('authentication')) {
                try {
                    const newToken = await refreshTwitchToken();
                    // Reconnect with new token
                    twitchClient.disconnect();
                    twitchClient.opts.identity.password = `oauth:${newToken}`;
                    await twitchClient.connect();
                    
                    // Retry sending message
                    await twitchClient.say('pokepump', `${data.userId}: ${data.message}`);
                    
                    socket.emit('chat_received', {
                        success: true,
                        message: data.message
                    });
                } catch (refreshErr) {
                    socket.emit('chat_received', {
                        success: false,
                        error: 'Failed to send message to Twitch chat'
                    });
                }
            } else {
                socket.emit('chat_received', {
                    success: false,
                    error: 'Failed to send message to Twitch chat'
                });
            }
        }
    });

    socket.on('button_press', async (data) => {
        console.log(`Button press from ${data.userId}: ${data.button}`);
        
        const inputEntry = {
            userId: data.userId,
            button: data.button,
            timestamp: data.timestamp,
            type: 'button'
        };

        // Send button press to Twitch chat
        try {
            await twitchClient.say('pokepump', `${data.userId} pressed ${data.button} 🎮`);
        } catch (err) {
            console.error('Error sending button press to Twitch:', err);
            
            // If error is due to invalid token, try refreshing
            if (err.message.includes('authentication')) {
                try {
                    const newToken = await refreshTwitchToken();
                    // Reconnect with new token
                    twitchClient.disconnect();
                    twitchClient.opts.identity.password = `oauth:${newToken}`;
                    await twitchClient.connect();
                    
                    // Retry sending message
                    await twitchClient.say('pokepump', `${data.userId} pressed ${data.button} 🎮`);
                } catch (refreshErr) {
                    console.error('Error after token refresh:', refreshErr);
                }
            }
        }

        // Broadcast to all clients
        io.emit('new_input', inputEntry);

        try {
            const response = await axios.post(`${CONTROLLER_URL}/input`, {
                button: data.button
            }, {
                headers: {
                    'Authorization': `Bearer ${CONTROLLER_API_KEY}`
                }
            });
            
            socket.emit('button_press_received', {
                received: true,
                button: data.button,
                timestamp: data.timestamp
            });
        } catch (error) {
            console.error('Failed to send input:', error);
            socket.emit('button_press_received', {
                received: false,
                button: data.button,
                timestamp: data.timestamp,
                error: error.message
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            activeUsers.delete(socket.userId);
            console.log(`User ${socket.userId} disconnected. Active users: ${activeUsers.size}`);
        }
    });
});

app.get('/config', (req, res) => {
    res.json({
        RPC_URL: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
        TOKEN_MINT_ADDRESS : process.env.TOKEN_MINT_ADDRESS
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
