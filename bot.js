require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits } = require('discord.js');
const keyManager = require('./keyManager');

// Configuration - Replace these with your values
const CONFIG = {
    TOKEN: process.env.DISCORD_TOKEN || 'cess.env.DISCORD_TOKEN',
    CLIENT_ID: process.env.CLIENT_ID || '1423474049098580039',
    MEDIA_ROLE_ID: process.env.MEDIA_ROLE_ID || '1403267204354539531' // Get this from your server
};

// Validate config
if (!CONFIG.TOKEN || CONFIG.TOKEN === 'YOUR_BOT_TOKEN') {
    console.error('❌ Please set your Discord bot token in the .env file');
    process.exit(1);
}

// Use minimal required intents
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Command definitions
const commands = [
    {
        name: 'mediaadd',
        description: 'Add media role and generate key for a user',
        options: [
            {
                name: 'user',
                description: 'The user to add the media role to',
                type: 6, // USER type
                required: true,
            }
        ],
        default_member_permissions: PermissionFlagsBits.ManageRoles.toString(),
    },
    {
        name: 'listkeys',
        description: 'List all generated keys (Admin only)',
        default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    },
    {
        name: 'addkeys',
        description: 'Add multiple keys for users (Admin only)',
        default_member_permissions: PermissionFlagsBits.Administrator.toString(),
        options: [
            {
                name: 'key_data',
                description: 'User mentions and keys in format @user1:key1 @user2:key2',
                type: 3, // STRING type
                required: true,
            }
        ]
    }
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(CONFIG.CLIENT_ID),
            { body: commands },
        );
        console.log('✅ Successfully registered application commands.');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

// When the client is ready
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    await registerCommands();
});

