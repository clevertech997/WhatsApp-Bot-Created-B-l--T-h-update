const { proto, downloadContentFromMessage, getContentType, generateWAMessage } = require('@whiskeysockets/baileys')
const fs = require('fs')

// Function ya kushusha media
const downloadMediaMessage = async (m, filename) => {
    if (!m?.msg) return null; // Hakuna message
    if (m.type === 'viewOnceMessage') m.type = m.msg.type

    let buffer = Buffer.from([]), stream, name

    switch (m.type) {
        case 'imageMessage':
            name = filename ? filename + '.jpg' : 'undefined.jpg'
            stream = await downloadContentFromMessage(m.msg, 'image')
            break
        case 'videoMessage':
            name = filename ? filename + '.mp4' : 'undefined.mp4'
            stream = await downloadContentFromMessage(m.msg, 'video')
            break
        case 'audioMessage':
            name = filename ? filename + '.mp3' : 'undefined.mp3'
            stream = await downloadContentFromMessage(m.msg, 'audio')
            break
        case 'stickerMessage':
            name = filename ? filename + '.webp' : 'undefined.webp'
            stream = await downloadContentFromMessage(m.msg, 'sticker')
            break
        case 'documentMessage':
            let ext = m.msg.fileName?.split('.').pop()?.toLowerCase() || 'bin'
            ext = ext.replace('jpeg', 'jpg').replace('png', 'jpg').replace('m4a', 'mp3')
            name = filename ? filename + '.' + ext : 'undefined.' + ext
            stream = await downloadContentFromMessage(m.msg, 'document')
            break
        default:
            return null
    }

    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
    fs.writeFileSync(name, buffer)
    return fs.readFileSync(name)
}

