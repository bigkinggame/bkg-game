const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const fs = require('fs');

ffmpeg.setFfprobePath(ffprobePath);

ffmpeg.setFfmpegPath(ffmpegPath);

const videoPath = "C:\\Users\\ANUBHAV\\Videos\\Screen Recordings\\Screen Recording 2026-10-13 174138.mp4";
const outDir = "C:\\Users\\ANUBHAV\\.gemini\\antigravity\\brain\\07f073bb-39bf-44da-aff1-cf3459ba8372\\scratch\\frames";

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Extract 1 frame every 10 seconds, max 12 frames
ffmpeg(videoPath)
  .on('start', cmd => console.log('Started:', cmd))
  .on('progress', p => console.log('Processing:', JSON.stringify(p)))
  .on('end', () => console.log('✅ Frames extracted to:', outDir))
  .on('error', err => console.error('❌ Error:', err.message))
  .screenshots({
    count: 12,
    folder: outDir,
    filename: 'frame_%i.png',
    size: '1280x?'
  });
