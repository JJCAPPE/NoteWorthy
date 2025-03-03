import Breadcrumb from "@/components/Common/Breadcrumb";
import Convert from "@/components/Convert";
import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Convert Notes | Main NoteWorthy Service",
  description: "This is where you can convert your handwritten notes to pdf and latex with a single click",
};

const ContactPage = () => {
  return (
    <>
      <Breadcrumb pageName="Convert Notes" />

      <Convert />
    </>
  );
};

export default ContactPage;
