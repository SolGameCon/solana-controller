// Import Socket.IO client in your HTML file:
// <script src="/socket.io/socket.io.js"></script>

// Add a function to get or create socket connection
let socket = null;

function getSocket() {
    if (!socket) {
        console.log('Initializing new socket connection');
        socket = io();
        
        // Set up socket event handlers
        socket.on('connect', () => {
            console.log('Connected to server with userId:', userId);
        });

        socket.on('connection_accepted', (data) => {
            console.log('Connection accepted:', data);
        });

        socket.on('connection_rejected', (reason) => {
            console.log('Connection rejected:', reason);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        socket.on('button_press_received', (data) => {
            console.log('Server received button press:', data);
            if (!data.received) {
                showNotification(`Error: ${data.error || 'Failed to send input'}`);
            }
        });

        socket.on('chat_received', (response) => {
            if (!response.success) {
                showNotification(`Error: ${response.error || 'Failed to send message'}`);
            }
        });
    }
    return socket;
}

// Add gameName variable at the top with other constants
let gameName = 'Pokemon Red'; // Default fallback

// Add welcome overlay functionality
function showWelcomeOverlay() {
    console.log('Showing welcome overlay');
    
    // Create overlay without dynamic styles
    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.innerHTML = `
        <div class="welcome-content">
            <h2 style="color: #14F195; text-shadow: 0 0 10px rgba(20, 241, 149, 0.5);">Solana Game Controller! 🎮</h2>
            <h3 style="color: #9945FF;">Currently Playing: <span style="color: #14F195">${gameName}</span></h3>
            <p style="color: #E6E6E6;">A multi-user controlled game stream.<br>Token-gated by $SGC on Solana.<br><br>CA: ${TOKEN_MINT_ADDRESS}</p>
            
            <h3 style="color: #9945FF;">Is connecting safe?</h3>
            <p style="color: #E6E6E6;">We use standard Phantom/SolFlare sign-in methods for balance checking only. All code is open source on GitHub.</p>
            
            <h3 style="color: #9945FF;">How does it work?</h3>
            <p style="color: #E6E6E6;">Hold <span style="color: #14F195; font-weight: bold;">500,000 SGC</span> tokens to send game inputs and chat messages to the Twitch stream. Multiple inputs are queued and processed in order.</p>
            
            <h3 style="color: #9945FF;">Can I use this?</h3>
            <p style="color: #E6E6E6;">Yes! This project is open source and can be modified to suit your needs. Get help and contribute through GitHub or Twitter.</p>
            
            <button class="welcome-close-btn" style="background: linear-gradient(45deg, #14F195, #9945FF); border: none; color: white; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.3s ease;">Let's Play!</button>
        </div>
    `

    document.body.appendChild(overlay);

    // Add click handler to close button
    overlay.querySelector('.welcome-close-btn').addEventListener('click', () => {
        console.log('Closing welcome overlay'); // Add debug log
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 300);
        localStorage.setItem('welcomeShown', 'true');
    });
}

// Add a development mode check (you can modify this based on your environment)
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// If in development, always show the welcome overlay
if (isDevelopment) {
    console.log('Development mode: Clearing welcomeShown flag');
    localStorage.removeItem('welcomeShown');
}

// Show welcome overlay if it hasn't been shown before
console.log('Welcome shown status:', localStorage.getItem('welcomeShown')); // Debug log
if (!localStorage.getItem('welcomeShown')) {
    // Clear any existing welcome overlay first
    const existingOverlay = document.querySelector('.welcome-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Make sure DOM is loaded before showing overlay
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showWelcomeOverlay);
    } else {
        showWelcomeOverlay();
    }
}

// Add a function to force show the welcome overlay (for testing)
function resetWelcomeOverlay() {
    localStorage.removeItem('welcomeShown');
    showWelcomeOverlay();
}

