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
  
  // Redirect to login page if not authenticated
  if (!session) {
    redirect('/auth/signin?callbackUrl=/saved');
  }
  
  return (
    <>
      <Breadcrumb pageName="Saved PDFs" />
      <SavedPdfs />
    </>
  );
};

export default SavedPdfsPage;
