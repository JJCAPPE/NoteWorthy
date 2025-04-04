import Breadcrumb from "@/components/Common/Breadcrumb";
import SavedPdfs from "@/components/SavedPdfs";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Saved PDFs | NoteWorthy",
  description: "View and manage your saved PDF documents",
};

const SavedPdfsPage = async () => {
  // Check if user is authenticated
  const session = await getServerSession(authOptions);
  
  // If user is not authenticated, show a message with sign in/sign up links
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-60">
        <div className="max-w-2xl mx-auto text-center bg-white dark:bg-dark rounded-xl shadow-lg p-8 transition-colors duration-200">
          <h1 className="text-3xl font-bold text-dark dark:text-white mb-4">Authentication Required</h1>
          <p className="text-body-color dark:text-body-color-dark text-base mb-8">
            You need to be signed in to view and manage your saved PDFs.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="/auth/signin"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-primary rounded-md hover:bg-opacity-90 transition-colors duration-200"
            >
              Sign In
            </a>
            <a
              href="/auth/signup"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-dark dark:text-white border border-body-color dark:border-white/10 rounded-md hover:bg-gray-100 dark:hover:bg-dark-2 transition-colors duration-200"
            >
              Sign Up
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <Breadcrumb pageName="Saved PDFs" />
      <SavedPdfs />
    </>
  );
};

export default SavedPdfsPage;
