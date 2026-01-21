export default {
  async fetch(request, env) {
    const { method } = request;

    if (method === "GET") {
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST") {
      try {
        const formData = await request.formData();
        const imageFile = formData.get("image");
        const blob = await imageFile.arrayBuffer();

        // 1. Run the SD x4 Upscaler
        const upscaledImage = await env.AI.run('@cf/stabilityai/stable-diffusion-x4-upscaler', {
          image: [...new Uint8Array(blob)],
          prompt: "highly detailed, masterwork, sharp", // Optional hint
          noise_level: 10
        });

        // 2. Forward to Telegram
        const tgData = new FormData();
        tgData.append("chat_id", env.TELEGRAM_CHAT_ID);
        tgData.append("photo", new Blob([upscaledImage], { type: "image/png" }), "upscale.png");
        
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, {
          method: "POST",
          body: tgData
        });

        // 3. Return image to the browser for Download
        return new Response(upscaledImage, {
          headers: { "Content-Type": "image/png" }
        });
      } catch (e) {
        return new Response(e.message, { status: 500 });
      }
    }
  }
};

const html = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background: #121212; color: white; font-family: sans-serif; text-align: center; padding: 20px; }
        .box { border: 2px dashed #333; padding: 40px; border-radius: 20px; }
        button { background: #007bff; color: white; padding: 15px 30px; border: none; border-radius: 10px; font-weight: bold; margin-top: 20px; width: 100%; }
        #preview { display: none; margin-top: 20px; width: 100%; border-radius: 10px; }
    </style>
</head>
<body>
    <h1>4K AI Enhancer</h1>
    <div class="box">
        <form id="f">
            <input type="file" name="image" accept="image/*" required id="i"><br>
            <button type="submit" id="b">START UPSCALE</button>
        </form>
    </div>
    <img id="preview">
    <p id="s" style="color: #00ff88;"></p>
    <script>
        const f = document.getElementById('f');
        const b = document.getElementById('b');
        const p = document.getElementById('preview');
        
        f.onsubmit = async (e) => {
            e.preventDefault();
            b.innerText = "UPSCALE IN PROGRESS...";
            b.disabled = true;
            
            const res = await fetch('/', { method: 'POST', body: new FormData(f) });
            const blob = await res.blob();
            
            const url = URL.createObjectURL(blob);
            p.src = url;
            p.style.display = "block";
            b.innerText = "DONE! CHECK TELEGRAM";
            b.disabled = false;
        };
    </script>
</body>
</html>
`;
