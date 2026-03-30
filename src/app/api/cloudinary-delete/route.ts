// src/app/api/cloudinary-delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function publicIdFromUrl(url: string): { publicId: string; resourceType: string } {
  // https://res.cloudinary.com/{cloud}/image/upload/v123/procedimientos/abc.jpg
  // https://res.cloudinary.com/{cloud}/video/upload/v123/procedimientos/abc.mp4
  const match = url.match(/\/(?:image|video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  const resourceType = url.includes('/video/') ? 'video' : 'image';
  return {
    publicId: match ? match[1] : '',
    resourceType,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json() as { url: string };
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;

    const { publicId, resourceType } = publicIdFromUrl(url);
    if (!publicId) return NextResponse.json({ ok: true }); // nada que borrar

    const timestamp = Math.round(Date.now() / 1000).toString();
    const str = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(str).digest('hex');

    const form = new URLSearchParams();
    form.append('public_id', publicId);
    form.append('timestamp', timestamp);
    form.append('api_key', apiKey);
    form.append('signature', signature);

    await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: 'POST', body: form },
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