// Use localStorage to maintain userId across page refreshes/tabs
let userId = localStorage.getItem('userId');
if (!userId) {
    userId = 'anon_' + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('userId', userId);
}

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
        getSocket().emit('button_press', {
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

// Handle chat message submission
document.querySelector('.chat-send').addEventListener('click', sendChatMessage);
document.querySelector('.chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

function sendChatMessage() {
    console.log('Attempting to send chat message');
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
        showNotification('You need at least 500,000 SGC to chat!');
        return;
    }

    console.log('Sending chat message:', message);

    getSocket().emit('chat_message', {
        userId: userId,
        message: message,
        timestamp: Date.now(),
        type: 'chat'
    });

    chatInput.value = '';
}

// Move initialization into a main function
async function initializeApp() {
    try {
        // Fetch config first
        const response = await fetch('/config');
        const config = await response.json();
        
        // Set global variables
        RPC_URL = config.RPC_URL;
        TOKEN_MINT_ADDRESS = config.TOKEN_MINT_ADDRESS;
        gameName = config.gameName;
        console.log('Loaded config from server');

        // Now initialize the rest of the app
        if (!localStorage.getItem('welcomeShown')) {
            const existingOverlay = document.querySelector('.welcome-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', showWelcomeOverlay);
            } else {
                showWelcomeOverlay();
            }
        }

        // Initialize button handlers
        initializeButtonHandlers();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showNotification('Failed to load configuration. Please refresh the page.');
    }
}

// Move button initialization to separate function
function initializeButtonHandlers() {
    // Controller buttons (excluding chat)
    document.querySelectorAll('.controller button:not(.chat-send)').forEach(button => {
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

            const buttonId = button.className;
            
            // Get socket and emit event
            getSocket().emit('button_press', {
                userId: userId,
                button: buttonId,
                timestamp: Date.now()
            });
            
            console.log(`Button pressed: ${buttonId}`);

            // Start cooldown
            canPress = false;
            statusLight.classList.add('cooldown');

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

    // Other buttons
    const pumpfunBtn = document.querySelector('.pumpfun-btn');
    const aboutBtn = document.querySelector('.about-btn');
    const twitterBtn = document.querySelector('.twitter-btn');
    const connectBtn = document.querySelector('.connect-btn');
    const chatSendBtn = document.querySelector('.chat-send');
    const chatInput = document.querySelector('.chat-input');

    // Clear existing listeners
    pumpfunBtn?.replaceWith(pumpfunBtn.cloneNode(true));
    aboutBtn?.replaceWith(aboutBtn.cloneNode(true));
    twitterBtn?.replaceWith(twitterBtn.cloneNode(true));
    connectBtn?.replaceWith(connectBtn.cloneNode(true));
    
    // Re-query and add listeners
    document.querySelector('.pumpfun-btn')?.addEventListener('click', () => {
        window.open(`https://pump.fun/${TOKEN_MINT_ADDRESS}`, '_blank');
    });

    document.querySelector('.about-btn')?.addEventListener('click', resetWelcomeOverlay);
    
    document.querySelector('.twitter-btn')?.addEventListener('click', () => {
        window.open('https://twitter.com/Solana_GC', '_blank');
    });
    
    document.querySelector('.connect-btn')?.addEventListener('click', connectWalletHandler);

    // Chat functionality
    const sendChatMessage = () => {
        console.log('Attempting to send chat message');
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
            showNotification('You need at least 500,000 SGC to chat!');
            return;
        }

        console.log('Sending chat message:', message);

        getSocket().emit('chat_message', {
            userId: userId,
            message: message,
            timestamp: Date.now(),
            type: 'chat'
        });

        chatInput.value = '';
    };

    // Add chat button listener
    document.querySelector('.chat-send')?.addEventListener('click', () => {
        console.log('Chat send button clicked');
        sendChatMessage();
    });

    // Add chat input enter key listener
    document.querySelector('.chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            console.log('Enter key pressed in chat input');
            sendChatMessage();
        }
    });
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Define the wallet connection handler
async function connectWalletHandler() {
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
                showNotification(`You need at least 500,000 SGC to interact with the controller!`);
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
}

// Add a helper function to check if user can interact
function canUserInteract() {
    return window.walletConnection && window.walletConnection.balance >= MINIMUM_POKE_BALANCE;
}

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

// Button click handlers
document.querySelector('.pumpfun-btn').addEventListener('click', () => {
    // Open PumpFun token page (replace with actual URL)
    window.open(`https://pump.fun/${TOKEN_MINT_ADDRESS}`, '_blank');
});

document.querySelector('.about-btn').addEventListener('click', () => {
    // Simply call resetWelcomeOverlay to show the welcome screen again
    resetWelcomeOverlay();
});

document.querySelector('.twitter-btn').addEventListener('click', () => {
    // Open Twitter page (replace with actual Twitter URL)
    window.open('https://twitter.com/Solana_GC', '_blank');
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
                showNotification(`You need at least 500,000 SGC to interact with the controller!`);
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