// Function ya ku-process message
const sms = (conn, m, store) => {
    if (!m) return m
    let M = proto.WebMessageInfo

    // Basic message info
    if (m.key) {
        m.id = m.key.id
        m.isBot = m.id?.startsWith('BAES') && m.id.length === 16
        m.isBaileys = m.id?.startsWith('BAE5') && m.id.length === 16
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup = m.chat?.endsWith('@g.us')
        m.sender = m.fromMe ? conn.user?.id.split(':')[0]+'@s.whatsapp.net' : m.isGroup ? m.key.participant : m.key.remoteJid
    }

    // Process message content
    if (m.message) {
        m.mtype = getContentType(m.message)
        m.msg = (m.mtype === 'viewOnceMessage')
            ? m.message[m.mtype]?.message?.[getContentType(m.message[m.mtype]?.message)] 
            : m.message[m.mtype]

        try {
            m.body = m.message?.conversation ||
                     m.message?.imageMessage?.caption ||
                     m.message?.videoMessage?.caption ||
                     m.message?.extendedTextMessage?.text ||
                     m.message?.buttonsResponseMessage?.selectedButtonId ||
                     m.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                     m.message?.templateButtonReplyMessage?.selectedId || ''
        } catch {
            m.body = ''
        }

        // Safely access quoted
        let quoted = m.msg?.contextInfo?.quotedMessage || null
        m.quoted = quoted
        m.mentionedJid = m.msg?.contextInfo?.mentionedJid || []

        if (m.quoted) {
            let type = getContentType(quoted)
            m.quoted = m.quoted[type] || quoted

            if (['productMessage'].includes(type)) {
                type = getContentType(m.quoted)
                m.quoted = m.quoted[type] || m.quoted
            }

            if (typeof m.quoted === 'string') m.quoted = { text: m.quoted }

            m.quoted.mtype = type
            m.quoted.id = m.msg?.contextInfo?.stanzaId || ''
            m.quoted.chat = m.msg?.contextInfo?.remoteJid || m.chat
            m.quoted.isBot = m.quoted.id?.startsWith('BAES') && m.quoted.id.length === 16
            m.quoted.isBaileys = m.quoted.id?.startsWith('BAE5') && m.quoted.id.length === 16
            m.quoted.sender = conn.decodeJid(m.msg?.contextInfo?.participant || '')
            m.quoted.fromMe = m.quoted.sender === (conn.user?.id)
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || ''
            m.quoted.mentionedJid = m.msg?.contextInfo?.mentionedJid || []

            // Quoted methods
            m.getQuotedObj = m.getQuotedMessage = async () => {
                if (!m.quoted.id) return false
                let q = await store.loadMessage(m.chat, m.quoted.id, conn)
                return exports.sms(conn, q, store)
            }
            const vM = m.quoted.fakeObj = M.fromObject({
                key: { remoteJid: m.quoted.chat, fromMe: m.quoted.fromMe, id: m.quoted.id },
                message: quoted,
                ...(m.isGroup ? { participant: m.quoted.sender } : {})
            })
            const key = { remoteJid: m.chat, fromMe: false, id: m.quoted.id, participant: m.quoted.sender }

            m.quoted.delete = async () => await conn.sendMessage(m.chat, { delete: key })
            m.forwardMessage = (jid, forceForward = true, options = {}) => conn.copyNForward(jid, vM, forceForward, { contextInfo: { isForwarded: false } }, options)
            m.quoted.download = () => conn.downloadMediaMessage(m.quoted)
        }
    }

    if (m.msg?.url) m.download = () => conn.downloadMediaMessage(m.msg)
    m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || ''

    // Reply & media-safe methods
    m.copy = () => exports.sms(conn, M.fromObject(M.toObject(m)))
    m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => conn.copyNForward(jid, m, forceForward, options)

    m.reply = async (content, opt = {}, type = "text") => {
        try {
            switch (type.toLowerCase()) {
                case "text":
                    return await conn.sendMessage(m.chat, { text: content }, { quoted: m })
                case "image":
                    if (Buffer.isBuffer(content)) return await conn.sendMessage(m.chat, { image: content, ...opt }, { quoted: m })
                    if (typeof content === 'string') return await conn.sendMessage(m.chat, { image: { url: content }, ...opt }, { quoted: m })
                    break
                case "video":
                    if (Buffer.isBuffer(content)) return await conn.sendMessage(m.chat, { video: content, ...opt }, { quoted: m })
                    if (typeof content === 'string') return await conn.sendMessage(m.chat, { video: { url: content }, ...opt }, { quoted: m })
                    break
                case "audio":
                    if (Buffer.isBuffer(content)) return await conn.sendMessage(m.chat, { audio: content, ...opt }, { quoted: m })
                    if (typeof content === 'string') return await conn.sendMessage(m.chat, { audio: { url: content }, ...opt }, { quoted: m })
                    break
                case "sticker":
                    if (!content) return
                    return await conn.sendMessage(m.chat, { sticker: content, ...opt }, { quoted: m })
                case "template":
                    const optional = await generateWAMessage(m.chat, content, opt)
                    const msg = { viewOnceMessage: { message: { ...optional.message } } }
                    return await conn.relayMessage(m.chat, msg, { messageId: optional.key?.id })
            }
        } catch (e) {
            console.error("Reply error:", e)
        }
    }

    m.senddoc = async (doc, type, id = m.chat, option = {}) => {
        try {
            if (!doc) return
            await conn.sendMessage(id, {
                document: doc,
                mimetype: option.mimetype || type || 'application/octet-stream',
                fileName: option.filename || 'file',
                contextInfo: { mentionedJid: option.mentions || [m.sender] }
            }, { quoted: m })
        } catch (e) {
            console.error("SendDoc error:", e)
        }
    }

    m.sendcontact = async (name, info, number) => {
        try {
            if (!name || !number) return
            const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nORG:${info || ''};\nTEL;type=CELL;type=VOICE;waid=${number}:+${number}\nEND:VCARD`
            await conn.sendMessage(m.chat, { contacts: { displayName: name, contacts: [{ vcard }] } }, { quoted: m })
        } catch (e) {
            console.error("SendContact error:", e)
        }
    }

    m.react = async (emoji) => {
        try {
            if (!emoji) return
            await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
        } catch (e) {
            console.error("React error:", e)
        }
    }

    return m
}

module.exports = { sms, downloadMediaMessage }
