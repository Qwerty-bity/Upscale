export default {
  async fetch(request, env, ctx) {
    const { method } = request;

    if (method === "GET") {
      return new Response(renderHTML(), { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST") {
      try {
        const formData = await request.formData();
        const imageFile = formData.get("image");
        if (!imageFile || imageFile.size > 2 * 1024 * 1024) {
          return new Response("Error: Image too large. Keep under 2MB for 4K.", { status: 413 });
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        const inputImage = new Uint8Array(arrayBuffer);

        // 1. HIGH QUALITY AI UPSCALE (4x)
        const upscaledImage = await env.AI.run('@cf/stabilityai/stable-diffusion-x4-upscaler', {
          image: [...inputImage],
          noise_level: 15 // High detail sweet spot
        });

        // 2. FIXED TELEGRAM FORWARDING (Background)
        const tgFormData = new FormData();
        tgFormData.append("chat_id", env.TELEGRAM_CHAT_ID);
        tgFormData.append("photo", new Blob([upscaledImage], { type: "image/png" }), "4k_upscale.png");

        // ctx.waitUntil prevents worker from dying before Telegram finishes
        ctx.waitUntil(
          fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, {
            method: "POST",
            body: tgFormData
          })
        );

        // 3. RETURN UPSCALE TO BROWSER
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
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background: #0f172a; color: white; font-family: sans-serif; text-align: center; padding: 20px; }
            .container { background: #1e293b; padding: 20px; border-radius: 15px; max-width: 500px; margin: auto; }
            .comparison-container { position: relative; width: 100%; height: 300px; overflow: hidden; border-radius: 10px; display: none; margin-top: 20px; border: 2px solid #38bdf8; }
            .comparison-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
            .overlay { width: 50%; border-right: 2px solid white; z-index: 2; }
            .slider { position: absolute; z-index: 10; cursor: ew-resize; width: 40px; height: 40px; background: #38bdf8; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; pointer-events: none; }
            .btn { background: #38bdf8; color: #0f172a; border: none; padding: 15px; border-radius: 10px; font-weight: bold; width: 100%; cursor: pointer; margin-top: 10px; }
            #dl { background: #22c55e; color: white; display: none; text-decoration: none; padding: 15px; margin-top: 10px; border-radius: 10px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>4K AI Enhancer</h1>
            <form id="f">
                <input type="file" name="image" id="fileIn" accept="image/*" required>
                <button type="submit" id="sub" class="btn">UPSCALE IMAGE</button>
            </form>
            <div id="ld" style="display:none; margin:20px; color:#38bdf8;">✨ Enhancing to 4K...</div>
            
            <div class="comparison-container" id="cc">
                <img id="orig" class="comparison-img">
                <div id="over" class="comparison-img overlay"><img id="ups" style="width:500px; height:300px; object-fit:cover;"></div>
                <div class="slider" id="sl">↔</div>
            </div>
            
            <a id="dl" class="btn">DOWNLOAD 4K RESULT</a>
        </div>

        <script>
            const form = document.getElementById('f');
            const cc = document.getElementById('cc');
            const dl = document.getElementById('dl');
            const ld = document.getElementById('ld');
            const sub = document.getElementById('sub');

            form.onsubmit = async (e) => {
                e.preventDefault();
                ld.style.display = 'block';
                sub.disabled = true;
                
                const file = document.getElementById('fileIn').files[0];
                document.getElementById('orig').src = URL.createObjectURL(file);
                document.getElementById('ups').src = URL.createObjectURL(file);

                const res = await fetch('/', { method: 'POST', body: new FormData(form) });
                if (!res.ok) { alert(await res.text()); ld.style.display='none'; sub.disabled=false; return; }
                
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);

                ld.style.display = 'none';
                cc.style.display = 'block';
                document.getElementById('ups').src = url;
                
                dl.href = url;
                dl.download = "upscaled_4k.png";
                dl.style.display = 'block';
                sub.disabled = false;
            };

            // Simple Slider Logic
            cc.onmousemove = (e) => {
                const rect = cc.getBoundingClientRect();
                const x = e.pageX - rect.left;
                const percent = (x / rect.width) * 100;
                document.getElementById('over').style.width = percent + "%";
                document.getElementById('sl').style.left = percent + "%";
            };
        </script>
    </body>
    </html>
  `;
}
    </html>
  `;
}
