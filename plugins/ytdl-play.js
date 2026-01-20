const config = require('../config');
const { cmd } = require('../command');
const yts = require('yt-search');
const fetch = require('node-fetch'); // hakikisha fetch ipo

// API Key ya YouTube
const YT_API_KEY = 'AIzaSyAHYyQyarO-dW78hvPF_rdvOcprjR9Gfbc';

cmd({
    pattern: "yt2",
    alias: ["play2", "music"],
    react: "🎵",
    desc: "Download audio from YouTube",
    category: "download",
    use: ".song <query or url>",
    filename: __filename
}, async (conn, m, mek, { from, q, reply }) => {
    try {
        if (!q) return await reply("❌ Please provide a song name or YouTube URL!");

        let videoUrl, title;
        
        if (q.match(/(youtube\.com|youtu\.be)/)) {
            // URL ya YouTube
            videoUrl = q;
            const videoId = q.split(/[=/]/).pop();
            const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YT_API_KEY}&part=snippet,contentDetails`;
            const res = await fetch(apiUrl);
            const json = await res.json();
            if (!json.items || !json.items.length) return await reply("❌ Video not found!");
            title = json.items[0].snippet.title;
        } else {
            // Tafuta kwa query
            const search = await yts({ query: q, hl: 'en', gl: 'US' });
            if (!search.videos.length) return await reply("❌ No results found!");
            videoUrl = search.videos[0].url;
            title = search.videos[0].title;
        }

        await reply("⏳ Downloading audio...");

        const downloadApi = `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const response = await fetch(downloadApi);
        const data = await response.json();

        if (!data.success) return await reply("❌ Failed to download audio!");

        await conn.sendMessage(from, {
            audio: { url: data.result.download_url },
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: mek });

        await reply(`✅ *${title}* downloaded successfully!`);

    } catch (error) {
        console.error(error);
        await reply(`❌ Error: ${error.message}`);
    }
});
