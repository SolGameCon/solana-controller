// Import Socket.IO client in your HTML file:
// <script src="/socket.io/socket.io.js"></script>

const socket = io();

// Use localStorage to maintain userId across page refreshes/tabs
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = 'anon_' + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('userId', userId);
}

// Connect to server
socket.on('connect', () => {
    console.log('Connected to server with userId:', userId);
    socket.emit('user_connect', userId);
});

// Handle connection acceptance
socket.on('connection_accepted', (data) => {
    console.log('Connection accepted:', data);
});

// Handle connection rejection - clear userId if needed
socket.on('connection_rejected', (reason) => {
    console.log('Connection rejected:', reason);
    // Optionally, you could clear the userId to allow a new connection attempt
    // localStorage.removeItem('userId');
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

let canPress = true;
const COOLDOWN_TIME = 500; // 2 seconds in milliseconds
const statusLight = document.querySelector('.status-light');

// Add these constants at the top of your file
const SOLANA_NETWORK = 'mainnet-beta';
let RPC_URL = 'https://api.mainnet-beta.solana.com'; // Default fallback
let TOKEN_MINT_ADDRESS = '83iBDw3ZpxqJ3pEzrbttr9fGA57tttehDAxoFyR1moon'; // Replace with your token's mint address

// Update the minimum balance constant at the top of the file
const MINIMUM_POKE_BALANCE = 500000;

// Add these constants at the top of your file
const BALANCE_CHECK_FREQUENCY = 5; // Check balance every 5 clicks
let clickCounter = 0;

// Add notification function
function showNotification(message, duration = 3000) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create and show new notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger slide-in
    setTimeout(() => notification.classList.add('show'), 100);

    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Add function to check balance
async function checkTokenBalance() {
    if (!window.walletConnection || !window.solana.isConnected) return;

    console.log('Checking SGC balance...'); // Debug message

    try {
        const connection = new solanaWeb3.Connection(RPC_URL);
        const publicKey = new solanaWeb3.PublicKey(window.walletConnection.publicKey);
        
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            publicKey,
            { mint: new solanaWeb3.PublicKey(TOKEN_MINT_ADDRESS) }
        );

        let balance = 0;
        if (tokenAccounts.value.length > 0) {
            balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        }

        console.log(`Balance check complete: ${balance} SGC`); // Debug message

        // Update stored balance
        window.walletConnection.balance = balance;

        // Update button display
        const connectBtn = document.querySelector('.connect-btn');
        connectBtn.innerHTML = `
            <span style="font-size: 0.8em; margin-left: 5px;">(${balance >= 1000 ? (balance/1000).toFixed(0) + 'K' : Math.floor(balance)} SGC)</span>
        `;

        // Show notification if balance is now too low
        if (balance < MINIMUM_POKE_BALANCE) {
            showNotification(`Your SGC balance (${balance}) has fallen below the required 500,000. Click the wallet button to update your balance!`);
        }

        return balance;
    } catch (error) {
        console.error('Error checking token balance:', error);
        return null;
    }
}

// Update the button press handler
document.querySelectorAll('.controller button').forEach(button => {
    const pressHandler = async () => {
        if (!window.walletConnection) {
            showNotification('Please connect your wallet and hold SGC tokens to interact!');
            return;
        }
        
        if (!canUserInteract()) {
            showNotification(`You need at least 500,000 SGC to interact. Click the wallet button to update your balance!`);
            return;
        }

        if (!canPress) {
            console.log('Button press blocked by cooldown');
            return;
        }

        // Skip if it's the chat send button
        if (button.className === 'chat-send') {
            return;
        }

        // Get the button's class for identification
        const buttonId = button.className;
        
        // Emit the button press event
        socket.emit('button_press', {
            userId: userId,
            button: buttonId,
            timestamp: Date.now()
        });
        
        console.log(`Button pressed: ${buttonId}`);

        // Start cooldown
        canPress = false;
        statusLight.classList.add('cooldown');

        // Reset after cooldown
        setTimeout(() => {
            canPress = true;
            statusLight.classList.remove('cooldown');
        }, COOLDOWN_TIME);
    };

    button.addEventListener('click', pressHandler);
    button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        pressHandler();
    });
});

