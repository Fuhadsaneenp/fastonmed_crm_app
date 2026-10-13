import ProductManager from "@/components/ProductManager";
import "../editor.css";
export default async function Page({params}: {params: Promise<{id: string}>}) { return <ProductManager mode="editor" id={(await params).id} />; }