// Handle interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'mediaadd') {
        try {
            await interaction.deferReply({ ephemeral: true });

            const targetUser = options.getUser('user');
            const targetMember = interaction.guild.members.cache.get(targetUser.id);
            
            if (!targetMember) {
                return interaction.editReply('❌ Could not find that user in this server.');
            }

            // Check if user already has a key
            if (keyManager.hasKey(targetUser.id)) {
                return interaction.editReply({
                    content: `❌ ${targetUser.tag} already has a media key.`
                });
            }

            // Add the media role
            try {
                await targetMember.roles.add(CONFIG.MEDIA_ROLE_ID);
                
                // Assign a key to the user
                const { key, isNew, error } = keyManager.assignKeyToUser(targetUser.id);
                
                if (error) {
                    return interaction.editReply({
                        content: `❌ Error: ${error}`
                    });
                }
                
                if (!isNew) {
                    return interaction.editReply({
                        content: `❌ ${targetUser.tag} already has a media key.`
                    });
                }
                
                // Try to DM the key to the user
                try {
                    await targetUser.send({
                        content: `🔑 **Your Media Access Key For Emerald services**\n` +
                        `||${key}||\n\n` +
                        `⚠️ **DO NOT SHARE THIS KEY WITH ANYONE**\n` +
                        `⚠️ **This is the only time you will see this key**`
                    });
                    
                    await interaction.editReply({
                        content: `✅ Successfully added the Media role to ${targetUser.tag} and sent them their access key!`
                    });
                } catch (dmError) {
                    console.error('Failed to send DM:', dmError);
                    await interaction.editReply({
                        content: `✅ Added Media role to ${targetUser.tag} but couldn't send them a DM. ` +
                                'Please tell them to enable DMs from server members.'
                    });
                }
            } catch (roleError) {
                console.error('Error adding role:', roleError);
                await interaction.editReply({
                    content: '❌ Failed to add the Media role. Please check bot permissions and role hierarchy.'
                });
            }
        } catch (error) {
            console.error('Error in mediaadd command:', error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    content: '❌ There was an error executing this command!', 
                    ephemeral: true 
                });
            }
        }
    } else if (commandName === 'listkeys') {
        try {
            // Check if user has admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ 
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true 
                });
            }

            const assignedKeys = keyManager.getAllAssignedKeys();
            const availableKeys = keyManager.getAllAvailableKeys();
            const totalKeys = availableKeys.length;
            const usedKeys = Object.keys(assignedKeys).length;
            
            if (totalKeys === 0) {
                return interaction.reply({
                    content: 'No keys found in keys.txt. Please add keys to the file.',
                    ephemeral: true
                });
            }

            // Format the assigned keys for display
            const assignedList = Object.entries(assignedKeys)
                .map(([key, userId]) => {
                    const user = client.users.cache.get(userId);
                    const username = user ? user.tag : `Unknown User (${userId})`;
                    return `**${username}**: ||${key}||`;
                })
                .join('\n');
                
            // Create a summary
            const summary = `**Key Usage**: ${usedKeys}/${totalKeys} keys used (${Math.round((usedKeys / totalKeys) * 100)}%)\n\n`;
            const keysList = summary + (assignedList || 'No keys have been assigned yet.');
            
            await interaction.reply({
                content: keysList,
                ephemeral: true
            });
        } catch (error) {
            console.error('Error in listkeys command:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the command.',
                ephemeral: true
            });
        }
    } else if (commandName === 'addkeys') {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.editReply({
                    content: '❌ You do not have permission to use this command.',
                    ephemeral: true
                });
            }

            const keyData = interaction.options.getString('key_data');
            const entries = keyData.split(/\s+/).filter(entry => entry.trim() !== '');
            const results = [];

            for (const entry of entries) {
                const match = entry.match(/<@!?(\d+)>:(\w+)/);
                if (!match) {
                    results.push(`❌ Invalid format: ${entry}`);
                    continue;
                }

                const userId = match[1];
                const key = match[2];

                try {
                    // Check if user already has a key
                    if (keyManager.hasKey(userId)) {
                        results.push(`⚠️ User <@${userId}> already has a key`);
                        continue;
                    }

                    // Add the key
                    const user = await client.users.fetch(userId).catch(() => null);
                    if (!user) {
                        results.push(`❌ User ${userId} not found`);
                        continue;
                    }

                    // Add the media role if they're in the server
                    const member = interaction.guild.members.cache.get(userId);
                    if (member) {
                        try {
                            await member.roles.add(CONFIG.MEDIA_ROLE_ID);
                        } catch (roleError) {
                            console.error('Error adding role:', roleError);
                            results.push(`⚠️ Added key for ${user.tag} but couldn't add Media role`);
                        }
                    }

                    // Save the key
                    const keys = keyManager.loadKeys();
                    keys[userId] = key;
                    keyManager.saveKeys(keys);

                    // Try to DM the key to the user
                    try {
                        await user.send({
                            content: `🔑 **Your Media Access Key For Emerald Services**\n` +
                            `||${key}||\n\n` +
                            `⚠️ **DO NOT SHARE THIS KEY WITH ANYONE**\n` +
                            `⚠️ **This is the only time you will see this key**`
                        });
                        results.push(`✅ Added key for ${user.tag} and sent DM`);
                    } catch (dmError) {
                        results.push(`✅ Added key for ${user.tag} but couldn't send DM`);
                    }
                } catch (error) {
                    console.error(`Error processing ${entry}:`, error);
                    results.push(`❌ Error processing: ${entry}`);
                }
            }

            // Send the results
            const resultText = results.join('\n');
            if (resultText.length <= 2000) {
                await interaction.editReply({
                    content: `**Key Assignment Results**\n\n${resultText}`,
                    ephemeral: true
                });
            } else {
                // If too long, send as a file
                const fs = require('fs');
                const fileName = `key_results_${Date.now()}.txt`;
                fs.writeFileSync(fileName, resultText);
                
                await interaction.editReply({
                    content: 'Key assignment results:',
                    files: [fileName],
                    ephemeral: true
                });
                
                // Delete the file after sending
                fs.unlinkSync(fileName);
            }
        } catch (error) {
            console.error('Error in addkeys command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while processing the command.',
                ephemeral: true
            });
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

// Login to Discord
client.login(CONFIG.TOKEN)
    .then(() => console.log('🔌 Bot is connecting to Discord...'))
    .catch(error => {
        console.error('❌ Failed to log in to Discord:');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        process.exit(1);
    });