// Optional: Add feedback when server acknowledges the button press
socket.on('button_press_received', (data) => {
    console.log('Server received button press:', data);
    if (!data.received) {
        showNotification(`Error: ${data.error || 'Failed to send input'}`);
    }
});

// Handle chat message response
socket.on('chat_received', (response) => {
    if (!response.success) {
        showNotification(`Error: ${response.error || 'Failed to send message'}`);
    }
});

// Find the existing stream wrapper instead of creating it
const streamWrapper = document.querySelector('.stream-wrapper');

// // Find the existing input history container
// const inputHistoryContainer = document.querySelector('.input-history');

// Function to format timestamp
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

// // Function to add new input to the history display
// function addInputToHistory(input) {
//     if (!inputHistoryContainer) {
//         console.error('Input history container not found');
//         return;
//     }

//     const entry = document.createElement('div');
//     entry.className = 'history-entry';
    
//     console.log('Input received:', input); // Debug log
    
//     if (input.type === 'chat') {
//         entry.innerHTML = `<strong>${input.userId}</strong>: ${input.message}`;
//     } else if (input.button === 'chat-send') {
//         // Skip chat-send button presses
//         return;
//     } else {
//         entry.innerHTML = `<strong>${input.userId}</strong> pressed <span class="button-name">${input.button}</span>`;
//     }
    
//     inputHistoryContainer.insertBefore(entry, inputHistoryContainer.firstChild);
    
//     while (inputHistoryContainer.children.length > 24) {
//         inputHistoryContainer.removeChild(inputHistoryContainer.lastChild);
//     }
// }

// // Handle initial history
// socket.on('input_history', (history) => {
//     inputHistoryContainer.innerHTML = '';
//     history.forEach(input => addInputToHistory(input));
// });

// // Handle new inputs
// socket.on('new_input', (data) => {
//     addInputToHistory(data);
// });

// Add button handling at the top of the file, after socket initialization

// Button click handlers
document.querySelector('.pumpfun-btn').addEventListener('click', () => {
    // Open PumpFun token page (replace with actual URL)
    window.open('https://raydium.io/swap/?inputCurrency=sol&outputCurrency=YOUR_TOKEN_ADDRESS', '_blank');
});

