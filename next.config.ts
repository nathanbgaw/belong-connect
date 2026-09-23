import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships font metrics as files, so it stays a plain Node dependency.
  // pptxgenjs must be bundled: as an external, Node loads its ES build and fails.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
