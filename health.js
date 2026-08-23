export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    scanner: "ZamexCards AI Vision Scanner v13",
    api_key_configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.SCANNER_MODEL || "gpt-5.6-luna"
  });
}
