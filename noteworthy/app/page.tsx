import Link from "next/link";

export default function LandingPage() {

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <h1 className="text-5xl font-bold">Welcome to My App</h1>
      <p className="text-lg text-gray-600 mt-4">Your awesome landing page.</p>
      <Link href="/convert">
        <button className="mt-6 px-6 py-3 bg-blue-500 text-white rounded-lg">
          Go to Home
        </button>
      </Link>
    </div>
  );
}
