require('dotenv').config();
const { REST, Routes } = require('discord.js');

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
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();
