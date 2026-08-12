import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: supabaseHostname ? {
    remotePatterns: [{
      protocol: "https",
      hostname: supabaseHostname,
      pathname: "/storage/v1/object/sign/vet-chat-images/**",
    }],
  } : undefined,
};

export default nextConfig;
