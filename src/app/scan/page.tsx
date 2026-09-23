import { Suspense } from "react";
import ScanClient from "./ScanClient";

export const metadata = { title: "Read a church website" };

export default function ScanPage() {
  return (
    <Suspense>
      <ScanClient />
    </Suspense>
  );
}
