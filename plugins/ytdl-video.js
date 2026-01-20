const config = require('../config');
const { cmd } = require('../command');
const ytdl = require('ytdl-core');
const { google } = require('googleapis');
const fetch = require('node-fetch'); // kama bado unataka fetch kwa thumbnails
const path = require('path');
const fs = require('fs-extra');

// YouTube API key
const YT_API_KEY = "AIzaSyAHYyQyarO-dW78hvPF_rdvOcprjR9Gfbc";
const youtube = google.youtube({ version: 'v3', auth: YT_API_KEY });

cmd({
    pattern: "video2",
    alias: ["mp4", "song"],
    react: "🎥",
    desc: "Download video from YouTube",
    category: "download",
    use: ".video <query or url>",
    filename: __filename
}, async (conn, m, mek, { from, q, reply }) => {
    try {
        if (!q) return await reply("❌ Please provide a video name or YouTube URL!");

        let videoUrl, title;

        // Kama ni URL
        if (ytdl.validateURL(q)) {
            videoUrl = q;
            const info = await ytdl.getInfo(videoUrl);
            title = info.videoDetails.title;
        } else {
            // Tafuta video kwa query using YouTube API
            const searchRes = await youtube.search.list({
                part: "snippet",
                q: q,
                type: "video",
                maxResults: 1
            });
            if (!searchRes.data.items.length) return await reply("❌ No results found!");
            const videoId = searchRes.data.items[0].id.videoId;
            videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            title = searchRes.data.items[0].snippet.title;
        }

        await reply("⏳ Downloading video...");

        // Pakua video na ytdl-core
        const filePath = path.join(__dirname, `${title}.mp4`);
        const stream = ytdl(videoUrl, { quality: "highestvideo" });
        const writeStream = fs.createWriteStream(filePath);
        stream.pipe(writeStream);

        writeStream.on("finish", async () => {
            await conn.sendMessage(from, {
                video: { url: filePath },
                mimetype: "video/mp4",
                caption: `📹 ${title}`
            }, { quoted: mek });

            fs.unlinkSync(filePath); // Futa file baada ya kutumwa
        });

        stream.on("error", (err) => {
            console.error(err);
            reply("❌ Failed to download video.");
        });

    } catch (error) {
        console.error(error);
        await reply(`❌ Error: ${error.message}`);
    }
});
