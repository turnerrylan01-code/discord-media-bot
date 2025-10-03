const fs = require('fs');
const path = require('path');

const KEYS_FILE = path.join(__dirname, 'keys.txt');
const USED_KEYS_FILE = path.join(__dirname, 'used-keys.json');

// Initialize the used keys file if it doesn't exist
if (!fs.existsSync(USED_KEYS_FILE)) {
    fs.writeFileSync(USED_KEYS_FILE, JSON.stringify({}, null, 2));
}

// Load all available keys from keys.txt
function loadAvailableKeys() {
    try {
        if (!fs.existsSync(KEYS_FILE)) {
            console.warn('⚠️  keys.txt not found. Creating an empty one.');
            fs.writeFileSync(KEYS_FILE, '# Add one key per line\n# The bot will use these keys in order\nKEY1_HERE\nKEY2_HERE\nKEY3_HERE');
            return [];
        }
        
        const content = fs.readFileSync(KEYS_FILE, 'utf8');
        // Filter out comments and empty lines, then trim whitespace
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    } catch (error) {
        console.error('Error loading keys:', error);
        return [];
    }
}

// Load used keys (mapping of key to user ID)
function loadUsedKeys() {
    try {
        const data = fs.readFileSync(USED_KEYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading used keys:', error);
        return {};
    }
}

// Save used keys
function saveUsedKeys(usedKeys) {
    try {
        fs.writeFileSync(USED_KEYS_FILE, JSON.stringify(usedKeys, null, 2));
    } catch (error) {
        console.error('Error saving used keys:', error);
    }
}

// Get the next available key
function getNextAvailableKey() {
    const availableKeys = loadAvailableKeys();
    const usedKeys = loadUsedKeys();
    
    // Find the first key that hasn't been used
    for (const key of availableKeys) {
        if (!usedKeys[key]) {
            return key;
        }
    }
    
    return null; // No more keys available
}

// Assign a key to a user
function assignKeyToUser(userId) {
    const usedKeys = loadUsedKeys();
    
    // Check if user already has a key
    for (const [key, assignedUserId] of Object.entries(usedKeys)) {
        if (assignedUserId === userId) {
            return {
                key,
                isNew: false
            };
        }
    }
    
    // Get the next available key
    const key = getNextAvailableKey();
    if (!key) {
        return {
            key: null,
            isNew: false,
            error: 'No more keys available'
        };
    }
    
    // Assign the key to the user
    usedKeys[key] = userId;
    saveUsedKeys(usedKeys);
    
    return {
        key,
        isNew: true
    };
}

// Check if a user already has a key
function hasKey(userId) {
    const usedKeys = loadUsedKeys();
    return Object.values(usedKeys).includes(userId);
}

// Get all assigned keys (for admin purposes)
function getAllAssignedKeys() {
    return loadUsedKeys();
}

// Get all available keys (for admin purposes)
function getAllAvailableKeys() {
    return loadAvailableKeys();
}

module.exports = {
    assignKeyToUser,
    hasKey,
    getAllAssignedKeys,
    getAllAvailableKeys
};
