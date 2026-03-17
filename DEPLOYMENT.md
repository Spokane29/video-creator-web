# Deployment Checklist

## Pre-Deployment

### 1. Get Google Gemini API Key
- Visit [Google AI Studio](https://aistudio.google.com/)
- Create/get your API key
- Required for all Gemini APIs (Script, Imagen, Veo, TTS)

### 2. Generate Password Hash
Run this command to hash the password "Lakers#1":
```bash
echo -n "Lakers#1" | shasum -a 256 | awk '{print $1}'
```
Result: `e65e8af4f72c0e1c20bc23f5fa12d0f0e0c6f3b2c5c3d8f8a9b7e4f6d1c2a3b4` (example)

## Vercel Deployment

### 1. Install Vercel CLI (if needed)
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Link Project
```bash
cd ~/openclaw-projects/video-creator-web
vercel
```
- Follow prompts to create new project
- Framework: Next.js
- Build command: (default)
- Output directory: (default)

### 4. Set Environment Variables
```bash
vercel env add GEMINI_API_KEY
# Paste your Gemini API key

vercel env add AUTH_EMAIL
# Enter: mccoy.bill@gmail.com

vercel env add AUTH_PASSWORD_HASH
# Paste the SHA-256 hash from step 2 above

vercel env add SESSION_SECRET
# Enter a random 32+ character string
# Example: openssl rand -base64 32
```

Make sure to add these for **Production**, **Preview**, and **Development** environments.

### 5. Deploy
```bash
vercel --prod
```

### 6. Test Deployment
- Visit your production URL
- Login with: mccoy.bill@gmail.com / Lakers#1
- Try generating a simple 2-scene video to test all APIs

## Post-Deployment Monitoring

### Check Vercel Logs
```bash
vercel logs
```

### Common Issues

**"GEMINI_API_KEY not configured"**
- Verify env var is set in Vercel dashboard
- Redeploy if needed

**"Authentication failed"**
- Verify AUTH_EMAIL matches exactly
- Verify AUTH_PASSWORD_HASH is correct
- Check SESSION_SECRET is set

**Video generation fails**
- Check Gemini API quota/limits
- Verify API key has access to all required models
- Check Vercel function timeout (default 10s, may need Pro plan for longer)

**Rate limit errors**
- Gemini has strict rate limits
- 90-second cooldown is built in
- May need to reduce concurrent requests

## Optimization Tips

### For Production Use
1. Consider upgrading to Vercel Pro for longer function timeouts
2. Implement proper error handling and retry logic
3. Add request queuing to handle multiple users
4. Set up monitoring/alerts for API quota usage
5. Consider caching script generations for similar prompts

### Cost Optimization
- Monitor Gemini API usage
- Implement request limits per user
- Cache generated assets
- Use lower-cost models where possible

## Security Notes

- Session secret should be unique and random
- Never commit .env.local to git
- Rotate API keys periodically
- Monitor for unusual API usage
- Consider adding CAPTCHA for production

## Support

For issues, check:
1. Vercel deployment logs
2. Browser console (frontend errors)
3. Network tab (API errors)
4. Google Cloud Console (API quotas)

## Local Development

To test before deploying:
```bash
npm run dev
```

Create `.env.local` with the same variables as Vercel env vars.
