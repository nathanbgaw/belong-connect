import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships font metrics as files and pptxgenjs bundles poorly; keep both
  // as plain Node dependencies instead of letting the bundler rewrite them.
  serverExternalPackages: ["pdfkit", "pptxgenjs"],
};

export default nextConfig;