document.querySelector('.about-btn').addEventListener('click', () => {
    // Create and show modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <h2>About Solana Game Controller</h2>
            <p>Welcome to Solana Game Controller! This is a collectively controlled game of Pokemon Red where viewers can control the character's actions using blockchain technology.</p>
            <p>To participate, you need to hold at least 500,000 SGC tokens in your connected Phantom or Solflare wallet.</p>
            <h3>How it works:</h3>
            <ul>
                <li>Connect your Phantom or Solflare wallet</li>
                <li>Use the controller buttons to send game inputs</li>
                <li>Chat with other players in Twitch</li>
                <li>Watch the stream to see your inputs affect the game in real-time</li>
                <li>Note: There is a short delay between inputs to prevent spam</li>
            </ul>
            <p>Check out our <a href="https://github.com/PatchFix/pumpfun_pokemon" target="_blank">GitHub repository</a></p>
            <p>Built with:</p>
            <ul>
                <li>Heroku for hosting</li>
                <li>Socket.io for real-time communication</li>
                <li>Node.JS for the backend server</li>
                <li>TMI.js for Twitch chat integration</li>
                <li>ngrok for secure tunneling</li>
                <li>Python for game input automation</li>
                <li>vJoy for virtual controller emulation</li>
            </ul>
        </div>
    `;
    document.body.appendChild(modal);

    // Close button functionality
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => modal.remove();

    // Click outside to close
    window.onclick = (event) => {
        if (event.target === modal) modal.remove();
    };
});

document.querySelector('.twitter-btn').addEventListener('click', () => {
    // Open Twitter page (replace with actual Twitter URL)
    window.open('https://twitter.com/YOUR_TWITTER_HANDLE', '_blank');
});

// Update the button press handler
document.querySelector('.connect-btn').addEventListener('click', async () => {
    try {
        // Check if either wallet is installed
        const isPhantomInstalled = window.solana && window.solana.isPhantom;
        const isSolflareInstalled = window.solflare && window.solflare.isSolflare;
        
        if (!isPhantomInstalled && !isSolflareInstalled) {
            // Create and show wallet selection modal
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close-btn">&times;</span>
                    <h2>Select Wallet</h2>
                    <p>Please install one of these wallets to continue:</p>
                    <div class="wallet-buttons">
                        <button onclick="window.open('https://phantom.app/', '_blank')" class="phantom-btn">
                            Install Phantom
                        </button>
                        <button onclick="window.open('https://solflare.com/', '_blank')" class="solflare-btn">
                            Install Solflare
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close button functionality
            const closeBtn = modal.querySelector('.close-btn');
            closeBtn.onclick = () => modal.remove();

            // Click outside to close
            window.onclick = (event) => {
                if (event.target === modal) modal.remove();
            };
            return;
        }

        // Connect to available wallet
        let wallet;
        let publicKey;
        
        if (isPhantomInstalled) {
            wallet = window.solana;
            const resp = await wallet.connect();
            publicKey = resp.publicKey.toString();
        } else if (isSolflareInstalled) {
            wallet = window.solflare;
            await wallet.connect();
            publicKey = wallet.publicKey.toString();
        }
        
        // Update userId with wallet address
        userId = publicKey.slice(0, 5);
        localStorage.setItem('userId', userId);

        // Update button text to show connecting state
        const connectBtn = document.querySelector('.connect-btn');
        connectBtn.textContent = 'Checking Balance...';

        // Set up Solana connection
        const connection = new solanaWeb3.Connection(RPC_URL);
        
        try {
            // Get token account
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                new solanaWeb3.PublicKey(publicKey),
                { mint: new solanaWeb3.PublicKey(TOKEN_MINT_ADDRESS) }
            );

            let balance = 0;
            if (tokenAccounts.value.length > 0) {
                // Get balance from the first token account
                balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            }

            // Update button text to show connected state with balance
            connectBtn.innerHTML = `
                <span style="font-size: 0.8em; margin-left: 5px;">${balance >= 1000 ? (balance/1000).toFixed(0) + 'K' : Math.floor(balance)} SGC</span>
            `;

            // Store connection info
            window.walletConnection = {
                publicKey: publicKey,
                balance: balance,
                wallet: wallet // Store wallet reference
            };

            // Update the balance check message
            if (balance < MINIMUM_POKE_BALANCE) {
                showNotification(`You need at least 500,000 POKE to interact with the controller!`);
            }

        } catch (error) {
            console.error('Error getting token balance:', error);
            connectBtn.textContent = `${publicKey.slice(0, 5)} (Error)`;
        }

    } catch (err) {
        console.error('Failed to connect to wallet:', err);
        alert('Failed to connect to wallet!');
        document.querySelector('.connect-btn').textContent = 'Connect';
    }
});

// Add a helper function to check if user can interact
function canUserInteract() {
    return window.walletConnection && window.walletConnection.balance >= MINIMUM_POKE_BALANCE;
}

// Add this fetch call before any code that uses RPC_URL
fetch('/config')
    .then(response => response.json())
    .then(config => {
        RPC_URL = config.RPC_URL;
        TOKEN_MINT_ADDRESS = config.TOKEN_MINT_ADDRESS;
        console.log('Loaded RPC URL from server config');
    })
    .catch(error => {
        console.warn('Failed to load server config, using fallback RPC URL:', error);
    });

// Example button names that match the controller
const buttonNames = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

// Function to simulate a random button press
// function simulateRandomButtonPress() {
//     const randomButton = buttonNames[Math.floor(Math.random() * buttonNames.length)];
//     const simulatedInput = {
//         userId: 'example_user',
//         button: randomButton.toUpperCase()
//     };

//     // Emit the simulated input
//     socket.emit('button_press', simulatedInput);
// }

// Run simulation every second
//setInterval(simulateRandomButtonPress, 5000);

// Handle chat message submission
document.querySelector('.chat-send').addEventListener('click', sendChatMessage);
document.querySelector('.chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function sendChatMessage() {
    const chatInput = document.querySelector('.chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    if (message.length > 140) {
        showNotification('Message must be 140 characters or less');
        return;
    }
    
    if (!window.walletConnection) {
        showNotification('Please connect your wallet to chat!');
        return;
    }
    
    if (!canUserInteract()) {
        showNotification('You need at least 500,000 POKE to chat!');
        return;
    }

    socket.emit('chat_message', {
        userId: userId,
        message: message,
        timestamp: Date.now(),
        type: 'chat'
    });

    chatInput.value = '';
}