# Video Creator Web

AI-powered video generation using Google Gemini APIs. Create animated short-form videos with AI-generated images, narration, and motion.

## Features

- **AI Script Generation** - Generate video scripts from text prompts
- **Image Generation** - Create scene images using Imagen 4
- **Video Animation** - Animate images with Veo 2.0
- **AI Narration** - Generate voiceovers with Gemini TTS
- **Style Modes** - AI-generated images or use your own photos
- **Templates** - Pre-built templates for different video types
- **Real-time Progress** - Track generation progress with live updates

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: iron-session
- **APIs**: Google Gemini (Script, Imagen 4, Veo 2.0, TTS)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file:

```env
GEMINI_API_KEY=your_gemini_api_key
AUTH_EMAIL=mccoy.bill@gmail.com
AUTH_PASSWORD_HASH=your_sha256_password_hash
SESSION_SECRET=your_session_secret_at_least_32_characters
```

To generate the password hash:
```bash
echo -n "Lakers#1" | shasum -a 256 | awk '{print $1}'
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### 1. Connect to Vercel

```bash
vercel
```

### 2. Set Environment Variables

In Vercel dashboard or via CLI:

```bash
vercel env add GEMINI_API_KEY
vercel env add AUTH_EMAIL
vercel env add AUTH_PASSWORD_HASH
vercel env add SESSION_SECRET
```

### 3. Deploy

```bash
vercel --prod
```

## Usage

1. **Login** - Use credentials: `mccoy.bill@gmail.com` / `Lakers#1`
2. **Create Video** - Enter prompt, choose settings, generate
3. **Track Progress** - Watch real-time progress with stage indicators
4. **Download Results** - Get individual scene clips (video + audio)
5. **View History** - Access all previously generated videos

## Templates

- **Talking Characters** - Animated characters with dialogue
- **Property Tour** - Real estate walkthroughs
- **Explainer** - Educational content
- **Pet Tips** - Pet care advice
- **Mortgage Tips** - Home financing guidance
- **Cruise Highlights** - Travel destination showcases

## API Routes

- `POST /api/auth` - Login
- `DELETE /api/auth` - Logout
- `POST /api/generate` - Start video generation
- `GET /api/status/[jobId]` - Get job status
- `GET /api/result/[jobId]` - Get final results
- `GET /api/history` - List previous jobs
- `GET /api/outputs/[jobId]/[filename]` - Serve generated files

## Pipeline Stages

1. **Script** - Generate video script with Gemini
2. **Images** - Create scene images with Imagen 4
3. **Videos** - Animate images with Veo 2.0 (90s cooldown between scenes)
4. **Audio** - Generate narration with Gemini TTS
5. **Complete** - All assets ready for download

## Important Notes

- **No Server-Side FFmpeg** - Due to Vercel limitations, assembly is skipped. Individual scene clips are provided for download.
- **Rate Limits** - 90-second cooldown between video generations to avoid API rate limits
- **Single User** - Built for single-user use (no database needed)
- **In-Memory Storage** - Job state stored in memory + /tmp (ephemeral on Vercel)
- **Duration Limits** - Videos must be 5-8 seconds per scene

## License

Private use only.
